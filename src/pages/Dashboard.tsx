import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Radio, Power, ArrowRight, IndianRupee, Star, CheckCircle2, 
  MapPin, Clock, Calendar, AlertCircle, Wrench, Sparkles, Navigation 
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useRadarStore } from '../stores/radarStore';
import { triggerHapticImpact } from '../lib/haptics';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, technicianProfile, toggleOnlineStatus, updateLocation } = useAuthStore();
  const { 
    activeJob, 
    availableJobs, 
    startRadarSubscription, 
    claimJob, 
    isClaiming 
  } = useRadarStore();

  const isOnline = technicianProfile?.is_online ?? false;
  const skills = technicianProfile?.skills ?? ['Electrical'];

  // Start Realtime Radar subscription when user is online
  useEffect(() => {
    if (!user) return;
    const unsubscribe = startRadarSubscription(user.id, skills);

    // Request GPS location
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          updateLocation(pos.coords.latitude, pos.coords.longitude);
        },
        (err) => console.warn('GPS location skipped:', err),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }

    return () => {
      unsubscribe();
    };
  }, [user, skills, startRadarSubscription, updateLocation]);

  const handleToggleOnline = async () => {
    triggerHapticImpact();
    await toggleOnlineStatus();
  };

  const handleManualClaim = async (bookingId: string) => {
    if (!user) return;
    const res = await claimJob(bookingId, user.id);
    if (res.success) {
      navigate(`/job/${bookingId}`);
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* 1. Radar Cockpit Status Hero */}
      <div className={`p-5 rounded-3xl border transition-all duration-300 relative overflow-hidden ${
        isOnline
          ? 'bg-gradient-to-b from-slate-900 to-slate-950 border-emerald-500/40 shadow-xl shadow-emerald-500/5'
          : 'bg-slate-900/60 border-slate-800'
      }`}>
        <div className="flex items-center justify-between relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-ping' : 'bg-slate-600'}`} />
              <h2 className="text-base font-syne font-bold text-white tracking-wide uppercase">
                {isOnline ? 'Radar Active & Scanning' : 'Partner Offline'}
              </h2>
            </div>
            <p className="text-xs text-slate-400 max-w-[220px]">
              {isOnline
                ? `Receiving jobs for: ${skills.join(', ')}`
                : 'Turn on radar to start receiving job offers in your area'}
            </p>
          </div>

          {/* Big Interactive Power Button */}
          <button
            onClick={handleToggleOnline}
            className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-xl active:scale-90 ${
              isOnline
                ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/30 online-glow'
                : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-white'
            }`}
          >
            <Power className="w-6 h-6 stroke-[2.5]" />
          </button>
        </div>

        {/* Radar Scanning Ring Effect when online */}
        {isOnline && (
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-emerald-400">
            <div className="flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              <span>Realtime Broadcast Connected</span>
            </div>
            <span className="text-slate-400">Radius: {technicianProfile?.service_radius_km || 15}km</span>
          </div>
        )}
      </div>

      {/* 2. Active Job Banner (High Priority) */}
      {activeJob && (
        <div 
          onClick={() => navigate(`/job/${activeJob.id}`)}
          className="p-4 rounded-3xl bg-gradient-to-r from-orange-600 to-amber-600 text-slate-950 shadow-xl shadow-orange-500/20 cursor-pointer active:scale-98 transition-transform relative overflow-hidden"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="px-2.5 py-0.5 rounded-full bg-slate-950 text-orange-400 text-[10px] font-mono font-bold uppercase tracking-wider">
              {activeJob.status.replace('_', ' ')}
            </span>
            <span className="font-mono text-xs font-bold text-slate-900 bg-white/20 px-2 py-0.5 rounded-lg">
              {activeJob.booking_ref}
            </span>
          </div>

          <h3 className="font-syne font-bold text-lg text-white">
            {activeJob.services?.name || 'Assigned Service'}
          </h3>
          
          <div className="flex items-center gap-3 mt-1 text-xs text-orange-100 font-medium">
            <div className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              <span className="truncate max-w-[140px]">
                {activeJob.address_snapshot?.city || 'Customer Locality'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>{activeJob.scheduled_time}</span>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-white/20 flex items-center justify-between text-xs font-syne font-bold">
            <span className="text-white">Tap to Open Job Cockpit</span>
            <div className="flex items-center gap-1 bg-white text-slate-950 px-3 py-1 rounded-xl shadow-sm">
              <Navigation className="w-3.5 h-3.5" />
              <span>Resume</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Performance & Earnings Ribbon */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 text-center">
          <p className="text-[10px] font-syne font-semibold text-slate-400 uppercase tracking-wider">Wallet</p>
          <p className="text-base font-mono font-bold text-emerald-400 mt-0.5">
            ₹{technicianProfile?.wallet_balance?.toFixed(0) || '0'}
          </p>
        </div>

        <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 text-center">
          <p className="text-[10px] font-syne font-semibold text-slate-400 uppercase tracking-wider">Jobs Done</p>
          <p className="text-base font-mono font-bold text-white mt-0.5">
            {technicianProfile?.total_completed_jobs || 0}
          </p>
        </div>

        <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 text-center">
          <p className="text-[10px] font-syne font-semibold text-slate-400 uppercase tracking-wider">Rating</p>
          <div className="flex items-center justify-center gap-1 mt-0.5">
            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            <span className="text-base font-mono font-bold text-white">
              {technicianProfile?.rating?.toFixed(1) || '5.0'}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Open Orders Radar Feed */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-orange-400" />
            <h3 className="text-sm font-syne font-bold text-white tracking-wide uppercase">
              Nearby Open Requests ({availableJobs.length})
            </h3>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Live Feed
          </span>
        </div>

        {availableJobs.length === 0 ? (
          <div className="p-8 rounded-3xl bg-slate-900/40 border border-slate-800/80 text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-800/60 flex items-center justify-center text-slate-500 mb-3">
              <Radio className="w-6 h-6 animate-pulse text-orange-400/60" />
            </div>
            <p className="text-sm font-syne font-bold text-slate-300">
              No Open Jobs Currently in Area
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-xs">
              Keep your status Online. New customer bookings from Houserve will ring your radar instantly.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {availableJobs.map((job) => {
              const payout = Math.round(job.subtotal * 0.8);
              const address = job.address_snapshot;

              return (
                <div
                  key={job.id}
                  className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-syne font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20 mb-1">
                        {job.services?.category || 'Service'}
                      </span>
                      <h4 className="font-syne font-bold text-sm text-white">
                        {job.services?.name || 'General Maintenance'}
                      </h4>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          {job.scheduled_date}
                        </span>
                        <span className="flex items-center gap-1 text-orange-300">
                          <Clock className="w-3 h-3" />
                          {job.scheduled_time}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-[10px] font-syne text-slate-400 uppercase">Payout</p>
                      <p className="text-lg font-mono font-bold text-emerald-400">
                        ₹{payout}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-400 overflow-hidden max-w-[200px] truncate">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">{address?.street || address?.city || 'Nearby Locality'}</span>
                    </div>

                    <button
                      onClick={() => handleManualClaim(job.id)}
                      disabled={isClaiming || Boolean(activeJob)}
                      className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-slate-950 font-syne font-bold text-xs shadow-md shadow-orange-500/20 active:scale-95 transition-all disabled:opacity-40"
                    >
                      Accept Job
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
