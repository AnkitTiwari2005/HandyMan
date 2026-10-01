import { useEffect, useState } from 'react';
import { Bell, Wrench } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useRadarStore } from '../stores/radarStore';
import { supabase } from '../lib/supabase';
import { triggerHapticImpact } from '../lib/haptics';

/** Compact 56px header. One job: who am I, am I online, anything new? (Wallet lives in the nav.) */
export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, technicianProfile, toggleOnlineStatus } = useAuthStore();
  const connection = useRadarStore((s) => s.connection);
  const [unread, setUnread] = useState(0);
  const [toggleError, setToggleError] = useState<string | null>(null);

  const isOnline = technicianProfile?.is_online ?? false;
  const approved = technicianProfile?.verification_status === 'approved';

  // Real unread count (the old bell had a hard-coded dot).
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
      .channel(`header-notifs-${user.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user, location.pathname]); // re-check after visiting the notifications page

  const handleToggle = async () => {
    void triggerHapticImpact();
    setToggleError(null);
    const res = await toggleOnlineStatus();
    if (!res.ok) {
      setToggleError(res.message ?? 'Could not change status.');
      window.setTimeout(() => setToggleError(null), 4000);
    }
  };

  const label = !isOnline ? 'Offline' : connection === 'live' ? 'Online' : 'Connecting…';
  const dot = !isOnline ? 'bg-ink-3' : connection === 'live' ? 'bg-money' : 'bg-warn';

  return (
    <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur-md border-b border-line px-4 pt-safe pb-2.5">
      <div className="flex items-center gap-3 h-11">
        <button onClick={() => navigate('/')} className="flex items-center gap-2.5 min-w-0 flex-1 text-left" aria-label="Go to jobs">
          <span className="w-9 h-9 rounded-xl bg-brand flex items-center justify-center shrink-0">
            <Wrench className="w-5 h-5 text-slate-950" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-sm text-ink-3 leading-none">HandyMan Partner</span>
            <span className="block text-base font-semibold text-ink truncate leading-tight mt-0.5">
              {profile?.full_name?.split(' ')[0] || 'Partner'}
            </span>
          </span>
        </button>

        <button
          role="switch"
          aria-checked={isOnline}
          aria-label={isOnline ? 'Online. Tap to go offline' : 'Offline. Tap to go online'}
          onClick={handleToggle}
          disabled={!approved}
          className={`flex items-center gap-2 min-h-11 pl-3 pr-3.5 rounded-full text-sm font-semibold border transition-colors
            ${isOnline ? 'bg-money/10 border-money/40 text-money' : 'bg-card border-line text-ink-2'}
            disabled:opacity-50`}
        >
          <span className={`w-2.5 h-2.5 rounded-full ${dot} ${isOnline && connection === 'live' ? 'online-glow' : ''}`} aria-hidden />
          {label}
        </button>

        <button
          onClick={() => navigate('/notifications')}
          className="relative w-11 h-11 rounded-full bg-card border border-line text-ink-2 flex items-center justify-center"
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        >
          <Bell className="w-5 h-5" aria-hidden />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 rounded-full bg-brand text-slate-950 text-xs font-bold flex items-center justify-center">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      </div>
      {toggleError && <p role="alert" className="text-sm text-danger mt-2">{toggleError}</p>}
    </header>
  );
}
