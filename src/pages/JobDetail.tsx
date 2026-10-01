import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import confetti from 'canvas-confetti';
import {
  ArrowLeft, Navigation, Phone, MessageCircle, Copy, Check, Camera,
  CalendarDays, MapPin, ShieldCheck, CheckCircle2, Wallet,
} from 'lucide-react';
import {
  Badge, Button, Card, ErrorBanner, ModalBackdrop, MoneyDisplay,
  ProgressSteps, StatusBadge, Textarea,
} from '../components/ui';
import { useAuthStore } from '../stores/authStore';
import { useRadarStore } from '../stores/radarStore';
import { supabase } from '../lib/supabase';
import { playSuccessChime } from '../lib/audio';
import { triggerHapticNotification } from '../lib/haptics';
import { formatDay, addressLine, whatsappNumber, payoutFor } from '../lib/format';
import type { Booking } from '../types';

// ── Helpers ──────────────────────────────────────────────────────────────────
const STEPS = ['Accepted', 'On Way', 'In Work', 'Done'] as const;

function stepIndex(status: Booking['status']): number {
  switch (status) {
    case 'accepted':    return 0;
    case 'on_the_way':  return 1;
    case 'in_progress': return 2;
    case 'completed':   return 3;
    default:            return 0;
  }
}

// ── OTP Modal ────────────────────────────────────────────────────────────────
function OtpModal({
  onClose, onVerify, loading,
}: {
  onClose: () => void;
  onVerify: (otp: string) => Promise<void>;
  loading: boolean;
}) {
  const [otp, setOtp] = useState('');
  return (
    <ModalBackdrop onClose={onClose}>
      <div className="bg-card rounded-2xl p-5 space-y-4">
        {/* Icon + title */}
        <div className="flex flex-col items-center gap-2 pt-1">
          <div className="w-12 h-12 rounded-2xl bg-brand-soft border border-brand/20
                          flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-brand" />
          </div>
          <h3 className="text-base font-bold text-ink text-center">Enter Start OTP</h3>
          <p className="text-sm text-ink-3 text-center max-w-xs">
            Ask the customer for their 4-digit OTP to confirm you've arrived.
          </p>
        </div>

        {/* OTP input */}
        <input
          type="number"
          inputMode="numeric"
          maxLength={6}
          placeholder="- - - -"
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className="w-full text-3xl font-mono text-center tracking-widest py-4
                     bg-card-2 border border-line rounded-xl
                     focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15
                     text-ink placeholder:text-ink-4 transition-all"
        />

        {/* Buttons */}
        <div className="flex gap-2.5">
          <Button variant="secondary" full onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="success"
            full
            loading={loading}
            disabled={otp.length < 4}
            onClick={() => onVerify(otp)}
          >
            Verify
          </Button>
        </div>
      </div>
    </ModalBackdrop>
  );
}

// ── JobDetail ────────────────────────────────────────────────────────────────
export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { fetchMyJobs } = useRadarStore();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loadingBooking, setLoadingBooking] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Action states
  const [actionLoading, setActionLoading] = useState(false);
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);

  // Completion flow
  const [proofAfterFile, setProofAfterFile] = useState<File | null>(null);
  const [techNotes, setTechNotes] = useState('');
  const [showConfirmComplete, setShowConfirmComplete] = useState(false);
  const [completing, setCompleting] = useState(false);

  // Address copy feedback
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<number | null>(null);

  // ── Fetch booking ──────────────────────────────────────────────────────────
  const fetchBooking = useCallback(async (silent = false) => {
    if (!id) return;
    if (!silent) setLoadingBooking(true);
    const { data, error } = await supabase
      .from('bookings')
      .select('*, services(name, category, image_url), booking_items(id, quantity, unit_price, total_price, services(name, image_url))')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      setErrorMsg('Could not load job details. Please try again.');
    } else if (data) {
      setBooking(data as unknown as Booking);
    }
    setLoadingBooking(false);
  }, [id]);

  useEffect(() => {
    void fetchBooking();

    // Real-time listener for this booking — silent refresh on UPDATE
    const channel = supabase
      .channel(`booking-detail-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'bookings', filter: `id=eq.${id}` },
        () => void fetchBooking(true),
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchBooking, id]);

  // ── Action handlers ────────────────────────────────────────────────────────
  const handleStartTravel = async () => {
    if (!booking) return;
    setActionLoading(true);
    setErrorMsg(null);
    const { error } = await supabase.rpc('start_travel', { p_booking_id: booking.id });
    if (error) {
      setErrorMsg(error.message || 'Could not update status. Please try again.');
    } else {
      void fetchBooking(true);
      if (user?.id) void fetchMyJobs(user.id);
    }
    setActionLoading(false);
  };

  const handleVerifyOtp = async (otp: string) => {
    if (!booking) return;
    setOtpLoading(true);
    setErrorMsg(null);
    const { error } = await supabase.rpc('verify_start_otp', {
      p_booking_id: booking.id,
      p_otp: otp,
    });
    if (error) {
      setErrorMsg(error.message || 'Invalid OTP. Please check with the customer.');
    } else {
      setOtpModalOpen(false);
      void fetchBooking(true);
      if (user?.id) void fetchMyJobs(user.id);
    }
    setOtpLoading(false);
  };

  const handleCompleteJob = async () => {
    if (!booking) return;
    setCompleting(true);
    setErrorMsg(null);

    let proofUrl: string | null = null;

    // Upload proof photo if selected
    if (proofAfterFile && user?.id) {
      const ext = proofAfterFile.name.split('.').pop() ?? 'jpg';
      const path = `${user.id}/${booking.id}/after.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('job-proofs')
        .upload(path, proofAfterFile, { upsert: true });

      if (uploadError) {
        setErrorMsg('Photo upload failed. Please try again.');
        setCompleting(false);
        return;
      }
      const { data: urlData } = supabase.storage.from('job-proofs').getPublicUrl(path);
      proofUrl = urlData.publicUrl;
    }

    const { error } = await supabase.rpc('complete_booking_service', {
      p_booking_id: booking.id,
      p_proof_after_url: proofUrl,
      p_technician_notes: techNotes || null,
    });

    if (error) {
      setErrorMsg(error.message || 'Could not complete the job. Please try again.');
      setCompleting(false);
      return;
    }

    // Celebration
    void confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
    playSuccessChime();
    void triggerHapticNotification();

    void fetchBooking(true);
    if (user?.id) void fetchMyJobs(user.id);
    setShowConfirmComplete(false);
    setCompleting(false);
  };

  // ── Copy address ──────────────────────────────────────────────────────────
  const handleCopyAddress = () => {
    const addr = addressLine(booking?.address_snapshot);
    if (!addr) return;
    navigator.clipboard.writeText(addr).catch(() => {});
    setCopied(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = window.setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => () => {
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
  }, []);

  // ── Derived values ────────────────────────────────────────────────────────
  const snap = booking?.address_snapshot;
  const phone = snap?.phone ?? null;
  const fullAddr = addressLine(snap);
  const lat = snap?.latitude;
  const lng = snap?.longitude;
  const mapsUrl = lat && lng
    ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
    : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fullAddr)}`;

  const payout = booking ? payoutFor(booking) : 0;

  // ── Loading / error skeleton ───────────────────────────────────────────────
  if (loadingBooking) {
    return (
      <div className="p-4 space-y-4 max-w-lg mx-auto pb-safe animate-fade-up">
        <div className="flex items-center justify-between">
          <div className="skeleton h-9 w-9 rounded-xl" />
          <div className="skeleton h-6 w-28 rounded-full" />
          <div className="skeleton h-6 w-20 rounded-full" />
        </div>
        <div className="skeleton h-10 w-full rounded-xl" />
        <div className="skeleton h-40 w-full rounded-2xl" />
        <div className="skeleton h-32 w-full rounded-2xl" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="p-4 max-w-lg mx-auto pb-safe">
        <ErrorBanner
          message={errorMsg ?? 'Job not found.'}
          onRetry={() => void fetchBooking()}
        />
      </div>
    );
  }

  const currentStep = stepIndex(booking.status);
  const isCompleted = booking.status === 'completed';
  const isCancelled = booking.status === 'cancelled';

  return (
    <>
      <div className="p-4 space-y-4 max-w-lg mx-auto pb-safe">

        {/* ── Header row ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 animate-fade-up">
          <button
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className="rounded-xl bg-card-2 border border-line w-9 h-9 flex items-center
                       justify-center text-ink-2 hover:text-ink transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <span className="font-mono text-xs text-brand bg-brand-soft border border-brand/20
                           px-3 py-1 rounded-full">
            {booking.booking_ref}
          </span>

          <StatusBadge status={booking.status} />
        </div>

        {/* ── Progress steps (only if not cancelled) ─────────────────────── */}
        {!isCancelled && (
          <div className="animate-fade-up stagger-1">
            <ProgressSteps steps={[...STEPS]} current={currentStep} />
          </div>
        )}

        {/* ── Customer destination card ─────────────────────────────────── */}
        <Card className="p-4 space-y-3 animate-fade-up stagger-2">
          {/* Header: label + scheduling info */}
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs text-ink-3 font-medium uppercase tracking-wide">
              Customer destination
            </span>
            <div className="flex items-center gap-1.5 text-xs text-ink-3 shrink-0">
              <CalendarDays className="w-3.5 h-3.5" />
              <span>{formatDay(booking.scheduled_date)} · {booking.scheduled_time?.slice(0, 5)}</span>
            </div>
          </div>

          {/* Full address — selectable text */}
          <p className="text-sm text-ink leading-relaxed select-text">
            {fullAddr || 'Address not available'}
          </p>

          {/* Landmark */}
          {snap?.landmark && (
            <p className="text-xs text-warn bg-warn-soft rounded-lg px-3 py-1.5">
              Landmark: {snap.landmark}
            </p>
          )}

          {/* Copy address */}
          <button
            onClick={handleCopyAddress}
            className="flex items-center gap-1.5 text-sm text-brand font-semibold min-h-10
                       transition-colors hover:text-brand/80"
          >
            {copied
              ? <><Check className="w-4 h-4" />Copied!</>
              : <><Copy className="w-4 h-4" />Copy address</>
            }
          </button>

          {/* Action grid: Navigate · Call · WhatsApp */}
          <div className="grid grid-cols-3 gap-2.5">
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl p-3 flex flex-col items-center gap-1.5
                         text-xs font-semibold border
                         bg-brand-soft border-brand/25 text-brand
                         active:scale-[0.97] transition-transform"
            >
              <Navigation className="w-5 h-5" />
              Navigate
            </a>

            {phone ? (
              <a
                href={`tel:${phone}`}
                className="rounded-xl p-3 flex flex-col items-center gap-1.5
                           text-xs font-semibold border
                           bg-money-soft border-money/25 text-money
                           active:scale-[0.97] transition-transform"
              >
                <Phone className="w-5 h-5" />
                Call
              </a>
            ) : (
              <div className="rounded-xl p-3 flex flex-col items-center gap-1.5
                              text-xs font-semibold border border-line
                              bg-card-2 text-ink-4 cursor-not-allowed opacity-50">
                <Phone className="w-5 h-5" />
                Call
              </div>
            )}

            {phone ? (
              <a
                href={`https://wa.me/${whatsappNumber(phone)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl p-3 flex flex-col items-center gap-1.5
                           text-xs font-semibold border
                           bg-info-soft border-info/25 text-info
                           active:scale-[0.97] transition-transform"
              >
                <MessageCircle className="w-5 h-5" />
                WhatsApp
              </a>
            ) : (
              <div className="rounded-xl p-3 flex flex-col items-center gap-1.5
                              text-xs font-semibold border border-line
                              bg-card-2 text-ink-4 cursor-not-allowed opacity-50">
                <MessageCircle className="w-5 h-5" />
                WhatsApp
              </div>
            )}
          </div>
        </Card>

        {/* ── Services breakdown card ───────────────────────────────────── */}
        <Card className="p-4 space-y-3 animate-fade-up stagger-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-ink-3 font-medium uppercase tracking-wide">
              Services ordered
            </span>
            <span className="text-sm font-semibold text-money flex items-center gap-1">
              You earn <MoneyDisplay amount={payout} size="sm" tone="money" />
            </span>
          </div>

          {booking.booking_items && booking.booking_items.length > 0 ? (
            <div className="space-y-2">
              {booking.booking_items.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-2">
                  <span className="text-sm text-ink flex-1">
                    {item.services?.name ?? 'Service'}
                    {item.quantity > 1 && (
                      <span className="text-ink-3 ml-1">× {item.quantity}</span>
                    )}
                  </span>
                  <span className="text-sm font-semibold text-ink-2 shrink-0">
                    ₹{item.total_price.toLocaleString('en-IN')}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-ink">{booking.services?.name ?? 'Service'}</span>
              <span className="text-sm font-semibold text-ink-2">
                ₹{booking.subtotal.toLocaleString('en-IN')}
              </span>
            </div>
          )}

          {/* Special instructions */}
          {booking.special_instructions && (
            <div className="rounded-xl bg-warn-soft border border-warn/20 px-3 py-2.5">
              <p className="text-xs font-semibold text-warn mb-1">Special instructions</p>
              <p className="text-sm text-ink">{booking.special_instructions}</p>
            </div>
          )}
        </Card>

        {/* ── Error banner ─────────────────────────────────────────────── */}
        {errorMsg && (
          <ErrorBanner
            message={errorMsg}
            onRetry={() => setErrorMsg(null)}
            className="animate-fade-up"
          />
        )}

        {/* ── Action area ───────────────────────────────────────────────── */}
        {!isCompleted && !isCancelled && (
          <div className="space-y-3 animate-fade-up stagger-4">

            {/* accepted → start travel */}
            {booking.status === 'accepted' && (
              <Button
                variant="primary"
                size="lg"
                full
                loading={actionLoading}
                icon={<Navigation className="w-5 h-5" />}
                onClick={handleStartTravel}
              >
                I'm heading there
              </Button>
            )}

            {/* on_the_way → enter OTP */}
            {booking.status === 'on_the_way' && (
              <>
                <Button
                  size="lg"
                  full
                  onClick={() => setOtpModalOpen(true)}
                  className="bg-money-soft border border-money text-money
                             min-h-14 rounded-2xl text-base font-semibold
                             inline-flex items-center justify-center gap-2.5
                             active:scale-[0.97] transition-all"
                >
                  <ShieldCheck className="w-5 h-5" />
                  I've Arrived · Enter OTP
                </Button>
                <p className="text-xs text-ink-3 text-center">
                  Ask the customer for their one-time password to start the job.
                </p>
              </>
            )}

            {/* in_progress → complete */}
            {booking.status === 'in_progress' && (
              <Card className="p-4 space-y-4">
                <p className="text-sm font-semibold text-ink">Complete the job</p>

                {/* Photo proof upload */}
                <label className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed
                                  border-line hover:border-brand/50 transition-colors py-5 px-4
                                  cursor-pointer text-center">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="sr-only"
                    onChange={(e) => setProofAfterFile(e.target.files?.[0] ?? null)}
                  />
                  {proofAfterFile ? (
                    <>
                      <Check className="w-6 h-6 text-money" />
                      <span className="text-sm text-money font-semibold">{proofAfterFile.name}</span>
                      <span className="text-xs text-ink-3">Tap to change</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-6 h-6 text-ink-3" />
                      <span className="text-sm font-semibold text-ink">Upload proof photo</span>
                      <span className="text-xs text-ink-3">After-work photo (recommended)</span>
                    </>
                  )}
                </label>

                {/* Technician notes */}
                <Textarea
                  label="Notes (optional)"
                  placeholder="Describe what was done, parts replaced, etc."
                  rows={3}
                  value={techNotes}
                  onChange={(e) => setTechNotes(e.target.value)}
                />

                {/* Two-step completion */}
                {!showConfirmComplete ? (
                  <Button
                    variant="success"
                    size="lg"
                    full
                    icon={<CheckCircle2 className="w-5 h-5" />}
                    onClick={() => setShowConfirmComplete(true)}
                  >
                    Complete Job
                  </Button>
                ) : (
                  <div className="rounded-2xl bg-money-soft border border-money/30 p-4 space-y-3">
                    <p className="text-sm font-semibold text-ink text-center">
                      Confirm job completion?
                    </p>
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="text-xs text-ink-3">You'll earn</span>
                      <MoneyDisplay amount={payout} size="md" tone="money" />
                    </div>
                    <div className="flex gap-2.5">
                      <Button
                        variant="ghost"
                        full
                        onClick={() => setShowConfirmComplete(false)}
                        disabled={completing}
                      >
                        Not yet
                      </Button>
                      <Button
                        variant="success"
                        full
                        loading={completing}
                        onClick={handleCompleteJob}
                      >
                        Yes, complete
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            )}
          </div>
        )}

        {/* ── Completed banner ──────────────────────────────────────────── */}
        {isCompleted && (
          <Card variant="money" className="p-5 space-y-3 animate-scale-in">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="w-14 h-14 rounded-2xl bg-money-soft border border-money/30
                              flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-money" />
              </div>
              <p className="text-base font-bold text-ink">Job Completed!</p>
              <p className="text-sm text-ink-3">Your earnings have been credited to your wallet.</p>
              <MoneyDisplay amount={payout} size="xl" tone="money" />
            </div>
            <Button
              variant="success"
              full
              icon={<Wallet className="w-4 h-4" />}
              onClick={() => navigate('/wallet')}
            >
              View Wallet
            </Button>
          </Card>
        )}

        {/* ── Cancelled notice ─────────────────────────────────────────── */}
        {isCancelled && (
          <div className="rounded-2xl bg-danger-soft border border-danger/20 p-4 text-center">
            <p className="text-sm font-semibold text-danger">This booking was cancelled.</p>
          </div>
        )}

      </div>

      {/* ── OTP Modal ─────────────────────────────────────────────────── */}
      {otpModalOpen && (
        <OtpModal
          onClose={() => setOtpModalOpen(false)}
          onVerify={handleVerifyOtp}
          loading={otpLoading}
        />
      )}
    </>
  );
}
