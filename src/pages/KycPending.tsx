import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ShieldX, RefreshCw, Pencil, CheckCircle2, Clock, Circle } from 'lucide-react';
import { Button, ErrorBanner } from '../components/ui';
import { useAuthStore } from '../stores/authStore';

/* ─── Verification timeline ──────────────────────────────────── */
type TimelineStep = { label: string; sub: string };
const STEPS: TimelineStep[] = [
  { label: 'Submitted',    sub: 'Documents received'     },
  { label: 'Under Review', sub: 'Admin checks your info' },
  { label: 'Approved',     sub: 'Start taking jobs'      },
];

function Timeline({ currentStep }: { currentStep: number }) {
  return (
    <div className="relative flex flex-col gap-0 w-full max-w-xs mx-auto mt-6">
      {STEPS.map((step, i) => {
        const done    = i < currentStep;
        const active  = i === currentStep;
        const pending = i > currentStep;
        return (
          <div key={step.label} className="flex gap-4">
            {/* Spine */}
            <div className="flex flex-col items-center">
              <div
                className={`
                  w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-500
                  ${done   ? 'bg-brand border-brand'           : ''}
                  ${active ? 'bg-brand-soft border-brand'      : ''}
                  ${pending? 'bg-card-2 border-line'           : ''}
                `}
              >
                {done   && <CheckCircle2 className="w-4 h-4 text-white" />}
                {active && <Clock className="w-4 h-4 text-brand" />}
                {pending&& <Circle className="w-4 h-4 text-ink-4" />}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`w-0.5 h-10 mt-0.5 rounded-full transition-all duration-500 ${
                    done ? 'bg-brand' : 'bg-line'
                  }`}
                />
              )}
            </div>
            {/* Label */}
            <div className="pb-4 pt-1">
              <p className={`text-sm font-semibold ${active ? 'text-brand' : done ? 'text-ink' : 'text-ink-3'}`}>
                {step.label}
              </p>
              <p className="text-xs text-ink-4">{step.sub}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────── */
export default function KycPending() {
  const navigate = useNavigate();
  const { user, technicianProfile, profileError, fetchProfiles, signOut } = useAuthStore();

  const [checking, setChecking] = useState(false);

  const status = technicianProfile?.verification_status ?? 'pending';
  const isRejected = status === 'rejected';

  // Session guard
  useEffect(() => {
    if (!user) navigate('/login', { replace: true });
  }, [user, navigate]);

  async function handleCheckStatus() {
    if (!user) return;
    setChecking(true);
    try {
      await fetchProfiles(user.id);
      // fetchProfiles updates the store; after awaiting we read the fresh value
      // from the store via the selector at the top level — navigate if approved
    } finally {
      setChecking(false);
    }
  }

  // Navigate away once approved (reactive to store change)
  useEffect(() => {
    if (technicianProfile?.verification_status === 'approved') {
      navigate('/', { replace: true });
    }
  }, [technicianProfile?.verification_status, navigate]);

  async function handleSignOut() {
    await signOut();
    navigate('/login', { replace: true });
  }

  // Timeline current step: rejected = stays at step 1 (under review), pending = step 1
  const timelineStep = isRejected ? 1 : 1;

  return (
    <div className="min-h-dvh bg-bg text-ink flex flex-col justify-between p-6 max-w-lg mx-auto">
      {/* ── Wordmark ──────────────────────────────────────────── */}
      <div className="pt-safe animate-fade-up">
        <span className="font-display text-xl font-bold text-ink">
          Handy<span className="text-brand">Man</span>
        </span>
      </div>

      {/* ── Middle content ───────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center py-10 space-y-5 animate-fade-up stagger-1">

        {profileError && (
          <ErrorBanner message={profileError} className="w-full mb-2" />
        )}

        {/* Status icon */}
        <div
          className={`
            w-20 h-20 rounded-3xl flex items-center justify-center
            ${isRejected ? 'bg-danger-soft' : 'bg-warn-soft'}
          `}
        >
          {isRejected
            ? <ShieldX className="w-10 h-10 text-danger" />
            : <ShieldCheck className="w-10 h-10 text-warn" />
          }
        </div>

        {/* Title & body */}
        <div className="text-center space-y-2 max-w-sm">
          <h1 className="font-display text-2xl font-bold text-ink">
            {isRejected ? 'Verification Issue' : 'Under Review'}
          </h1>
          <p className="text-sm text-ink-2 leading-relaxed">
            {isRejected
              ? (technicianProfile?.rejection_reason
                  ? technicianProfile.rejection_reason
                  : 'Your documents could not be verified. Please update them and try again.')
              : 'Our team is reviewing your profile and documents. This usually takes up to 24 hours. We\'ll notify you once approved.'}
          </p>
        </div>

        {/* CTA button */}
        <div className="w-full max-w-xs space-y-3">
          {isRejected ? (
            <Button
              variant="outline"
              size="lg"
              full
              icon={<Pencil className="w-4 h-4" />}
              onClick={() => navigate('/kyc')}
            >
              Update Documents
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="lg"
              full
              loading={checking}
              icon={<RefreshCw className="w-4 h-4" />}
              onClick={handleCheckStatus}
            >
              Check Status
            </Button>
          )}

          <Button variant="ghost" size="md" full onClick={handleSignOut}>
            Sign Out
          </Button>
        </div>

        {/* Timeline */}
        <Timeline currentStep={timelineStep} />
      </div>

      {/* ── Footer ───────────────────────────────────────────── */}
      <div className="pb-safe animate-fade-up stagger-2">
        <p className="text-sm text-ink-3 text-center">
          Need help?{' '}
          <a
            href="mailto:support@handyman.in"
            className="text-brand font-medium hover:underline"
          >
            support@handyman.in
          </a>
        </p>
      </div>
    </div>
  );
}
