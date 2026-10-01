import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Zap, Wrench, Droplets, Hammer, Paintbrush2, Sparkles, Bug,
  Upload, Hash, IndianRupee, ShieldCheck,
} from 'lucide-react';
import { Button, Chip, ErrorBanner, Input, Select } from '../components/ui';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';

/* ─── Trade catalogue ─────────────────────────────────────────── */
const TRADES = [
  { id: 'electrical',      label: 'Electrical',      icon: <Zap className="w-4 h-4" /> },
  { id: 'appliance_repair',label: 'Appliance Repair', icon: <Wrench className="w-4 h-4" /> },
  { id: 'plumbing',        label: 'Plumbing',         icon: <Droplets className="w-4 h-4" /> },
  { id: 'carpentry',       label: 'Carpentry',        icon: <Hammer className="w-4 h-4" /> },
  { id: 'painting',        label: 'Painting',         icon: <Paintbrush2 className="w-4 h-4" /> },
  { id: 'cleaning',        label: 'Cleaning',         icon: <Sparkles className="w-4 h-4" /> },
  { id: 'pest_control',    label: 'Pest Control',     icon: <Bug className="w-4 h-4" /> },
] as const;

/* ─── ID type validators ──────────────────────────────────────── */
const ID_PATTERNS: Record<string, RegExp | null> = {
  aadhaar:         /^\d{12}$/,
  pan:             /^[A-Z]{5}\d{4}[A-Z]{1}$/,
  driving_license: null, // free-form
  voter_id:        null,
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
  const { user, fetchProfiles } = useAuthStore();

  // ── Form state ────────────────────────────────────────────────
  const [selectedTrades, setSelectedTrades] = useState<string[]>([]);
  const [experience, setExperience]         = useState(3);
  const [idType, setIdType]                 = useState('aadhaar');
  const [idNumber, setIdNumber]             = useState('');
  const [idFile, setIdFile]                 = useState<File | null>(null);
  const [upi, setUpi]                       = useState('');
  const [submitting, setSubmitting]         = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const [activeSection, setActiveSection]   = useState(0);

  // Field-level errors
  const [idErr, setIdErr]   = useState('');
  const [upiErr, setUpiErr] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Session guard
  useEffect(() => {
    if (!user) navigate('/login', { replace: true });
  }, [user, navigate]);

  // Track scroll section for dots
  const sectionRefs = [
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
  ];
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length) {
          const topmost = visible.reduce((a, b) =>
            a.boundingClientRect.top < b.boundingClientRect.top ? a : b
          );
          const idx = sectionRefs.findIndex(
            (r) => r.current === topmost.target
          );
          if (idx !== -1) setActiveSection(idx);
        }
      },
      { threshold: 0.4 }
    );
    sectionRefs.forEach((r) => r.current && observer.observe(r.current));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Validation helpers ────────────────────────────────────────
  function validateId(type: string, value: string): string {
    const pat = ID_PATTERNS[type];
    if (!pat) return '';
    if (!pat.test(value.trim().toUpperCase()))
      return type === 'aadhaar'
        ? 'Aadhaar must be exactly 12 digits'
        : type === 'pan'
        ? 'PAN must match ABCDE1234F format'
        : '';
    return '';
  }

  function validateUpi(value: string): string {
    if (!value.trim()) return 'UPI ID is required';
    if (!UPI_RE.test(value.trim())) return 'Enter a valid UPI ID (e.g. name@upi)';
    return '';
  }

  // ── Submit ────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (selectedTrades.length === 0) {
      setError('Please select at least one trade specialty.');
      return;
    }

    const idErrMsg = validateId(idType, idNumber);
    const upiErrMsg = validateUpi(upi);
    setIdErr(idErrMsg);
    setUpiErr(upiErrMsg);
    if (idErrMsg || upiErrMsg) return;

    setSubmitting(true);
    try {
      let idDocumentUrl: string | null = null;

      // Upload ID photo if provided
      if (idFile && user) {
        const ext = idFile.name.split('.').pop();
        const path = `kyc/${user.id}/id_doc.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('technician-docs')
          .upload(path, idFile, { upsert: true });
        if (uploadErr) throw new Error('Failed to upload ID photo: ' + uploadErr.message);
        const { data: urlData } = supabase.storage
          .from('technician-docs')
          .getPublicUrl(path);
        idDocumentUrl = urlData.publicUrl;
      }

      const { error: rpcErr } = await supabase.rpc('save_technician_kyc', {
        p_skills:           selectedTrades,
        p_experience_years: experience,
        p_id_type:          idType,
        p_id_number:        idNumber.trim().toUpperCase(),
        p_id_document_url:  idDocumentUrl,
        p_bank_upi_id:      upi.trim(),
      });

      if (rpcErr) throw new Error(rpcErr.message);

      if (user) await fetchProfiles(user.id);
      navigate('/kyc-pending');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const toggleTrade = (id: string) =>
    setSelectedTrades((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );

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
              Complete once — review within 24 hrs.
            </p>
          </div>
        </div>
        <StepDots total={4} active={activeSection} />
      </div>

      {error && <ErrorBanner message={error} className="mb-5 animate-fade-up stagger-1" />}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ── Section 1: Trades ───────────────────────────────────── */}
        <div ref={sectionRefs[0]} className="space-y-3 animate-fade-up stagger-1">
          <div>
            <p className="text-xs font-mono text-brand uppercase tracking-wider mb-0.5">Section 1</p>
            <h2 className="text-base font-semibold text-ink">Your Specialties</h2>
            <p className="text-sm text-ink-3">Select all trades you're skilled in.</p>
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
        <div ref={sectionRefs[1]} className="space-y-3 animate-fade-up stagger-2">
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
        <div ref={sectionRefs[2]} className="space-y-3 animate-fade-up stagger-3">
          <div>
            <p className="text-xs font-mono text-brand uppercase tracking-wider mb-0.5">Section 3</p>
            <h2 className="text-base font-semibold text-ink">Government ID</h2>
            <p className="text-sm text-ink-3">Used only for identity verification.</p>
          </div>
          <div className="bg-card rounded-2xl border border-line p-4 space-y-4">
            <Select
              label="ID Type"
              value={idType}
              onChange={(e) => {
                setIdType(e.target.value);
                setIdErr('');
              }}
            >
              <option value="aadhaar">Aadhaar Card</option>
              <option value="pan">PAN Card</option>
              <option value="driving_license">Driving License</option>
              <option value="voter_id">Voter ID</option>
            </Select>

            <Input
              label="ID Number"
              icon={<Hash className="w-4 h-4" />}
              placeholder={
                idType === 'aadhaar'
                  ? '1234 5678 9012'
                  : idType === 'pan'
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
              className="font-mono tracking-wider"
              required
            />

            {/* File upload zone */}
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-ink-2">ID Photo</p>
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
                <Upload
                  className={`w-6 h-6 ${idFile ? 'text-brand' : 'text-ink-3'}`}
                />
                {idFile ? (
                  <p className="text-sm font-medium text-brand text-center">{idFile.name}</p>
                ) : (
                  <>
                    <p className="text-sm font-medium text-ink-2">Tap to upload ID photo</p>
                    <p className="text-xs text-ink-4">JPG, PNG or PDF · max 5 MB</p>
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
                  Remove file
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Section 4: UPI / Bank ───────────────────────────────── */}
        <div ref={sectionRefs[3]} className="space-y-3 animate-fade-up stagger-4">
          <div>
            <p className="text-xs font-mono text-brand uppercase tracking-wider mb-0.5">Section 4</p>
            <h2 className="text-base font-semibold text-ink">Payment Details</h2>
            <p className="text-sm text-ink-3">Where your earnings are sent.</p>
          </div>
          <div className="bg-card rounded-2xl border border-line p-4">
            <Input
              label="UPI ID / Bank Account"
              icon={<IndianRupee className="w-4 h-4" />}
              placeholder="yourname@upi"
              value={upi}
              onChange={(e) => {
                setUpi(e.target.value);
                setUpiErr('');
              }}
              onBlur={() => setUpiErr(validateUpi(upi))}
              error={upiErr}
              hint="e.g. name@paytm, name@ybl, name@oksbi"
              required
            />
          </div>
        </div>

        {/* ── Submit ──────────────────────────────────────────────── */}
        <div className="pt-2 pb-4 animate-fade-up stagger-5">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            full
            loading={submitting}
            icon={<ShieldCheck className="w-5 h-5" />}
          >
            Submit for Verification
          </Button>
          <p className="text-xs text-ink-4 text-center mt-3">
            Your data is encrypted and only used for partner verification.
          </p>
        </div>
      </form>
    </div>
  );
}
