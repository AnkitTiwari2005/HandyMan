import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useRadarStore } from '../stores/radarStore';
import { supabase } from '../lib/supabase';
import { playRadarAlertTone, playSuccessChime } from '../lib/audio';
import { triggerHapticNotification } from '../lib/haptics';
import Navbar from './Navbar';
import BottomNav from './BottomNav';
import IncomingJobModal from './IncomingJobModal';
import { ErrorBanner, Skeleton } from './ui';
import { Wrench, Bell, X, ArrowRight } from 'lucide-react';

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

interface InAppAlert {
  id: string;
  title: string;
  body: string;
  booking_id?: string;
}

// ── Protected Route ────────────────────────────────────────────
export const ProtectedRoute = () => {
  const navigate = useNavigate();
  const { user, technicianProfile, isLoading, profileLoadedFor, profileError } = useAuthStore();
  const location = useLocation();
  const { fetchMyJobs, fetchAvailableJobs } = useRadarStore();

  const [inAppAlert, setInAppAlert] = useState<InAppAlert | null>(null);

  useRadarLifecycle();

  // ── Global real-time listener for incoming notifications & job assignments ──
  useEffect(() => {
    if (!user?.id) return;

    // 1. Listen for new notifications specifically for this partner
    const notifChannel = supabase
      .channel(`global-partner-notifs-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const item = payload.new as {
            id: string;
            title: string;
            body?: string;
            message?: string;
            booking_id?: string;
          };
          playRadarAlertTone();
          void triggerHapticNotification();

          setInAppAlert({
            id: item.id,
            title: item.title || 'New Notification',
            body: item.body || item.message || '',
            booking_id: item.booking_id,
          });

          // Refresh jobs if it's booking related
          void fetchMyJobs(user.id);
          void fetchAvailableJobs();
        }
      )
      .subscribe();

    // 2. Listen for booking assignment updates
    const bookingChannel = supabase
      .channel(`global-assigned-bookings-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings',
          filter: `technician_id=eq.${user.id}`,
        },
        (payload) => {
          const updated = payload.new as { id: string; status: string; booking_ref: string };
          void fetchMyJobs(user.id);
          void fetchAvailableJobs();

          if (updated.status === 'assigned') {
            playRadarAlertTone();
            void triggerHapticNotification();
            setInAppAlert({
              id: updated.id,
              title: 'New Job Assigned!',
              body: `Booking #${updated.booking_ref} has been assigned to you. Tap to view location and travel.`,
              booking_id: updated.id,
            });
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(notifChannel);
      void supabase.removeChannel(bookingChannel);
    };
  }, [user?.id, fetchMyJobs, fetchAvailableJobs]);

  // Auto-dismiss alert after 7 seconds
  useEffect(() => {
    if (!inAppAlert) return;
    const timer = setTimeout(() => {
      setInAppAlert(null);
    }, 7000);
    return () => clearTimeout(timer);
  }, [inAppAlert]);

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
      {/* ── Sliding in-app notification banner ────────────────────── */}
      {inAppAlert && (
        <div className="fixed top-16 left-3 right-3 z-50 max-w-lg mx-auto animate-fade-down pointer-events-auto">
          <div className="bg-card/95 backdrop-blur-md border-2 border-brand/50 shadow-2xl shadow-brand/20 rounded-2xl p-3.5 flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand text-white flex items-center justify-center shrink-0 shadow-md shadow-brand/30">
              <Bell className="w-5 h-5 animate-pulse" />
            </div>
            <div
              className="flex-1 min-w-0 cursor-pointer"
              onClick={() => {
                if (inAppAlert.booking_id) navigate(`/job/${inAppAlert.booking_id}`);
                else navigate('/notifications');
                setInAppAlert(null);
              }}
            >
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-bold text-ink leading-tight">{inAppAlert.title}</p>
                <ArrowRight className="w-3 h-3 text-brand shrink-0" />
              </div>
              <p className="text-xs text-ink-3 leading-snug line-clamp-2 mt-0.5">{inAppAlert.body}</p>
            </div>
            <button
              onClick={() => setInAppAlert(null)}
              className="p-1 rounded-lg text-ink-3 hover:text-ink hover:bg-card-2 shrink-0 transition-colors"
              aria-label="Dismiss alert"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

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
  const { user, technicianProfile, isLoading, profileLoadedFor } = useAuthStore();
  if (isLoading || (user && profileLoadedFor !== user.id)) return <FullScreenLoader />;
  if (user) {
    if (!technicianProfile) return <Navigate to="/kyc" replace />;
    if (technicianProfile.verification_status !== 'approved') return <Navigate to="/kyc-pending" replace />;
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
};
