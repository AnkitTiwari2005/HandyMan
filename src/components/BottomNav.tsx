import { Briefcase, CalendarCheck, Wallet, UserRound } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { triggerHapticTap } from '../lib/haptics';
import { useRadarStore } from '../stores/radarStore';

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeJob = useRadarStore((s) => s.activeJob);
  const upcoming = useRadarStore((s) => s.upcomingJobs.length);
  const todayCount = upcoming + (activeJob ? 1 : 0);

  const items = [
    { path: '/', label: 'Jobs', icon: Briefcase },
    { path: '/schedule', label: 'My jobs', icon: CalendarCheck, count: todayCount },
    { path: '/wallet', label: 'Earnings', icon: Wallet },
    { path: '/profile', label: 'Me', icon: UserRound },
  ];

  return (
    // Height is fixed (64px + safe area). The old nav inherited an 88px bottom padding.
    <nav
      aria-label="Main"
      className="fixed bottom-0 left-0 right-0 z-40 max-w-lg mx-auto bg-surface/95 backdrop-blur-md border-t border-line"
      style={{ paddingBottom: 'var(--safe-bottom)' }}
    >
      <ul className="flex h-16">
        {items.map(({ path, label, icon: Icon, count }) => {
          const active = location.pathname === path;
          return (
            <li key={path} className="flex-1">
              <button
                onClick={() => { if (!active) { void triggerHapticTap(); navigate(path); } }}
                aria-current={active ? 'page' : undefined}
                className={`w-full h-full flex flex-col items-center justify-center gap-1 text-xs font-semibold transition-colors
                  ${active ? 'text-brand' : 'text-ink-3'}`}
              >
                <span className={`relative flex items-center justify-center w-14 h-8 rounded-full transition-colors ${active ? 'bg-brand-soft' : ''}`}>
                  <Icon className="w-6 h-6" aria-hidden />
                  {count ? (
                    <span className="absolute -top-1 right-1 min-w-5 h-5 px-1 rounded-full bg-brand text-slate-950 text-xs font-bold flex items-center justify-center">
                      {count}
                    </span>
                  ) : null}
                </span>
                {label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
