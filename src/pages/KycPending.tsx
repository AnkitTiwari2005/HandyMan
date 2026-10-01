import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ShieldCheck, ShieldX, RefreshCw, Pencil } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { Button } from '../components/ui';

/** Real verification status. There is NO self-approve button any more:
 *  approval happens server-side (admin_set_verification). */
export default function KycPending() {
  const navigate = useNavigate();
  const { user, technicianProfile, fetchProfiles, signOut } = useAuthStore();
  const [checking, setChecking] = useState(false);

  if (!user) return <Navigate to="/login" replace />;

  const status = technicianProfile?.verification_status ?? 'pending';
  const rejected = status === 'rejected';

  const refresh = async () => {
    if (!user) return;
    setChecking(true);
    await fetchProfiles(user.id);
    setChecking(false);
    if (useAuthStore.getState().technicianProfile?.verification_status === 'approved') {
      navigate('/', { replace: true });
    }
  };

  return (
    <div className="min-h-dvh bg-surface text-ink flex flex-col justify-between p-6 max-w-lg mx-auto">
      <div className="pt-safe"><span className="font-bold text-lg">HandyMan</span></div>

      <div className="py-8 text-center flex flex-col items-center">
        <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-6 ${rejected ? 'bg-danger/10 text-danger' : 'bg-warn/10 text-warn'}`}>
          {rejected ? <ShieldX className="w-10 h-10" aria-hidden /> : <ShieldCheck className="w-10 h-10" aria-hidden />}
        </div>
        <h1 className="text-2xl font-bold mb-2">{rejected ? 'Verification needs attention' : 'Verification in progress'}</h1>
        <p className="text-base text-ink-2 max-w-sm mb-2">
          {rejected
            ? (technicianProfile?.rejection_reason || 'We could not verify your documents. Please update them and submit again.')
            : 'Our team is checking your documents. This usually takes up to 24 hours. You can start taking jobs as soon as you are approved.'}
        </p>
        <div className="w-full mt-8 space-y-3">
          {rejected ? (
            <Button full size="lg" icon={<Pencil className="w-5 h-5" aria-hidden />} onClick={() => navigate('/kyc')}>Update documents</Button>
          ) : (
            <Button full size="lg" variant="secondary" loading={checking} icon={<RefreshCw className="w-5 h-5" aria-hidden />} onClick={refresh}>
              Check status
            </Button>
          )}
          <Button full variant="ghost" onClick={async () => { await signOut(); navigate('/login', { replace: true }); }}>Sign out</Button>
        </div>
      </div>

      <p className="text-center text-sm text-ink-3 pb-safe">Need help? partner-support@houserve.com</p>
    </div>
  );
}
