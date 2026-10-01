import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User, Phone, Mail, Wrench, ShieldCheck, Star, 
  MapPin, LogOut, CheckCircle2, Loader2, Sparkles 
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { triggerHapticImpact } from '../lib/haptics';

const ALL_TRADES = [
  'Electrical',
  'Appliance Repair',
  'Plumbing',
  'Carpentry',
  'Painting',
  'Cleaning',
  'Pest Control'
];

export default function Profile() {
  const navigate = useNavigate();
  const { user, profile, technicianProfile, signOut, fetchProfiles } = useAuthStore();

  const [skills, setSkills] = useState<string[]>(technicianProfile?.skills || ['Electrical']);
  const [radius, setRadius] = useState<number>(technicianProfile?.service_radius_km || 15);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const toggleSkill = (trade: string) => {
    triggerHapticImpact();
    setSkills((prev) => 
      prev.includes(trade)
        ? (prev.length > 1 ? prev.filter(t => t !== trade) : prev)
        : [...prev, trade]
    );
  };

  const handleSavePreferences = async () => {
    if (!user) return;
    triggerHapticImpact();
    setSaving(true);
    setSaveSuccess(false);

    try {
      const { error } = await supabase
        .from('technician_profiles')
        .update({
          skills,
          service_radius_km: radius,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) throw error;
      await fetchProfiles(user.id);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    triggerHapticImpact();
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto pb-safe">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-syne font-bold text-white">Partner Profile</h1>
          <p className="text-xs text-slate-400">Credentials, active trades, and radius</p>
        </div>
      </div>

      {/* Profile Info Header */}
      <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center font-syne font-bold text-2xl text-white shadow-lg shadow-orange-500/20 shrink-0">
          {profile?.full_name?.charAt(0) || 'P'}
        </div>
        <div className="overflow-hidden">
          <div className="flex items-center gap-2">
            <h2 className="font-syne font-bold text-lg text-white truncate">
              {profile?.full_name || 'Service Partner'}
            </h2>
            {technicianProfile?.verification_status === 'approved' ? (
              <span className="text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded">Verified</span>
            ) : (
              <span className="text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded capitalize">
                {technicianProfile?.verification_status ?? 'Pending'}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5 font-mono">
            <Mail className="w-3.5 h-3.5 text-slate-500" />
            <span className="truncate">{profile?.email}</span>
          </p>
          {profile?.phone && (
            <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5 font-mono">
              <Phone className="w-3.5 h-3.5 text-slate-500" />
              <span>{profile.phone}</span>
            </p>
          )}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 text-center">
          <p className="text-[10px] font-syne text-slate-400 uppercase">Jobs Done</p>
          <p className="text-base font-mono font-bold text-white mt-0.5">
            {technicianProfile?.total_completed_jobs || 0}
          </p>
        </div>
        <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 text-center">
          <p className="text-[10px] font-syne text-slate-400 uppercase">Rating</p>
          <div className="flex items-center justify-center gap-1 mt-0.5">
            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            <span className="text-base font-mono font-bold text-white">
              {technicianProfile?.rating?.toFixed(1) || '5.0'}
            </span>
          </div>
        </div>
        <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 text-center">
          <p className="text-[10px] font-syne text-slate-400 uppercase">Experience</p>
          <p className="text-base font-mono font-bold text-orange-400 mt-0.5">
            {technicianProfile?.experience_years || 1} Yrs
          </p>
        </div>
      </div>

      {/* Trade Skills Configuration */}
      <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-3.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-syne font-bold uppercase tracking-wider text-white">
            Active Service Trades
          </h3>
          <span className="text-[11px] font-mono text-orange-400">
            {skills.length} Selected
          </span>
        </div>
        <p className="text-[11px] text-slate-400">
          Toggle trades to start or stop receiving matching booking offers.
        </p>

        <div className="flex flex-wrap gap-2 pt-1">
          {ALL_TRADES.map((trade) => {
            const isSelected = skills.includes(trade);
            return (
              <button
                key={trade}
                type="button"
                onClick={() => toggleSkill(trade)}
                className={`px-3 py-2 rounded-xl text-xs font-syne font-bold transition-all border ${
                  isSelected
                    ? 'bg-orange-500/15 text-orange-400 border-orange-500/50 shadow-sm'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                }`}
              >
                {isSelected ? `✓ ${trade}` : `+ ${trade}`}
              </button>
            );
          })}
        </div>

        {/* Operating Radius */}
        <div className="pt-3 border-t border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-syne font-bold text-slate-300">Dispatch Radius</span>
            <span className="font-mono font-bold text-orange-400">{radius} km</span>
          </div>
          <input
            type="range"
            min="5"
            max="30"
            step="1"
            value={radius}
            onChange={(e) => setRadius(parseInt(e.target.value, 10))}
            className="w-full accent-orange-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
          />
        </div>

        {/* Save button */}
        <button
          onClick={handleSavePreferences}
          disabled={saving}
          className="w-full mt-2 py-3 rounded-2xl bg-slate-800 hover:bg-slate-750 text-white font-syne font-bold text-xs border border-slate-700 active:scale-98 transition-all flex items-center justify-center gap-1.5"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin text-orange-400" />
          ) : saveSuccess ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <Wrench className="w-4 h-4 text-orange-400" />
          )}
          <span>{saveSuccess ? 'Saved Preferences!' : 'Update Trade Preferences'}</span>
        </button>
      </div>

      {/* Linked Bank / UPI Display */}
      <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-between">
        <div>
          <span className="text-[10px] font-syne font-bold uppercase text-slate-400 tracking-wider">
            Linked Settlement Account
          </span>
          <p className="font-mono text-xs font-bold text-white mt-0.5">
            {technicianProfile?.bank_upi_id || 'Not configured'}
          </p>
        </div>
        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-lg">
          Active
        </span>
      </div>

      {/* Sign Out Button */}
      <button
        onClick={handleSignOut}
        className="w-full py-4 rounded-2xl bg-rose-950/30 hover:bg-rose-950/50 text-rose-400 font-syne font-bold text-xs border border-rose-500/20 active:scale-98 transition-all flex items-center justify-center gap-2"
      >
        <LogOut className="w-4 h-4" />
        <span>Go Offline & Sign Out</span>
      </button>
    </div>
  );
}
