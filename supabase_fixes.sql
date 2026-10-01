-- ==========================================================
-- HANDYMAN SECURITY & MONEY FIXES  (run AFTER supabase_handyman_schema.sql)
--
-- !! DRAFT: written without a live Postgres to test against.
-- !! Run on a staging project first and test every flow
-- !! (claim, travel, OTP, complete, withdraw, KYC) before production.
--
-- Fixes: wallet tampering, public PII, fake KYC, OTP skip / brute force,
--        spoofable technician id in RPCs, non-atomic withdrawals.
--
-- NOT fixed here (needs a design change, see HandyMan_Audit.md P0 #5/#8):
--   * start_otp and customer address/phone are still readable by
--     technicians through bookings. Proper fix: a `job_offers` table with
--     only safe columns for the radar, plus a customer-only OTP source.
--     That has to be coordinated with the Houserve customer app.
-- ==========================================================

-- ---------- 1. GRANTS ----------
REVOKE ALL ON public.technician_profiles FROM anon;
REVOKE ALL ON public.technician_payouts  FROM anon;
REVOKE ALL ON public.technician_reviews  FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.technician_payouts FROM authenticated;

-- ---------- 2. TECHNICIAN PROFILE RLS ----------
DROP POLICY IF EXISTS "Technicians can manage own profile"            ON public.technician_profiles;
DROP POLICY IF EXISTS "Allow authenticated insert for technician_profiles" ON public.technician_profiles;
DROP POLICY IF EXISTS "Public can view active technician ratings"      ON public.technician_profiles;

CREATE POLICY "Technician reads own profile" ON public.technician_profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "Technician creates own pending profile" ON public.technician_profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = id
    AND verification_status = 'pending'
    AND COALESCE(wallet_balance, 0) = 0
    AND COALESCE(is_online, false) = false
  );

CREATE POLICY "Technician updates own profile" ON public.technician_profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Safe, public-facing slice (rating only; no PII, no money)
CREATE OR REPLACE VIEW public.technician_public AS
  SELECT id, rating, total_ratings_count, total_completed_jobs, experience_years, skills
  FROM public.technician_profiles
  WHERE verification_status = 'approved';
GRANT SELECT ON public.technician_public TO authenticated;

-- Column guard: clients may NOT change money / trust fields directly.
-- Inside SECURITY DEFINER functions current_user is the function owner, so RPCs still work.
CREATE OR REPLACE FUNCTION public.guard_technician_profile()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF NEW.wallet_balance        IS DISTINCT FROM OLD.wallet_balance
    OR NEW.rating                IS DISTINCT FROM OLD.rating
    OR NEW.total_ratings_count   IS DISTINCT FROM OLD.total_ratings_count
    OR NEW.total_completed_jobs  IS DISTINCT FROM OLD.total_completed_jobs
    OR NEW.verification_status   IS DISTINCT FROM OLD.verification_status
    OR NEW.rejection_reason      IS DISTINCT FROM OLD.rejection_reason THEN
      RAISE EXCEPTION 'Protected fields cannot be modified directly';
    END IF;
    IF NEW.is_online AND NEW.verification_status <> 'approved' THEN
      RAISE EXCEPTION 'Only verified partners can go online';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_technician_profile ON public.technician_profiles;
CREATE TRIGGER trg_guard_technician_profile
  BEFORE UPDATE ON public.technician_profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_technician_profile();

-- ---------- 3. BOOKINGS RLS ----------
-- Technicians can only see open jobs if verified. All status changes go through RPCs.
DROP POLICY IF EXISTS "Role based booking read policy"        ON public.bookings;
DROP POLICY IF EXISTS "Technician can update assigned booking" ON public.bookings;

CREATE POLICY "Role based booking read policy" ON public.bookings
  FOR SELECT USING (
    auth.uid() = customer_id
    OR auth.uid() = technician_id
    OR (
      technician_id IS NULL AND status = 'confirmed'
      AND EXISTS (
        SELECT 1 FROM public.technician_profiles t
        WHERE t.id = auth.uid() AND t.verification_status = 'approved'
      )
    )
  );

DROP POLICY IF EXISTS "Parties can view booking items" ON public.booking_items;
CREATE POLICY "Parties can view booking items" ON public.booking_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_items.booking_id
        AND (
          b.customer_id = auth.uid()
          OR b.technician_id = auth.uid()
          OR (b.technician_id IS NULL AND b.status = 'confirmed'
              AND EXISTS (SELECT 1 FROM public.technician_profiles t
                          WHERE t.id = auth.uid() AND t.verification_status = 'approved'))
        )
    )
  );

-- ---------- 4. OTP ATTEMPT LIMITING ----------
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS otp_attempts INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS otp_locked_until TIMESTAMPTZ;

-- ---------- 5. RPCs (auth.uid() based, fixed search_path) ----------
-- The old signatures took p_technician_id from the client. Drop and replace.
DROP FUNCTION IF EXISTS public.claim_booking(UUID, UUID);
DROP FUNCTION IF EXISTS public.verify_start_otp(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS public.complete_booking_service(UUID, UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.claim_booking(p_booking_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_tech public.technician_profiles%ROWTYPE;
  v_booking public.bookings%ROWTYPE;
  v_category TEXT;
  v_payout DECIMAL(10,2);
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Please sign in again.');
  END IF;

  SELECT * INTO v_tech FROM technician_profiles WHERE id = v_uid;
  IF NOT FOUND OR v_tech.verification_status <> 'approved' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Your profile is not verified yet.');
  END IF;

  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Booking not found.');
  END IF;

  IF v_booking.technician_id IS NOT NULL OR v_booking.status <> 'confirmed' THEN
    RETURN jsonb_build_object('success', false, 'message', 'This job was already taken by another partner.');
  END IF;

  SELECT category INTO v_category FROM services WHERE id = v_booking.service_id;
  IF v_category IS NOT NULL AND NOT (v_category = ANY (v_tech.skills)) THEN
    RETURN jsonb_build_object('success', false, 'message', 'This job is outside your selected trades.');
  END IF;

  v_payout := ROUND((v_booking.subtotal * 0.80)::numeric, 2);

  UPDATE bookings
     SET technician_id = v_uid, technician_earnings = v_payout,
         status = 'accepted', updated_at = NOW()
   WHERE id = p_booking_id;

  INSERT INTO notifications (user_id, title, body, type, booking_id)
  VALUES (v_booking.customer_id, 'Technician assigned',
          'A verified professional has accepted your service request.', 'booking', p_booking_id);

  RETURN jsonb_build_object('success', true, 'message', 'Job accepted.', 'payout', v_payout);
END $$;

-- accepted -> on_the_way (the only transition that needs no OTP)
CREATE OR REPLACE FUNCTION public.start_travel(p_booking_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rows INTEGER;
BEGIN
  UPDATE bookings SET status = 'on_the_way', updated_at = NOW()
   WHERE id = p_booking_id AND technician_id = auth.uid() AND status = 'accepted';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'This job cannot be started right now.');
  END IF;
  RETURN jsonb_build_object('success', true, 'message', 'On the way.');
END $$;

CREATE OR REPLACE FUNCTION public.verify_start_otp(p_booking_id UUID, p_otp TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_b bookings%ROWTYPE;
BEGIN
  SELECT * INTO v_b FROM bookings
   WHERE id = p_booking_id AND technician_id = auth.uid() FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'This job is not assigned to you.');
  END IF;
  IF v_b.status <> 'on_the_way' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Mark the job as "On the way" first.');
  END IF;
  IF v_b.otp_locked_until IS NOT NULL AND v_b.otp_locked_until > NOW() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Too many wrong attempts. Try again in a few minutes.');
  END IF;

  IF v_b.start_otp IS DISTINCT FROM trim(p_otp) THEN
    UPDATE bookings
       SET otp_attempts = COALESCE(otp_attempts, 0) + 1,
           otp_locked_until = CASE WHEN COALESCE(otp_attempts, 0) + 1 >= 5
                                   THEN NOW() + INTERVAL '10 minutes' END
     WHERE id = p_booking_id;
    RETURN jsonb_build_object('success', false, 'message', 'Wrong code. Ask the customer to check the code in their Houserve app.');
  END IF;

  UPDATE bookings
     SET status = 'in_progress', started_at = NOW(), otp_attempts = 0,
         otp_locked_until = NULL, updated_at = NOW()
   WHERE id = p_booking_id;
  RETURN jsonb_build_object('success', true, 'message', 'Verified. Job started.');
END $$;

CREATE OR REPLACE FUNCTION public.complete_booking_service(
  p_booking_id UUID, p_proof_after_url TEXT DEFAULT NULL, p_notes TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_b bookings%ROWTYPE;
  v_earnings DECIMAL(10,2);
BEGIN
  SELECT * INTO v_b FROM bookings
   WHERE id = p_booking_id AND technician_id = v_uid FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Booking not found or not assigned to you.');
  END IF;
  IF v_b.status = 'completed' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Already completed.');
  END IF;
  IF v_b.status <> 'in_progress' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Start the job with the customer code before completing it.');
  END IF;
  IF v_b.payment_status IS DISTINCT FROM 'paid' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Payment is not confirmed yet. Contact support.');
  END IF;

  v_earnings := COALESCE(v_b.technician_earnings, ROUND((v_b.subtotal * 0.80)::numeric, 2));

  UPDATE bookings
     SET status = 'completed', completed_at = NOW(),
         proof_after_url = COALESCE(p_proof_after_url, proof_after_url),
         technician_notes = COALESCE(p_notes, technician_notes),
         technician_earnings = v_earnings, updated_at = NOW()
   WHERE id = p_booking_id;

  UPDATE technician_profiles
     SET wallet_balance = wallet_balance + v_earnings,
         total_completed_jobs = total_completed_jobs + 1, updated_at = NOW()
   WHERE id = v_uid;

  INSERT INTO technician_payouts (technician_id, booking_id, type, amount, status, notes)
  VALUES (v_uid, p_booking_id, 'job_payout', v_earnings, 'completed', 'Completed booking ' || v_b.booking_ref);

  INSERT INTO notifications (user_id, title, body, type, booking_id)
  VALUES (v_b.customer_id, 'Service completed',
          'Your service has been marked complete. Thank you for choosing Houserve!', 'booking', p_booking_id);

  RETURN jsonb_build_object('success', true, 'message', 'Completed. Wallet credited.', 'credited_amount', v_earnings);
END $$;

-- ---------- 6. WITHDRAWALS (atomic, server-side) ----------
CREATE OR REPLACE FUNCTION public.request_withdrawal(p_amount NUMERIC)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_t technician_profiles%ROWTYPE;
  c_min CONSTANT NUMERIC := 100;
BEGIN
  SELECT * INTO v_t FROM technician_profiles WHERE id = v_uid FOR UPDATE;
  IF NOT FOUND OR v_t.verification_status <> 'approved' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Your profile is not verified yet.');
  END IF;
  IF v_t.bank_upi_id IS NULL OR length(trim(v_t.bank_upi_id)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Add a UPI ID before withdrawing.');
  END IF;
  IF p_amount IS NULL OR p_amount < c_min THEN
    RETURN jsonb_build_object('success', false, 'message', 'Minimum withdrawal is Rs ' || c_min || '.');
  END IF;
  IF p_amount > v_t.wallet_balance THEN
    RETURN jsonb_build_object('success', false, 'message', 'Amount is more than your balance.');
  END IF;

  UPDATE technician_profiles
     SET wallet_balance = wallet_balance - p_amount, updated_at = NOW()
   WHERE id = v_uid;

  -- 'pending' until your payout provider (e.g. Razorpay X) confirms the transfer.
  INSERT INTO technician_payouts (technician_id, type, amount, status, notes)
  VALUES (v_uid, 'withdrawal', p_amount, 'pending', 'Payout to ' || v_t.bank_upi_id);

  RETURN jsonb_build_object('success', true, 'message', 'Withdrawal requested.');
END $$;

-- ---------- 7. KYC: submit = pending, never auto-approve ----------
CREATE OR REPLACE FUNCTION public.save_technician_kyc(
  p_skills TEXT[], p_experience_years INTEGER, p_id_type TEXT, p_id_number TEXT,
  p_id_document_url TEXT DEFAULT NULL, p_bank_upi_id TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Please sign in again.');
  END IF;
  IF p_skills IS NULL OR array_length(p_skills, 1) IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Select at least one trade.');
  END IF;

  UPDATE profiles SET role = 'technician', updated_at = NOW()
   WHERE id = v_uid AND role <> 'admin';

  INSERT INTO technician_profiles (id, skills, experience_years, id_type, id_number,
                                   id_document_url, bank_upi_id, verification_status, is_online, updated_at)
  VALUES (v_uid, p_skills, p_experience_years, p_id_type, p_id_number,
          p_id_document_url, p_bank_upi_id, 'pending', false, NOW())
  ON CONFLICT (id) DO UPDATE SET
    skills = EXCLUDED.skills,
    experience_years = EXCLUDED.experience_years,
    id_type = EXCLUDED.id_type,
    id_number = EXCLUDED.id_number,
    id_document_url = COALESCE(EXCLUDED.id_document_url, technician_profiles.id_document_url),
    bank_upi_id = COALESCE(EXCLUDED.bank_upi_id, technician_profiles.bank_upi_id),
    -- keep an existing approval; a rejected partner goes back to pending for re-review
    verification_status = CASE WHEN technician_profiles.verification_status = 'approved'
                               THEN 'approved' ELSE 'pending' END,
    updated_at = NOW();

  RETURN jsonb_build_object('success', true, 'message', 'Submitted for verification.');
END $$;

-- Admin-only approval (call from your admin panel or the Supabase SQL editor)
CREATE OR REPLACE FUNCTION public.admin_set_verification(p_user UUID, p_status TEXT, p_reason TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Admins only';
  END IF;
  IF p_status NOT IN ('approved', 'rejected', 'pending') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;
  UPDATE technician_profiles
     SET verification_status = p_status,
         rejection_reason = CASE WHEN p_status = 'rejected' THEN p_reason END,
         is_online = CASE WHEN p_status = 'approved' THEN is_online ELSE false END,
         updated_at = NOW()
   WHERE id = p_user;
  RETURN jsonb_build_object('success', true);
END $$;

-- ---------- 8. FUNCTION PRIVILEGES ----------
REVOKE ALL ON FUNCTION public.claim_booking(UUID)                         FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.start_travel(UUID)                          FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.verify_start_otp(UUID, TEXT)                FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.complete_booking_service(UUID, TEXT, TEXT)  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.request_withdrawal(NUMERIC)                 FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_technician_kyc(TEXT[], INTEGER, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_verification(UUID, TEXT, TEXT)    FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.claim_booking(UUID)                         TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_travel(UUID)                          TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_start_otp(UUID, TEXT)                TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_booking_service(UUID, TEXT, TEXT)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(NUMERIC)                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_technician_kyc(TEXT[], INTEGER, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_verification(UUID, TEXT, TEXT)    TO authenticated;
