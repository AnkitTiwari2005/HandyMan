import { useEffect, useState } from 'react';
import { Bell, Wrench, ChevronDown } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useRadarStore } from '../stores/radarStore';
import { supabase } from '../lib/supabase';
import { triggerHapticImpact } from '../lib/haptics';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, technicianProfile, toggleOnlineStatus } = useAuthStore();
  const connection = useRadarStore((s) => s.connection);
  const [unread, setUnread] = useState(0);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);

  const isOnline = technicianProfile?.is_online ?? false;
  const approved = technicianProfile?.verification_status === 'approved';
  const firstName = profile?.full_name?.split(' ')[0] || 'Partner';

  // Real unread notification count
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      setUnread(count ?? 0);
    };
    void load();
    const channel = supabase
      .channel(`navbar-notifs-${user.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user, location.pathname]);

  const handleToggle = async () => {
    if (!approved || toggling) return;
    void triggerHapticImpact();
    setToggling(true);
    setToggleError(null);
    const res = await toggleOnlineStatus();
    setToggling(false);
    if (!res.ok) {
      setToggleError(res.message ?? 'Could not change status.');
      window.setTimeout(() => setToggleError(null), 4000);
    }
  };

  // Status indicator
  const statusLabel = !isOnline
    ? 'Offline'
    : connection === 'live'
    ? 'Online'
    : 'Connecting';

  const statusDot = !isOnline
    ? 'bg-ink-3'
    : connection === 'live'
    ? 'bg-money online-glow'
    : 'bg-warn animate-pulse';

  return (
    <header className="sticky top-0 z-40 glass border-b border-line-soft" style={{ paddingTop: 'var(--safe-top)' }}>
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Brand / name */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2.5 min-w-0 flex-1 text-left group"
          aria-label="Home"
        >
          <div className="w-9 h-9 rounded-xl gradient-brand flex items-center justify-center shadow-md shadow-brand/30 shrink-0 group-active:scale-95 transition-transform">
            <Wrench className="w-4.5 h-4.5 text-white" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-ink-3 leading-none font-medium">HandyMan</p>
            <p className="text-sm font-bold text-ink truncate leading-tight mt-0.5">{firstName}</p>
          </div>
        </button>

        {/* Online / Offline toggle */}
        <button
          role="switch"
          aria-checked={isOnline}
          aria-label={isOnline ? 'Online. Tap to go offline.' : 'Offline. Tap to go online.'}
          onClick={handleToggle}
          disabled={!approved || toggling}
          className={`
            flex items-center gap-2 min-h-10 px-3.5 rounded-full text-xs font-semibold
            border transition-all duration-300 shrink-0
            disabled:opacity-60 disabled:cursor-not-allowed
            ${isOnline
              ? 'bg-money-soft border-money/30 text-money'
              : 'bg-card-2 border-line text-ink-2 hover:border-ink-4'
            }
          `}
        >
          <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot}`} aria-hidden />
          <span>{statusLabel}</span>
          {approved && <ChevronDown className="w-3.5 h-3.5 opacity-60" aria-hidden />}
        </button>

        {/* Notifications */}
        <button
          onClick={() => navigate('/notifications')}
          className="relative w-10 h-10 rounded-xl bg-card-2 border border-line text-ink-2 flex items-center justify-center hover:text-ink hover:border-ink-4 transition-all shrink-0"
          aria-label={unread > 0 ? `${unread} unread notifications` : 'Notifications'}
        >
          <Bell className="w-4.5 h-4.5" aria-hidden />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full gradient-brand text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      </div>

      {toggleError && (
        <div role="alert" className="px-4 pb-2.5">
          <p className="text-xs text-danger bg-danger-soft border border-danger/20 rounded-lg px-3 py-2">{toggleError}</p>
        </div>
      )}
    </header>
  );
}
