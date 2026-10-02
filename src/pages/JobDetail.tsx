import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import confetti from 'canvas-confetti';
import {
  ArrowLeft, Navigation, Phone, MessageCircle, Copy, Check, Camera,
  CalendarDays, MapPin, ShieldCheck, CheckCircle2, Wallet, X, UploadCloud,
  Eye, AlertCircle, PlayCircle, Image as ImageIcon,
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
    case 'assigned':
    case 'accepted':    return 0;
    case 'on_the_way':  return 1;
    case 'in_progress': return 2;
    case 'completed':   return 3;
    default:            return 0;
  }
}

// ── OTP Modal ────────────────────────────────────────────────────────────────
function OtpModal({
  onClose, onVerify, onSkip, loading,
}: {
  onClose: () => void;
  onVerify: (otp: string) => Promise<void>;
  onSkip?: () => Promise<void>;
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

        {onSkip && (
          <div className="pt-2 border-t border-line text-center">
            <button
              type="button"
              disabled={loading}
              onClick={onSkip}
              className="text-xs text-ink-3 hover:text-ink underline transition-colors"
            >
              Customer has no OTP? Start Work Directly
            </button>
          </div>
        )}
      </div>
    </ModalBackdrop>
  );
}

// ── Photo Box Component ──────────────────────────────────────────────────────
function PhotoUploaderBox({
  label,
  subtitle,
  previewUrl,
  file,
  onFileSelect,
  onClear,
  onPreviewClick,
}: {
  label: string;
  subtitle: string;
  previewUrl: string | null;
  file: File | null;
  onFileSelect: (f: File) => void;
  onClear: () => void;
  onPreviewClick?: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="rounded-xl border border-line bg-card-2 p-3.5 space-y-2.5 flex-1 min-w-[140px]">
      <div className="flex items-center justify-between gap-1">
        <div>
          <p className="text-xs font-bold text-ink leading-tight">{label}</p>
          <p className="text-[11px] text-ink-3 leading-tight">{subtitle}</p>
        </div>
        {previewUrl && (
          <Badge tone="money" className="text-[10px] px-1.5 py-0 shrink-0">
            Selected
          </Badge>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFileSelect(f);
        }}
      />

      {previewUrl ? (
        <div className="relative group rounded-lg overflow-hidden border border-line bg-black/5 aspect-[4/3]">
          <img
            src={previewUrl}
            alt={label}
            className="w-full h-full object-cover cursor-pointer"
            onClick={onPreviewClick}
          />
          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={onPreviewClick}
              className="p-1.5 rounded-lg bg-black/60 text-white hover:bg-black/80"
              title="Preview"
            >
              <Eye className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 rounded-lg bg-black/60 text-white hover:bg-black/80"
              title="Change Photo"
            >
              <Camera className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClear}
              className="p-1.5 rounded-lg bg-danger/80 text-white hover:bg-danger"
              title="Remove"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="absolute bottom-1 right-1 bg-black/60 backdrop-blur-sm rounded px-1.5 py-0.5 text-[9px] text-white font-mono">
            {file ? file.name.slice(0, 12) + '…' : 'Saved'}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full aspect-[4/3] rounded-lg border-2 border-dashed border-line hover:border-brand/50
                     bg-card flex flex-col items-center justify-center gap-1.5 p-2
                     text-ink-3 hover:text-brand transition-colors cursor-pointer group"
        >
          <div className="w-8 h-8 rounded-full bg-brand-soft border border-brand/20 flex items-center justify-center text-brand group-hover:scale-110 transition-transform">
            <Camera className="w-4 h-4" />
          </div>
          <span className="text-[11px] font-semibold text-ink">Take / Select</span>
          <span className="text-[9px] text-ink-3">Camera or gallery</span>
        </button>
      )}
    </div>
  );
}

// ── JobDetail Page ───────────────────────────────────────────────────────────
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

  // Dual photo proofs
  const [proofBeforeFile, setProofBeforeFile] = useState<File | null>(null);
  const [proofBeforePreview, setProofBeforePreview] = useState<string | null>(null);
  const [savingBefore, setSavingBefore] = useState(false);

  const [proofAfterFile, setProofAfterFile] = useState<File | null>(null);
  const [proofAfterPreview, setProofAfterPreview] = useState<string | null>(null);

  // Notes & completion
  const [techNotes, setTechNotes] = useState('');
  const [showConfirmComplete, setShowConfirmComplete] = useState(false);
  const [completing, setCompleting] = useState(false);

  // Image lightbox preview
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

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
      const b = data as unknown as Booking;
      setBooking(b);
      // Synchronize existing photos & notes if already saved in db
      if (b.proof_before_url && !proofBeforePreview) {
        setProofBeforePreview(b.proof_before_url);
      }
      if (b.proof_after_url && !proofAfterPreview) {
        setProofAfterPreview(b.proof_after_url);
      }
      if (b.technician_notes && !techNotes) {
        setTechNotes(b.technician_notes);
      }
    }
    setLoadingBooking(false);
  }, [id, proofBeforePreview, proofAfterPreview, techNotes]);

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

  // ── Photo handlers ─────────────────────────────────────────────────────────
  const handleSelectBeforeFile = (file: File) => {
    setProofBeforeFile(file);
    const url = URL.createObjectURL(file);
    setProofBeforePreview(url);
  };

  const handleClearBefore = () => {
    setProofBeforeFile(null);
    setProofBeforePreview(null);
  };

  const handleSelectAfterFile = (file: File) => {
    setProofAfterFile(file);
    const url = URL.createObjectURL(file);
    setProofAfterPreview(url);
  };

  const handleClearAfter = () => {
    setProofAfterFile(null);
    setProofAfterPreview(null);
  };

  // Quick save of before photo while on-site
  const handleSaveBeforePhotoOnly = async () => {
    if (!booking || !user?.id || !proofBeforeFile) return;
    setSavingBefore(true);
    setErrorMsg(null);
    try {
      const ext = proofBeforeFile.name.split('.').pop() ?? 'jpg';
      const path = `${user.id}/${booking.id}/before_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('job-proofs')
        .upload(path, proofBeforeFile, { upsert: true });

      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('job-proofs').getPublicUrl(path);
      const publicUrl = urlData.publicUrl;

      const { error: dbErr } = await supabase
        .from('bookings')
        .update({ proof_before_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', booking.id);
      if (dbErr) throw dbErr;

      setProofBeforePreview(publicUrl);
      setProofBeforeFile(null);
      void fetchBooking(true);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save before photo.');
    } finally {
      setSavingBefore(false);
    }
  };

  // ── Action handlers ────────────────────────────────────────────────────────
  const handleStartTravel = async () => {
    if (!booking) return;
    setActionLoading(true);
    setErrorMsg(null);
    const { data, error } = await supabase.rpc('start_travel', { p_booking_id: booking.id });
    const res = data as { success: boolean; message: string } | null;

    if (error || (res && !res.success)) {
      // Resilient fallback: direct update if RPC fails due to status='assigned'
      const { error: directErr } = await supabase
        .from('bookings')
        .update({ status: 'on_the_way', updated_at: new Date().toISOString() })
        .eq('id', booking.id)
        .eq('technician_id', user?.id)
        .in('status', ['accepted', 'assigned']);

      if (directErr) {
        setErrorMsg(error?.message || res?.message || 'Could not update status. Please try again.');
        setActionLoading(false);
        return;
      }
    }

    void fetchBooking(true);
    if (user?.id) void fetchMyJobs(user.id);
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

  // Direct start work (bypass OTP)
  const handleDirectStartWork = async () => {
    if (!booking || !user?.id) return;
    setActionLoading(true);
    setErrorMsg(null);
    setOtpModalOpen(false);
    try {
      const { error } = await supabase
        .from('bookings')
        .update({
          status: 'in_progress',
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.id);

      if (error) throw error;
      void fetchBooking(true);
      void fetchMyJobs(user.id);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not start work.');
    } finally {
      setActionLoading(false);
    }
  };

  // Complete job with before & after photos
  const handleCompleteJob = async () => {
    if (!booking || !user?.id) return;
    setCompleting(true);
    setErrorMsg(null);

    const payout = payoutFor(booking);

    try {
      let finalBeforeUrl = booking.proof_before_url ?? null;
      let finalAfterUrl = booking.proof_after_url ?? null;

      // 1. Upload before photo if selected
      if (proofBeforeFile) {
        const ext = proofBeforeFile.name.split('.').pop() ?? 'jpg';
        const path = `${user.id}/${booking.id}/before_${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('job-proofs')
          .upload(path, proofBeforeFile, { upsert: true });

        if (upErr) throw new Error('Before photo upload failed: ' + upErr.message);
        const { data: uData } = supabase.storage.from('job-proofs').getPublicUrl(path);
        finalBeforeUrl = uData.publicUrl;
      }

      // 2. Upload after photo if selected
      if (proofAfterFile) {
        const ext = proofAfterFile.name.split('.').pop() ?? 'jpg';
        const path = `${user.id}/${booking.id}/after_${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('job-proofs')
          .upload(path, proofAfterFile, { upsert: true });

        if (upErr) throw new Error('After photo upload failed: ' + upErr.message);
        const { data: uData } = supabase.storage.from('job-proofs').getPublicUrl(path);
        finalAfterUrl = uData.publicUrl;
      }

      // 3. Try calling DB RPC with correct parameter names
      try {
        await supabase.rpc('complete_booking_service', {
          p_booking_id: booking.id,
          p_notes: techNotes || null,
          p_proof_after_url: finalAfterUrl,
        });
      } catch {
        // Continue to resilient fallback
      }

      // 4. Resilient direct update on bookings (guarantees status, both photos, notes, and earnings)
      const nowIso = new Date().toISOString();
      const { error: bookErr } = await supabase
        .from('bookings')
        .update({
          status: 'completed',
          proof_before_url: finalBeforeUrl,
          proof_after_url: finalAfterUrl,
          technician_notes: techNotes || null,
          completed_at: nowIso,
          technician_earnings: payout,
          updated_at: nowIso,
        })
        .eq('id', booking.id);

      if (bookErr) throw bookErr;

      // 5. Update technician wallet balance & completed job count
      if (payout > 0) {
        const { data: tp } = await supabase
          .from('technician_profiles')
          .select('wallet_balance, total_completed_jobs')
          .eq('id', user.id)
          .maybeSingle();

        if (tp) {
          await supabase
            .from('technician_profiles')
            .update({
              wallet_balance: (Number(tp.wallet_balance) || 0) + payout,
              total_completed_jobs: (Number(tp.total_completed_jobs) || 0) + 1,
              updated_at: nowIso,
            })
            .eq('id', user.id);
        }

        // Record payout transaction if not already logged
        const { data: existingPayout } = await supabase
          .from('technician_payouts')
          .select('id')
          .eq('booking_id', booking.id)
          .eq('technician_id', user.id)
          .maybeSingle();

        if (!existingPayout) {
          await supabase.from('technician_payouts').insert({
            technician_id: user.id,
            booking_id: booking.id,
            type: 'job_payout',
            amount: payout,
            status: 'paid',
            notes: `Earnings for booking #${booking.booking_ref}`,
          });
        }
      }

      // 6. Notify customer
      if (booking.customer_id) {
        await supabase.from('notifications').insert({
          user_id: booking.customer_id,
          title: 'Job Completed',
          body: `Your booking #${booking.booking_ref} has been marked complete by the technician.`,
          type: 'booking',
          booking_id: booking.id,
        });
      }

      // 7. Celebrate
      void confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
      playSuccessChime();
      void triggerHapticNotification();

      void fetchBooking(true);
      void fetchMyJobs(user.id);
      setShowConfirmComplete(false);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not complete the job. Please try again.');
    } finally {
      setCompleting(false);
    }
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
  const canDirectComplete = !isCompleted && !isCancelled;

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
                           px-3 py-1 rounded-full font-bold">
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
          <p className="text-sm text-ink leading-relaxed select-text font-medium">
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
          <div className="space-y-4 animate-fade-up stagger-4">

            {/* Step 1: accepted or assigned → start travel or start work */}
            {(booking.status === 'accepted' || booking.status === 'assigned') && (
              <div className="space-y-2.5">
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
                <button
                  type="button"
                  onClick={handleDirectStartWork}
                  disabled={actionLoading}
                  className="w-full text-center text-xs text-ink-3 hover:text-ink font-medium py-1 transition-colors"
                >
                  Already at location? Start Work Directly
                </button>
              </div>
            )}

            {/* Step 2: on_the_way → enter OTP or start work */}
            {booking.status === 'on_the_way' && (
              <div className="space-y-2.5">
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
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs text-ink-3">Ask customer for start OTP</span>
                  <button
                    type="button"
                    onClick={handleDirectStartWork}
                    disabled={actionLoading}
                    className="text-xs text-brand hover:text-brand/80 font-semibold"
                  >
                    Bypass OTP & Start Work →
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Job completion card with Before & After photo uploads */}
            {canDirectComplete && (
              <Card className="p-4 space-y-4 border-2 border-line">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-money-soft border border-money/30 flex items-center justify-center text-money">
                      <CheckCircle2 className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-ink">Mark Job as Complete</p>
                      <p className="text-xs text-ink-3">Attach before & after work photos</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-money">
                    +{/* Payout badge */}
                    ₹{payout.toLocaleString('en-IN')}
                  </span>
                </div>

                {/* Dual photo uploaders */}
                <div className="flex flex-col sm:flex-row gap-3">
                  {/* Before photo */}
                  <PhotoUploaderBox
                    label="Before Photo"
                    subtitle="Initial problem photo"
                    previewUrl={proofBeforePreview}
                    file={proofBeforeFile}
                    onFileSelect={handleSelectBeforeFile}
                    onClear={handleClearBefore}
                    onPreviewClick={() => setLightboxUrl(proofBeforePreview)}
                  />

                  {/* After photo */}
                  <PhotoUploaderBox
                    label="After Photo"
                    subtitle="Finished repair photo"
                    previewUrl={proofAfterPreview}
                    file={proofAfterFile}
                    onFileSelect={handleSelectAfterFile}
                    onClear={handleClearAfter}
                    onPreviewClick={() => setLightboxUrl(proofAfterPreview)}
                  />
                </div>

                {/* Quick save button for before photo if chosen and not completed yet */}
                {proofBeforeFile && !booking.proof_before_url && (
                  <Button
                    variant="secondary"
                    size="sm"
                    full
                    loading={savingBefore}
                    icon={<UploadCloud className="w-4 h-4" />}
                    onClick={handleSaveBeforePhotoOnly}
                  >
                    Save Before Photo Now
                  </Button>
                )}

                {/* Technician notes */}
                <Textarea
                  label="Technician Notes (optional)"
                  placeholder="Describe work performed, parts replaced, or customer remarks..."
                  rows={2}
                  value={techNotes}
                  onChange={(e) => setTechNotes(e.target.value)}
                />

                {/* Two-step completion confirmation */}
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
                      Confirm complete booking #{booking.booking_ref}?
                    </p>
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="text-xs text-ink-3">Your wallet will be credited</span>
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
                        Yes, Complete Job
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            )}
          </div>
        )}

        {/* ── Completed banner with photos ───────────────────────────────── */}
        {isCompleted && (
          <Card variant="money" className="p-5 space-y-4 animate-scale-in">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="w-14 h-14 rounded-2xl bg-money-soft border border-money/30
                              flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-money" />
              </div>
              <p className="text-base font-bold text-ink">Job Completed!</p>
              <p className="text-sm text-ink-3">Your earnings have been credited to your wallet.</p>
              <MoneyDisplay amount={payout} size="xl" tone="money" />
            </div>

            {/* Display Before & After photos side-by-side if available */}
            {(booking.proof_before_url || booking.proof_after_url || proofBeforePreview || proofAfterPreview) && (
              <div className="pt-3 border-t border-money/20 space-y-2">
                <p className="text-xs font-bold text-ink uppercase tracking-wider">
                  Work Verification Proof
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {/* Before */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-ink-3">Before</span>
                    {booking.proof_before_url || proofBeforePreview ? (
                      <div
                        className="rounded-xl overflow-hidden border border-line aspect-[4/3] bg-card cursor-pointer"
                        onClick={() => setLightboxUrl(booking.proof_before_url || proofBeforePreview)}
                      >
                        <img
                          src={booking.proof_before_url || proofBeforePreview || ''}
                          alt="Before Work"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-line aspect-[4/3] flex items-center justify-center text-ink-4 text-xs">
                        No photo
                      </div>
                    )}
                  </div>

                  {/* After */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-ink-3">After</span>
                    {booking.proof_after_url || proofAfterPreview ? (
                      <div
                        className="rounded-xl overflow-hidden border border-line aspect-[4/3] bg-card cursor-pointer"
                        onClick={() => setLightboxUrl(booking.proof_after_url || proofAfterPreview)}
                      >
                        <img
                          src={booking.proof_after_url || proofAfterPreview || ''}
                          alt="After Work"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-line aspect-[4/3] flex items-center justify-center text-ink-4 text-xs">
                        No photo
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Technician notes if recorded */}
            {(booking.technician_notes || techNotes) && (
              <div className="rounded-xl bg-card p-3 border border-line text-left">
                <p className="text-[11px] font-semibold text-ink-3">Technician Notes</p>
                <p className="text-xs text-ink mt-0.5">{booking.technician_notes || techNotes}</p>
              </div>
            )}

            <div className="flex gap-2.5 pt-1">
              <Button
                variant="secondary"
                full
                onClick={() => navigate('/')}
              >
                Dashboard
              </Button>
              <Button
                variant="success"
                full
                icon={<Wallet className="w-4 h-4" />}
                onClick={() => navigate('/wallet')}
              >
                View Wallet
              </Button>
            </div>
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
          onSkip={handleDirectStartWork}
          loading={otpLoading || actionLoading}
        />
      )}

      {/* ── Fullscreen Image Lightbox Modal ────────────────────────────── */}
      {lightboxUrl && (
        <ModalBackdrop onClose={() => setLightboxUrl(null)}>
          <div className="relative max-w-sm w-full bg-black rounded-2xl overflow-hidden p-2">
            <button
              onClick={() => setLightboxUrl(null)}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/60 text-white hover:bg-black"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={lightboxUrl}
              alt="Enlarged proof"
              className="w-full max-h-[70vh] object-contain rounded-xl"
            />
          </div>
        </ModalBackdrop>
      )}
    </>
  );
}
