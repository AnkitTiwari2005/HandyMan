-- ==========================================================
-- HANDYMAN COMPANION EXTENSIONS & POLICIES (100% Non-Breaking)
-- ==========================================================

-- 1. EXTEND BOOKINGS WITH NON-BREAKING OPTIONAL COLUMNS
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS start_otp VARCHAR(4) DEFAULT floor(1000 + random() * 9000)::text,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS proof_before_url TEXT,
  ADD COLUMN IF NOT EXISTS proof_after_url TEXT,
  ADD COLUMN IF NOT EXISTS technician_notes TEXT,
  ADD COLUMN IF NOT EXISTS technician_earnings DECIMAL(10,2);

-- 2. CREATE TECHNICIAN PROFILES COMPANION TABLE
CREATE TABLE IF NOT EXISTS public.technician_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  skills TEXT[] NOT NULL DEFAULT '{}',
  experience_years INTEGER DEFAULT 1,
  id_type TEXT DEFAULT 'Aadhaar',
  id_number TEXT,
  id_document_url TEXT,
  verification_status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  rejection_reason TEXT,
  is_online BOOLEAN DEFAULT FALSE,
  current_latitude DOUBLE PRECISION,
  current_longitude DOUBLE PRECISION,
  service_radius_km DOUBLE PRECISION DEFAULT 15.0,
  pincodes_served TEXT[] DEFAULT '{}',
  bank_account_name TEXT,
  bank_account_number TEXT,
  bank_ifsc TEXT,
  bank_upi_id TEXT,
  wallet_balance DECIMAL(10,2) DEFAULT 0.00,
  total_completed_jobs INTEGER DEFAULT 0,
  rating DECIMAL(3,2) DEFAULT 5.00,
  total_ratings_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. CREATE TECHNICIAN PAYOUTS LEDGER
CREATE TABLE IF NOT EXISTS public.technician_payouts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  technician_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  type TEXT NOT NULL, -- 'job_payout', 'incentive', 'withdrawal', 'penalty'
  amount DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'completed', -- 'pending', 'completed', 'failed'
  reference_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. CREATE TECHNICIAN REVIEWS TABLE
CREATE TABLE IF NOT EXISTS public.technician_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE UNIQUE NOT NULL,
  technician_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
  feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4.1 GRANTS FOR AUTHENTICATED PARTNERS
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.technician_profiles TO anon, authenticated, service_role;
GRANT ALL ON public.technician_payouts TO anon, authenticated, service_role;
GRANT ALL ON public.technician_reviews TO anon, authenticated, service_role;

-- 5. ROW-LEVEL SECURITY UPDATES
ALTER TABLE public.technician_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technician_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technician_reviews ENABLE ROW LEVEL SECURITY;

-- Technician Profiles RLS
DROP POLICY IF EXISTS "Technicians can manage own profile" ON public.technician_profiles;
CREATE POLICY "Technicians can manage own profile" ON public.technician_profiles
  FOR ALL TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Allow authenticated insert for technician_profiles" ON public.technician_profiles;
CREATE POLICY "Allow authenticated insert for technician_profiles" ON public.technician_profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Public can view active technician ratings" ON public.technician_profiles;
CREATE POLICY "Public can view active technician ratings" ON public.technician_profiles
  FOR SELECT USING (true);

-- Technician Payouts RLS
DROP POLICY IF EXISTS "Technicians can view own payouts" ON public.technician_payouts;
CREATE POLICY "Technicians can view own payouts" ON public.technician_payouts
  FOR SELECT USING (auth.uid() = technician_id);

-- Bookings RLS (Non-breaking: Customer sees own, Technician sees assigned OR unassigned confirmed jobs)
DROP POLICY IF EXISTS "Users can manage own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Role based booking read policy" ON public.bookings;
CREATE POLICY "Role based booking read policy" ON public.bookings
  FOR SELECT USING (
    auth.uid() = customer_id 
    OR auth.uid() = technician_id
    OR (
      technician_id IS NULL 
      AND status = 'confirmed'
      AND EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'technician'
      )
    )
  );

DROP POLICY IF EXISTS "Customer can update own booking" ON public.bookings;
CREATE POLICY "Customer can update own booking" ON public.bookings
  FOR UPDATE USING (auth.uid() = customer_id)
  WITH CHECK (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Technician can update assigned booking" ON public.bookings;
CREATE POLICY "Technician can update assigned booking" ON public.bookings
  FOR UPDATE USING (auth.uid() = technician_id)
  WITH CHECK (auth.uid() = technician_id);

-- Booking Items RLS
DROP POLICY IF EXISTS "Users can view own booking items" ON public.booking_items;
DROP POLICY IF EXISTS "Parties can view booking items" ON public.booking_items;
CREATE POLICY "Parties can view booking items" ON public.booking_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.bookings 
      WHERE public.bookings.id = booking_id 
      AND (
        public.bookings.customer_id = auth.uid() 
        OR public.bookings.technician_id = auth.uid()
        OR public.bookings.technician_id IS NULL
      )
    )
  );

-- 6. ATOMIC CLAIM BOOKING RPC (Prevents Race Conditions)
CREATE OR REPLACE FUNCTION public.claim_booking(p_booking_id UUID, p_technician_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_payout DECIMAL(10,2);
BEGIN
  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Booking not found.');
  END IF;

  IF v_booking.technician_id IS NOT NULL OR v_booking.status != 'confirmed' THEN
    RETURN jsonb_build_object('success', false, 'message', 'This job was already accepted by another partner.');
  END IF;

  -- 80% payout
  v_payout := ROUND((v_booking.subtotal * 0.80)::numeric, 2);

  UPDATE public.bookings
  SET 
    technician_id = p_technician_id,
    technician_earnings = v_payout,
    status = 'accepted',
    updated_at = NOW()
  WHERE id = p_booking_id;

  INSERT INTO public.notifications (user_id, title, body, type, booking_id)
  VALUES (
    v_booking.customer_id,
    'Technician Assigned! 🔧',
    'A verified professional has accepted your service request.',
    'booking',
    p_booking_id
  );

  RETURN jsonb_build_object('success', true, 'message', 'Job accepted successfully!', 'payout', v_payout);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. VERIFY CUSTOMER START OTP RPC
CREATE OR REPLACE FUNCTION public.verify_start_otp(p_booking_id UUID, p_technician_id UUID, p_otp TEXT)
RETURNS JSONB AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
BEGIN
  SELECT * INTO v_booking 
  FROM public.bookings 
  WHERE id = p_booking_id AND technician_id = p_technician_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Booking not assigned to this technician.');
  END IF;

  IF v_booking.start_otp != trim(p_otp) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid 4-digit OTP. Please request the customer to provide the code shown on their Houserve app.');
  END IF;

  UPDATE public.bookings
  SET 
    status = 'in_progress',
    started_at = NOW(),
    updated_at = NOW()
  WHERE id = p_booking_id;

  RETURN jsonb_build_object('success', true, 'message', 'Customer OTP verified. Job started successfully!');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. COMPLETE BOOKING AND CREDIT WALLET RPC
CREATE OR REPLACE FUNCTION public.complete_booking_service(
  p_booking_id UUID, 
  p_technician_id UUID, 
  p_proof_after_url TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_earnings DECIMAL(10,2);
BEGIN
  SELECT * INTO v_booking 
  FROM public.bookings 
  WHERE id = p_booking_id AND technician_id = p_technician_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Booking not found or not assigned to you.');
  END IF;

  IF v_booking.status = 'completed' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Booking already marked completed.');
  END IF;

  v_earnings := COALESCE(v_booking.technician_earnings, ROUND((v_booking.subtotal * 0.80)::numeric, 2));

  UPDATE public.bookings
  SET 
    status = 'completed',
    completed_at = NOW(),
    proof_after_url = COALESCE(p_proof_after_url, proof_after_url),
    technician_notes = COALESCE(p_notes, technician_notes),
    technician_earnings = v_earnings,
    updated_at = NOW()
  WHERE id = p_booking_id;

  UPDATE public.technician_profiles
  SET 
    wallet_balance = wallet_balance + v_earnings,
    total_completed_jobs = total_completed_jobs + 1,
    updated_at = NOW()
  WHERE id = p_technician_id;

  INSERT INTO public.technician_payouts (technician_id, booking_id, type, amount, status, notes)
  VALUES (p_technician_id, p_booking_id, 'job_payout', v_earnings, 'completed', 'Completed booking ' || v_booking.booking_ref);

  INSERT INTO public.notifications (user_id, title, body, type, booking_id)
  VALUES (
    v_booking.customer_id,
    'Service Completed! ✅',
    'Your service has been marked complete by the technician. Thank you for choosing Houserve!',
    'booking',
    p_booking_id
  );

  RETURN jsonb_build_object('success', true, 'message', 'Job marked completed and wallet credited!', 'credited_amount', v_earnings);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. ATOMIC SAVE TECHNICIAN KYC RPC (Security Definer)
CREATE OR REPLACE FUNCTION public.save_technician_kyc(
  p_skills TEXT[],
  p_experience_years INTEGER,
  p_id_type TEXT,
  p_id_number TEXT,
  p_id_document_url TEXT DEFAULT NULL,
  p_bank_upi_id TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Authentication required. Please log in.');
  END IF;

  -- Ensure profile role is technician
  UPDATE public.profiles
  SET role = 'technician', updated_at = NOW()
  WHERE id = v_user_id;

  -- Upsert technician profile record
  INSERT INTO public.technician_profiles (
    id,
    skills,
    experience_years,
    id_type,
    id_number,
    id_document_url,
    bank_upi_id,
    verification_status,
    is_online,
    updated_at
  )
  VALUES (
    v_user_id,
    p_skills,
    p_experience_years,
    p_id_type,
    p_id_number,
    p_id_document_url,
    p_bank_upi_id,
    'approved',
    true,
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    skills = EXCLUDED.skills,
    experience_years = EXCLUDED.experience_years,
    id_type = EXCLUDED.id_type,
    id_number = EXCLUDED.id_number,
    id_document_url = COALESCE(EXCLUDED.id_document_url, technician_profiles.id_document_url),
    bank_upi_id = COALESCE(EXCLUDED.bank_upi_id, technician_profiles.bank_upi_id),
    verification_status = 'approved',
    is_online = true,
    updated_at = NOW();

  RETURN jsonb_build_object('success', true, 'message', 'Profile and trades saved successfully!');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

