import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useRadarStore } from '../stores/radarStore';
import Navbar from './Navbar';
import BottomNav from './BottomNav';
import IncomingJobModal from './IncomingJobModal';
import { ErrorBanner, Skeleton } from './ui';

function FullScreenLoader() {
  return (
    <div className="min-h-dvh bg-surface flex flex-col items-center justify-center gap-4 p-6">
      <div className="w-10 h-10 rounded-full border-4 border-brand/20 border-t-brand animate-spin" role="status" aria-label="Loading" />
      <Skeleton className="h-3 w-32" />
    </div>
  );
}

/** Keeps the radar alive on EVERY tab (it used to live inside Dashboard only),
 *  and only while the partner is verified and online. */
function useRadarLifecycle() {
  const userId = useAuthStore((s) => s.user?.id);
  const approved = useAuthStore((s) => s.technicianProfile?.verification_status === 'approved');
  const online = useAuthStore((s) => s.technicianProfile?.is_online ?? false);
  const updateLocation = useAuthStore((s) => s.updateLocation);
  const start = useRadarStore((s) => s.startRadarSubscription);
  const fetchMyJobs = useRadarStore((s) => s.fetchMyJobs);

  useEffect(() => {
    if (!userId || !approved) return;
    if (!online) {
      void fetchMyJobs(userId); // still show my own accepted jobs while offline
      return;
    }
    return start(userId);
  }, [userId, approved, online, start, fetchMyJobs]);

  // Location while online: now, then every 2 minutes (it used to be read once and never used).
  useEffect(() => {
    if (!online || !('geolocation' in navigator)) return;
    const read = () =>
      navigator.geolocation.getCurrentPosition(
        (p) => void updateLocation(p.coords.latitude, p.coords.longitude),
        (err) => console.warn('GPS skipped:', err.message),
        { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 }
      );
    read();
    const id = window.setInterval(read, 120_000);
    return () => window.clearInterval(id);
  }, [online, updateLocation]);
}

export const ProtectedRoute = () => {
  const { user, technicianProfile, isLoading, profileLoadedFor, profileError } = useAuthStore();
  const location = useLocation();
  useRadarLifecycle();

  // Only the very first load shows a full-screen loader. Later refreshes are silent.
  if (isLoading || (user && profileLoadedFor !== user.id)) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace />;

  if (profileError && !technicianProfile) {
    return (
      <div className="min-h-dvh bg-surface p-6 flex items-center">
        <div className="w-full max-w-lg mx-auto">
          <ErrorBanner message={profileError} onRetry={() => void useAuthStore.getState().fetchProfiles(user.id)} />
        </div>
      </div>
    );
  }

  // No technician row yet -> finish trade + KYC setup. Not verified yet -> status screen.
  if (!technicianProfile) return <Navigate to="/kyc" replace />;
  if (technicianProfile.verification_status !== 'approved') {
    const allowed = location.pathname === '/profile';
    if (!allowed) return <Navigate to="/kyc-pending" replace />;
  }

  return (
    <div className="min-h-dvh bg-surface text-ink flex flex-col max-w-lg mx-auto relative">
      <Navbar />
      <main className="flex-1 pb-nav">
        <Outlet />
      </main>
      <BottomNav />
      <IncomingJobModal />
    </div>
  );
};

export const PublicRoute = () => {
  const { user, isLoading } = useAuthStore();
  if (isLoading) return <FullScreenLoader />;
  if (user) return <Navigate to="/" replace />;
  return <Outlet />;
};
