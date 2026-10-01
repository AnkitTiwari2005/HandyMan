import { Briefcase, CalendarCheck, Wallet, UserRound } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { triggerHapticTap } from '../lib/haptics';
import { useRadarStore } from '../stores/radarStore';

const NAV_ITEMS = [
  { path: '/',         label: 'Jobs',     Icon: Briefcase    },
  { path: '/schedule', label: 'My Jobs',  Icon: CalendarCheck },
  { path: '/wallet',   label: 'Earnings', Icon: Wallet       },
  { path: '/profile',  label: 'Me',       Icon: UserRound    },
] as const;

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeJob  = useRadarStore((s) => s.activeJob);
  const upcomingJobs = useRadarStore((s) => s.upcomingJobs.length);
  const todayCount = upcomingJobs + (activeJob ? 1 : 0);

  return (
    <nav
      aria-label="Main navigation"
      className="fixed bottom-0 left-0 right-0 z-40 max-w-lg mx-auto glass border-t border-line-soft"
      style={{ paddingBottom: 'var(--safe-bottom)' }}
    >
      <ul className="flex h-16">
        {NAV_ITEMS.map(({ path, label, Icon }) => {
          const active = location.pathname === path;
          const count  = path === '/schedule' ? todayCount : 0;

          return (
            <li key={path} className="flex-1">
              <button
                onClick={() => {
                  if (!active) {
                    void triggerHapticTap();
                    navigate(path);
                  }
                }}
                aria-current={active ? 'page' : undefined}
                aria-label={label + (count ? `, ${count} active` : '')}
                className="w-full h-full flex flex-col items-center justify-center gap-0.5"
              >
                {/* Icon container with pill highlight */}
                <span
                  className={`
                    relative flex items-center justify-center w-12 h-7 rounded-full
                    transition-all duration-300 ease-out
                    ${active ? 'bg-brand-soft' : ''}
                  `}
                >
                  <Icon
                    className={`w-5 h-5 transition-all duration-300 ${active ? 'text-brand' : 'text-ink-3'}`}
                    aria-hidden
                  />
                  {count > 0 && (
                    <span className="absolute -top-1 -right-0.5 min-w-4 h-4 px-1 rounded-full gradient-brand text-white text-[9px] font-bold flex items-center justify-center shadow-sm">
                      {count > 9 ? '9+' : count}
                    </span>
                  )}
                </span>

                {/* Label */}
                <span
                  className={`text-[10px] font-semibold transition-colors duration-200 ${active ? 'text-brand' : 'text-ink-4'}`}
                >
                  {label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
