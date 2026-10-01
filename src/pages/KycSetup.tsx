import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Zap, Wrench, Droplets, Hammer, Paintbrush2, Sparkles, Bug,
  Upload, Hash, IndianRupee, ShieldCheck, CheckCircle2,
} from 'lucide-react';
import { Button, Chip, ErrorBanner, Input, Select } from '../components/ui';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';
import { triggerHapticImpact } from '../lib/haptics';
import { ImpactStyle } from '@capacitor/haptics';

/* ─── Trade catalogue (Title Case to match DB categories) ───────── */
const TRADES = [
  { id: 'Electrical',       label: 'Electrical',       icon: <Zap className="w-4 h-4" /> },
  { id: 'Appliance Repair', label: 'Appliance Repair', icon: <Wrench className="w-4 h-4" /> },
  { id: 'Plumbing',         label: 'Plumbing',         icon: <Droplets className="w-4 h-4" /> },
  { id: 'Carpentry',        label: 'Carpentry',        icon: <Hammer className="w-4 h-4" /> },
  { id: 'Painting',         label: 'Painting',         icon: <Paintbrush2 className="w-4 h-4" /> },
  { id: 'Cleaning',         label: 'Cleaning',         icon: <Sparkles className="w-4 h-4" /> },
  { id: 'Pest Control',     label: 'Pest Control',     icon: <Bug className="w-4 h-4" /> },
] as const;

/* ─── ID type validators ──────────────────────────────────────── */
const ID_PATTERNS: Record<string, RegExp | null> = {
  Aadhaar:           /^\d{12}$/,
  PAN:               /^[A-Z]{5}\d{4}[A-Z]{1}$/,
  'Driving License': null,
  'Voter ID':        null,
};

const UPI_RE = /^[\w.\-]{2,}@[a-zA-Z]{2,}$/;

/* ─── Section dot indicator ──────────────────────────────────────*/
function StepDots({ total, active }: { total: number; active: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`block rounded-full transition-all duration-300 ${
            i === active
              ? 'w-4 h-2 bg-brand'
              : i < active
              ? 'w-2 h-2 bg-brand/40'
              : 'w-2 h-2 bg-line'
          }`}
        />
      ))}
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────── */
export default function KycSetup() {
  const navigate = useNavigate();
  const { user, technicianProfile, isLoading, fetchProfiles } = useAuthStore();

  // ── Form state ────────────────────────────────────────────────
  const [selectedTrades, setSelectedTrades] = useState<string[]>(
    technicianProfile?.skills && technicianProfile.skills.length > 0
      ? technicianProfile.skills
      : ['Electrical']
  );
  const [experience, setExperience]         = useState(technicianProfile?.experience_years || 3);
  const [idType, setIdType]                 = useState(technicianProfile?.id_type || 'Aadhaar');
  const [idNumber, setIdNumber]             = useState(technicianProfile?.id_number || '');
  const [idFile, setIdFile]                 = useState<File | null>(null);
  const [upi, setUpi]                       = useState(technicianProfile?.bank_upi_id || '');
  const [submitting, setSubmitting]         = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const [activeSection]                     = useState(0);

  // Field-level errors
  const [idErr, setIdErr]   = useState('');
  const [upiErr, setUpiErr] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Session guard: wait for auth initialization, don't prematurely redirect
  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/login', { replace: true });
    }
  }, [user, isLoading, navigate]);

  // ── Validation helpers ────────────────────────────────────────
  function validateId(type: string, value: string): string {
    const raw = value.replace(/[\s-]/g, '').toUpperCase();
    const pat = ID_PATTERNS[type];
    if (!pat) return '';
    if (!pat.test(raw)) {
      return type === 'Aadhaar'
        ? 'Aadhaar must be exactly 12 digits'
        : type === 'PAN'
        ? 'PAN must match ABCDE1234F format'
        : '';
    }
    return '';
  }

  function validateUpi(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return 'UPI ID is required';
    if (!UPI_RE.test(trimmed)) return 'Enter a valid UPI ID (e.g. name@okhdfcbank)';
    return '';
  }

  // ── Submit ────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    void triggerHapticImpact(ImpactStyle.Light);

    if (selectedTrades.length === 0) {
      setError('Please select at least one trade specialty.');
      void triggerHapticImpact(ImpactStyle.Heavy);
      return;
    }

    const idErrMsg = validateId(idType, idNumber);
    const upiErrMsg = validateUpi(upi);
    setIdErr(idErrMsg);
    setUpiErr(upiErrMsg);
    if (idErrMsg || upiErrMsg) {
      void triggerHapticImpact(ImpactStyle.Heavy);
      return;
    }

    setSubmitting(true);
    try {
      // 0. Ensure active session
      const { data: { session } } = await supabase.auth.getSession();
      const activeUser = session?.user || user;
      if (!activeUser) {
        setError('No active session. Please sign in again.');
        navigate('/login', { replace: true });
        return;
      }

      let documentUrl: string | null = technicianProfile?.id_document_url || null;

      // 1. Upload ID document to private 'kyc-documents' bucket
      if (idFile) {
        const fileExt = idFile.name.split('.').pop() || 'jpg';
        const filePath = `${activeUser.id}/${Date.now()}.${fileExt}`;

        const { error: uploadErr } = await supabase.storage
          .from('kyc-documents')
          .upload(filePath, idFile, { upsert: true });

        if (uploadErr) {
          throw new Error('Failed to upload ID photo: ' + uploadErr.message);
        }
        documentUrl = filePath;
      }

      if (!documentUrl) {
        setError('Please upload a photo of your ID document.');
        void triggerHapticImpact(ImpactStyle.Heavy);
        return;
      }

      // 2. Call save_technician_kyc RPC
      const cleanId = idNumber.replace(/[\s-]/g, '').toUpperCase();
      const cleanUpi = upi.trim();

      const { data: rpcData, error: rpcError } = await supabase.rpc('save_technician_kyc', {
        p_skills:           selectedTrades,
        p_experience_years: experience,
        p_id_type:          idType,
        p_id_number:        cleanId,
        p_id_document_url:  documentUrl,
        p_bank_upi_id:      cleanUpi,
      });

      if (rpcError) throw rpcError;

      if (rpcData && !rpcData.success) {
        setError(rpcData.message || 'Registration failed. Please try again.');
        void triggerHapticImpact(ImpactStyle.Heavy);
        return;
      }

      void triggerHapticImpact(ImpactStyle.Medium);
      await fetchProfiles(activeUser.id);
      navigate('/kyc-pending', { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save KYC configuration';
      setError(msg);
      void triggerHapticImpact(ImpactStyle.Heavy);
    } finally {
      setSubmitting(false);
    }
  }

  const toggleTrade = (id: string) => {
    void triggerHapticImpact(ImpactStyle.Light);
    setSelectedTrades((prev) =>
      prev.includes(id)
        ? (prev.length > 1 ? prev.filter((t) => t !== id) : prev) // keep at least 1
        : [...prev, id]
    );
  };

  return (
    <div className="min-h-dvh bg-bg text-ink p-5 max-w-lg mx-auto pb-safe">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="pt-safe flex items-start justify-between mb-8 animate-fade-up">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-brand-soft border border-brand/30 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-brand" />
          </div>
          <div>
            <p className="text-xs font-mono text-brand uppercase tracking-wider">Setup Your Profile</p>
            <h1 className="font-display text-2xl font-bold text-ink leading-tight">
              Trades &amp; Verification
            </h1>
            <p className="text-sm text-ink-3 mt-0.5">
              Complete once — verified within 24 hours.
            </p>
          </div>
        </div>
        <StepDots total={4} active={activeSection} />
      </div>

      {error && <ErrorBanner message={error} className="mb-5 animate-fade-up stagger-1" />}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ── Section 1: Trades ───────────────────────────────────── */}
        <div className="space-y-3 animate-fade-up stagger-1">
          <div>
            <p className="text-xs font-mono text-brand uppercase tracking-wider mb-0.5">Section 1</p>
            <h2 className="text-base font-semibold text-ink">Your Specialties</h2>
            <p className="text-sm text-ink-3">Select the trade categories you service.</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {TRADES.map((t) => (
              <Chip
                key={t.id}
                label={t.label}
                icon={t.icon}
                selected={selectedTrades.includes(t.id)}
                onClick={() => toggleTrade(t.id)}
              />
            ))}
          </div>
          {selectedTrades.length > 0 && (
            <p className="text-xs text-brand font-medium">
              {selectedTrades.length} trade{selectedTrades.length > 1 ? 's' : ''} selected
            </p>
          )}
        </div>

        {/* ── Section 2: Experience ───────────────────────────────── */}
        <div className="space-y-3 animate-fade-up stagger-2">
          <div>
            <p className="text-xs font-mono text-brand uppercase tracking-wider mb-0.5">Section 2</p>
            <h2 className="text-base font-semibold text-ink">Years of Experience</h2>
          </div>
          <div className="bg-card rounded-2xl border border-line p-4 space-y-4">
            <div className="flex items-end justify-between">
              <p className="text-sm text-ink-2">Experience level</p>
              <div className="text-right">
                <span className="font-mono text-3xl font-bold text-brand">{experience}</span>
                <span className="text-sm text-ink-3 ml-1">yr{experience !== 1 ? 's' : ''}</span>
              </div>
            </div>
            <input
              type="range"
              min={1}
              max={15}
              step={1}
              value={experience}
              onChange={(e) => setExperience(Number(e.target.value))}
              className="w-full accent-[var(--color-brand)] cursor-pointer"
            />
            <div className="flex justify-between text-xs text-ink-4 font-mono">
              <span>1 yr</span>
              <span>15 yrs</span>
            </div>
          </div>
        </div>

        {/* ── Section 3: Government ID ────────────────────────────── */}
        <div className="space-y-3 animate-fade-up stagger-3">
          <div>
            <p className="text-xs font-mono text-brand uppercase tracking-wider mb-0.5">Section 3</p>
            <h2 className="text-base font-semibold text-ink">Government ID Verification</h2>
            <p className="text-sm text-ink-3">Required for security and partner badge verification.</p>
          </div>
          <div className="bg-card rounded-2xl border border-line p-4 space-y-4">
            <Select
              label="ID Document Type"
              value={idType}
              onChange={(e) => {
                setIdType(e.target.value);
                setIdErr('');
              }}
            >
              <option value="Aadhaar">Aadhaar Card</option>
              <option value="PAN">PAN Card</option>
              <option value="Driving License">Driving License</option>
              <option value="Voter ID">Voter ID</option>
            </Select>

            <Input
              label="ID Number"
              icon={<Hash className="w-4 h-4" />}
              placeholder={
                idType === 'Aadhaar'
                  ? 'XXXX-XXXX-XXXX'
                  : idType === 'PAN'
                  ? 'ABCDE1234F'
                  : 'Enter ID number'
              }
              value={idNumber}
              onChange={(e) => {
                setIdNumber(e.target.value);
                setIdErr('');
              }}
              onBlur={() => setIdErr(validateId(idType, idNumber))}
              error={idErr}
              className="font-mono tracking-wider uppercase"
              required
            />

            {/* File upload zone */}
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-ink-2">Upload ID Card Photo</p>
              <label
                htmlFor="id-upload"
                className={`
                  flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed
                  p-5 cursor-pointer transition-all duration-200
                  ${idFile
                    ? 'border-brand/50 bg-brand-soft'
                    : 'border-line bg-card-2 hover:border-ink-3'
                  }
                `}
              >
                {idFile ? (
                  <>
                    <CheckCircle2 className="w-6 h-6 text-brand" />
                    <p className="text-sm font-medium text-brand text-center">{idFile.name}</p>
                    <p className="text-xs text-ink-3">Tap to change document</p>
                  </>
                ) : (
                  <>
                    <Upload className="w-6 h-6 text-ink-3" />
                    <p className="text-sm font-medium text-ink-2">Tap to choose or photograph ID</p>
                    <p className="text-xs text-ink-4">JPG, PNG or PDF (up to 10 MB)</p>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  id="id-upload"
                  type="file"
                  accept="image/*,application/pdf"
                  className="sr-only"
                  onChange={(e) => setIdFile(e.target.files?.[0] ?? null)}
                />
              </label>
              {idFile && (
                <button
                  type="button"
                  className="text-xs text-ink-3 hover:text-danger transition-colors"
                  onClick={() => {
                    setIdFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                >
                  Remove chosen file
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Section 4: UPI / Bank ───────────────────────────────── */}
        <div className="space-y-3 animate-fade-up stagger-4">
          <div>
            <p className="text-xs font-mono text-brand uppercase tracking-wider mb-0.5">Section 4</p>
            <h2 className="text-base font-semibold text-ink">Payout Settlement (UPI)</h2>
            <p className="text-sm text-ink-3">Your completed job earnings are credited directly here.</p>
          </div>
          <div className="bg-card rounded-2xl border border-line p-4 space-y-3">
            <Input
              label="UPI ID"
              icon={<IndianRupee className="w-4 h-4" />}
              placeholder="e.g. name@okhdfcbank or 9876543210@paytm"
              value={upi}
              onChange={(e) => {
                setUpi(e.target.value);
                setUpiErr('');
              }}
              onBlur={() => setUpiErr(validateUpi(upi))}
              error={upiErr}
              hint="Payments are deposited directly to your bank account via this UPI ID"
              className="font-mono"
              required
            />
          </div>
        </div>

        {/* ── Submit button ───────────────────────────────────────── */}
        <div className="pt-2 pb-nav">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            full
            loading={submitting}
            disabled={submitting || selectedTrades.length === 0}
          >
            Submit for Verification
          </Button>
        </div>
      </form>
    </div>
  );
}
