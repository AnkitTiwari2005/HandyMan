import { Radio, CalendarCheck, Wallet, UserCheck } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { triggerHapticImpact } from '../lib/haptics';
import { useRadarStore } from '../stores/radarStore';

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { activeJob } = useRadarStore();

  const navItems = [
    {
      id: 'radar',
      path: '/',
      label: 'Job Radar',
      icon: Radio,
    },
    {
      id: 'schedule',
      path: '/schedule',
      label: 'My Bookings',
      icon: CalendarCheck,
      badge: activeJob ? 'Active' : undefined,
    },
    {
      id: 'wallet',
      path: '/wallet',
      label: 'Earnings',
      icon: Wallet,
    },
    {
      id: 'profile',
      path: '/profile',
      label: 'Profile',
      icon: UserCheck,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800 px-3 py-2 pb-safe max-w-lg mx-auto">
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => {
                triggerHapticImpact();
                navigate(item.path);
              }}
              className={`flex flex-col items-center justify-center flex-1 py-1 px-2 rounded-xl transition-all duration-200 relative ${
                isActive
                  ? 'text-orange-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? 'scale-110' : ''}`} />
                {item.badge && (
                  <span className="absolute -top-1.5 -right-3 text-[9px] font-bold px-1.5 py-0.2 bg-emerald-500 text-slate-950 rounded-full animate-pulse shadow-sm">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[11px] font-syne mt-1">
                {item.label}
              </span>
              {isActive && (
                <span className="w-4 h-0.5 bg-orange-400 rounded-full mt-0.5 shadow-sm shadow-orange-400/50" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
