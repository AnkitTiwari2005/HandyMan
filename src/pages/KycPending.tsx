import { ShieldAlert, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';

export default function KycPending() {
  const navigate = useNavigate();
  const { user, fetchProfiles } = useAuthStore();

  const handleInstantApprove = async () => {
    if (!user) return;
    try {
      await supabase
        .from('technician_profiles')
        .update({ verification_status: 'approved', is_online: true })
        .eq('id', user.id);
      await fetchProfiles(user.id);
      navigate('/', { replace: true });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-6 max-w-lg mx-auto">
      <div className="pt-safe flex items-center justify-between">
        <span className="font-syne font-bold text-lg text-white">HandyMan</span>
      </div>

      <div className="my-auto py-8 text-center flex flex-col items-center">
        <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-6">
          <ShieldAlert className="w-10 h-10" />
        </div>

        <h2 className="text-2xl font-syne font-bold text-white mb-2">
          Profile Verification
        </h2>
        <p className="text-xs text-slate-400 max-w-xs mb-8">
          Your credentials and identity documents are safely registered in our partner database.
        </p>

        <button
          onClick={handleInstantApprove}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 font-syne font-bold text-sm shadow-xl shadow-orange-500/25 active:scale-98 transition-all flex items-center justify-center gap-2"
        >
          <span>Activate Partner & Go Online</span>
          <ArrowRight className="w-4 h-4 text-slate-950" />
        </button>
      </div>

      <div className="text-center pb-safe">
        <p className="text-xs text-slate-500">
          Need help? Contact partner-support@houserve.com
        </p>
      </div>
    </div>
  );
}
