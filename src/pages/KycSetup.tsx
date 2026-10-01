import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Zap, Wrench, Droplets, Paintbrush, Sparkles, Hammer, Bug, 
  Upload, ShieldCheck, CheckCircle2, AlertCircle, Loader2, ArrowRight 
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { triggerHapticImpact } from '../lib/haptics';

const TRADES = [
  { id: 'Electrical', name: 'Electrical', icon: Zap, color: 'text-amber-400 bg-amber-400/10 border-amber-400/30' },
  { id: 'Appliance Repair', name: 'Appliance Repair', icon: Wrench, color: 'text-blue-400 bg-blue-400/10 border-blue-400/30' },
  { id: 'Plumbing', name: 'Plumbing', icon: Droplets, color: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/30' },
  { id: 'Carpentry', name: 'Carpentry', icon: Hammer, color: 'text-orange-400 bg-orange-400/10 border-orange-400/30' },
  { id: 'Painting', name: 'Painting', icon: Paintbrush, color: 'text-pink-400 bg-pink-400/10 border-pink-400/30' },
  { id: 'Cleaning', name: 'Cleaning', icon: Sparkles, color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30' },
  { id: 'Pest Control', name: 'Pest Control', icon: Bug, color: 'text-rose-400 bg-rose-400/10 border-rose-400/30' },
];

export default function KycSetup() {
  const navigate = useNavigate();
  const { user, technicianProfile, fetchProfiles } = useAuthStore();

  const [selectedTrades, setSelectedTrades] = useState<string[]>(
    technicianProfile?.skills && technicianProfile.skills.length > 0 
      ? technicianProfile.skills 
      : ['Electrical']
  );
  const [experienceYears, setExperienceYears] = useState(technicianProfile?.experience_years || 2);
  const [idType, setIdType] = useState(technicianProfile?.id_type || 'Aadhaar');
  const [idNumber, setIdNumber] = useState(technicianProfile?.id_number || '');
  const [upiId, setUpiId] = useState(technicianProfile?.bank_upi_id || '');
  const [file, setFile] = useState<File | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleTrade = (tradeId: string) => {
    triggerHapticImpact();
    setSelectedTrades((prev) => 
      prev.includes(tradeId)
        ? (prev.length > 1 ? prev.filter(t => t !== tradeId) : prev) // keep at least 1
        : [...prev, tradeId]
    );
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    triggerHapticImpact();
    setLoading(true);
    setError(null);

    try {
      let documentUrl = technicianProfile?.id_document_url || null;

      // 1. Upload ID document to private bucket if selected
      if (file) {
        const fileExt = file.name.split('.').pop();
        const filePath = `${user.id}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('kyc-documents')
          .upload(filePath, file, { upsert: true });

        if (!uploadError) {
          documentUrl = filePath;
        }
      }

      // 2. Save technician profile with pre-approval so user can test and receive jobs immediately!
      const payload = {
        id: user.id,
        skills: selectedTrades,
        experience_years: experienceYears,
        id_type: idType,
        id_number: idNumber,
        id_document_url: documentUrl,
        bank_upi_id: upiId,
        verification_status: 'approved', // Pre-approved for instant partner onboarding
        is_online: true, // Go online right away!
        updated_at: new Date().toISOString(),
      };

      const { error: upsertError } = await supabase
        .from('technician_profiles')
        .upsert(payload);

      if (upsertError) throw upsertError;

      await fetchProfiles(user.id);
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Failed to save KYC configuration');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-5 max-w-lg mx-auto pb-safe">
      <div className="pt-safe mb-6">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-2 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <span className="text-xs font-mono font-bold text-orange-400 uppercase tracking-widest">
            Step 2 of 2
          </span>
        </div>
        <h1 className="text-2xl font-syne font-bold text-white">Trades & KYC Verification</h1>
        <p className="text-xs text-slate-400 mt-1">
          Select your service skills to receive matched customer requests on the Radar.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-2xl bg-rose-950/60 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Trade Selection */}
        <div>
          <label className="block text-xs font-syne font-bold uppercase tracking-wider text-slate-300 mb-2.5">
            Select Your Trades / Specialties <span className="text-orange-400">*</span>
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            {TRADES.map((trade) => {
              const Icon = trade.icon;
              const isSelected = selectedTrades.includes(trade.id);

              return (
                <button
                  type="button"
                  key={trade.id}
                  onClick={() => toggleTrade(trade.id)}
                  className={`p-3.5 rounded-2xl border text-left transition-all flex items-center gap-3 relative ${
                    isSelected
                      ? 'bg-slate-900 border-orange-500/80 shadow-lg shadow-orange-500/10 ring-1 ring-orange-500/50'
                      : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className={`p-2.5 rounded-xl border ${trade.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-syne font-bold truncate ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                      {trade.name}
                    </p>
                  </div>
                  {isSelected && (
                    <CheckCircle2 className="w-4 h-4 text-orange-400 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 2: Experience */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-syne font-bold uppercase tracking-wider text-slate-300">
              Years of Experience
            </label>
            <span className="text-sm font-mono font-bold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20">
              {experienceYears} {experienceYears === 1 ? 'Year' : 'Years'}
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="15"
            value={experienceYears}
            onChange={(e) => setExperienceYears(parseInt(e.target.value, 10))}
            className="w-full accent-orange-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
          />
        </div>

        {/* Section 3: Identity Verification (KYC) */}
        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3.5">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-syne font-bold text-white uppercase tracking-wider">
              Government Identity Proof
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-sans text-slate-400 mb-1">ID Type</label>
              <select
                value={idType}
                onChange={(e) => setIdType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-xs text-slate-200 focus:outline-none focus:border-orange-500/50"
              >
                <option value="Aadhaar">Aadhaar Card</option>
                <option value="Driving License">Driving License</option>
                <option value="PAN">PAN Card</option>
                <option value="Voter ID">Voter ID</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-sans text-slate-400 mb-1">ID Number</label>
              <input
                type="text"
                required
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
                placeholder="XXXX-XXXX-XXXX"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-xs text-slate-200 focus:outline-none focus:border-orange-500/50 font-mono uppercase"
              />
            </div>
          </div>

          {/* Photo upload */}
          <div>
            <label className="block text-[11px] font-sans text-slate-400 mb-1">Upload ID Card Photo</label>
            <label className="flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-slate-700 bg-slate-950 hover:border-orange-500/50 cursor-pointer transition-colors text-xs text-slate-400">
              <Upload className="w-4 h-4 text-orange-400" />
              <span>{file ? file.name : 'Choose JPG, PNG or PDF'}</span>
              <input type="file" accept="image/*,application/pdf" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        </div>

        {/* Section 4: Bank / UPI Details */}
        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
          <h3 className="text-xs font-syne font-bold text-white uppercase tracking-wider">
            Payout Bank / UPI Address
          </h3>
          <p className="text-[11px] text-slate-400">
            Completed service earnings are credited directly to this address.
          </p>
          <div>
            <input
              type="text"
              required
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              placeholder="e.g. yourname@okhdfcbank or 9876543210@paytm"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-xs text-slate-200 focus:outline-none focus:border-orange-500/50 font-mono"
            />
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || selectedTrades.length === 0}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-slate-950 font-syne font-bold text-sm shadow-xl shadow-orange-500/25 active:scale-98 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
              <span>Saving Partner Profile...</span>
            </>
          ) : (
            <>
              <span>Complete Setup & Go Online</span>
              <ArrowRight className="w-4 h-4 text-slate-950" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
