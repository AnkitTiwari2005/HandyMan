import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useRadarStore } from '../stores/radarStore';
import Navbar from './Navbar';
import BottomNav from './BottomNav';
import IncomingJobModal from './IncomingJobModal';
import { ErrorBanner, Skeleton } from './ui';
import { Wrench } from 'lucide-react';

// ── Full-screen loader (only on first load, never on refresh) ─
function FullScreenLoader() {
  return (
    <div className="min-h-dvh bg-bg flex flex-col items-center justify-center gap-5 p-6">
      {/* Animated brand logo */}
      <div className="relative">
        <div className="w-16 h-16 rounded-2xl gradient-brand flex items-center justify-center shadow-xl shadow-brand/30 animate-scale-in">
          <Wrench className="w-8 h-8 text-white" aria-hidden />
        </div>
        {/* Spinning ring */}
        <div className="absolute -inset-2 rounded-3xl border-2 border-brand/20 border-t-brand spin-slow" />
      </div>
      <div className="space-y-2 text-center animate-fade-up stagger-2">
        <p className="text-sm font-semibold text-ink-2">Loading your workspace…</p>
        <div className="flex items-center gap-1.5 justify-center">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Radar lifecycle — lives here so it survives ALL tab switches ─
function useRadarLifecycle() {
  const userId       = useAuthStore((s) => s.user?.id);
  const approved     = useAuthStore((s) => s.technicianProfile?.verification_status === 'approved');
  const online       = useAuthStore((s) => s.technicianProfile?.is_online ?? false);
  const updateLocation = useAuthStore((s) => s.updateLocation);
  const start        = useRadarStore((s) => s.startRadarSubscription);
  const fetchMyJobs  = useRadarStore((s) => s.fetchMyJobs);

  useEffect(() => {
    if (!userId || !approved) return;
    if (!online) {
      void fetchMyJobs(userId);
      return;
    }
    return start(userId);
  }, [userId, approved, online, start, fetchMyJobs]);

  // GPS location ping every 2 minutes while online
  useEffect(() => {
    if (!online || !('geolocation' in navigator)) return;
    const read = () =>
      navigator.geolocation.getCurrentPosition(
        (p) => void updateLocation(p.coords.latitude, p.coords.longitude),
        (err) => console.warn('GPS:', err.message),
        { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 }
      );
    read();
    const id = window.setInterval(read, 120_000);
    return () => window.clearInterval(id);
  }, [online, updateLocation]);
}

// ── Protected Route ────────────────────────────────────────────
export const ProtectedRoute = () => {
  const { user, technicianProfile, isLoading, profileLoadedFor, profileError } = useAuthStore();
  const location = useLocation();
  useRadarLifecycle();

  // Only the very first load shows the full-screen loader
  if (isLoading || (user && profileLoadedFor !== user.id)) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace />;

  // Profile load error with no data
  if (profileError && !technicianProfile) {
    return (
      <div className="min-h-dvh bg-bg p-6 flex items-center justify-center">
        <div className="w-full max-w-sm space-y-4">
          <ErrorBanner
            message={profileError}
            onRetry={() => void useAuthStore.getState().fetchProfiles(user.id)}
          />
        </div>
      </div>
    );
  }

  // KYC routing
  if (!technicianProfile) return <Navigate to="/kyc" replace />;
  if (technicianProfile.verification_status !== 'approved') {
    if (location.pathname !== '/profile') {
      return <Navigate to="/kyc-pending" replace />;
    }
  }

  return (
    <div className="min-h-dvh bg-bg text-ink flex flex-col max-w-lg mx-auto relative">
      <Navbar />
      <main className="flex-1 pb-nav">
        <Outlet />
      </main>
      <BottomNav />
      <IncomingJobModal />
    </div>
  );
};

// ── Public Route (redirect logged-in users away) ──────────────
export const PublicRoute = () => {
  const { user, isLoading } = useAuthStore();
  if (isLoading) return <FullScreenLoader />;
  if (user) return <Navigate to="/" replace />;
  return <Outlet />;
};
