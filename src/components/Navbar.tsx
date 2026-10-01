import { Bell, Wrench, Wallet as WalletIcon, Power } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { triggerHapticImpact } from '../lib/haptics';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, technicianProfile, toggleOnlineStatus } = useAuthStore();

  const isOnline = technicianProfile?.is_online ?? false;
  const isKycApproved = technicianProfile?.verification_status === 'approved';

  const handleToggle = async () => {
    triggerHapticImpact();
    if (!isKycApproved) {
      navigate('/kyc-pending');
      return;
    }
    await toggleOnlineStatus();
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3 pt-safe flex items-center justify-between">
      {/* Brand & Partner Indicator */}
      <div 
        className="flex items-center gap-2.5 cursor-pointer"
        onClick={() => navigate('/')}
      >
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
          <Wrench className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-syne font-bold text-base tracking-tight text-white">HandyMan</span>
            <span className="text-[10px] uppercase font-mono font-bold bg-orange-500/10 text-orange-400 px-1.5 py-0.5 rounded border border-orange-500/20">
              Partner
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-sans truncate max-w-[120px]">
            {profile?.full_name || 'Service Partner'}
          </p>
        </div>
      </div>

      {/* Online / Offline Toggle & Actions */}
      <div className="flex items-center gap-2">
        {/* Availability Toggle */}
        <button
          onClick={handleToggle}
          disabled={!isKycApproved}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-syne font-bold transition-all duration-300 border ${
            isOnline
              ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/30 online-glow'
              : 'bg-slate-800/80 text-slate-400 border-slate-700'
          } ${!isKycApproved ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}
          title={isOnline ? 'Go Offline' : 'Go Online'}
        >
          <Power className={`w-3.5 h-3.5 ${isOnline ? 'text-emerald-400' : 'text-slate-500'}`} />
          <span>{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
          <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-slate-600'}`} />
        </button>

        {/* Wallet Quick Pill */}
        <button
          onClick={() => navigate('/wallet')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800/70 border border-slate-700/80 text-xs font-mono font-medium text-slate-200 active:scale-95 transition-all ${
            location.pathname === '/wallet' ? 'border-orange-500/50 bg-orange-500/10' : ''
          }`}
        >
          <WalletIcon className="w-3.5 h-3.5 text-orange-400" />
          <span>₹{technicianProfile?.wallet_balance?.toFixed(0) || '0'}</span>
        </button>

        {/* Notifications Icon */}
        <button
          onClick={() => navigate('/notifications')}
          className="p-2 rounded-xl bg-slate-800/70 border border-slate-700/80 text-slate-300 hover:text-white active:scale-95 transition-all relative"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-orange-500 rounded-full" />
        </button>
      </div>
    </header>
  );
}
