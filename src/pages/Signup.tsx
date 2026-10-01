import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Wrench, Mail, Lock, User, Phone, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { triggerHapticImpact } from '../lib/haptics';

export default function Signup() {
  const navigate = useNavigate();
  const { setUser, fetchProfiles } = useAuthStore();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    triggerHapticImpact();
    setError(null);
    setLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            phone: phone.trim(),
            role: 'technician',
          },
        },
      });

      if (authError) throw authError;

      // Ensure active session is established
      let activeUser = data.user;
      let activeSession = data.session;

      if (!activeSession && data.user) {
        // Attempt immediate login if auto-confirmed
        const { data: loginData } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (loginData?.session) {
          activeSession = loginData.session;
          activeUser = loginData.user;
        }
      }

      if (activeSession && activeUser) {
        setUser(activeUser);
        await fetchProfiles(activeUser.id);
        navigate('/kyc', { replace: true });
      } else {
        // Redirect to login to authenticate with confirmed credentials
        navigate('/login', { replace: true });
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please check details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-6 max-w-lg mx-auto">
      {/* Top Header */}
      <div className="pt-safe flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
            <Wrench className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-syne font-bold text-lg text-white">HandyMan</h1>
            <p className="text-[11px] font-mono text-orange-400 font-bold uppercase tracking-wider">Partner Registration</p>
          </div>
        </div>
      </div>

      {/* Signup Form */}
      <div className="my-auto py-4">
        <div className="mb-5">
          <h2 className="text-2xl font-syne font-bold text-white">Join as a Partner</h2>
          <p className="text-xs text-slate-400 mt-1">
            Get assigned high-value electrician, AC, plumbing, and carpentry jobs.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-2xl bg-rose-950/60 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-3.5">
          <div>
            <label className="block text-xs font-syne font-semibold text-slate-300 mb-1">
              Full Legal Name
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ramesh Kumar"
                className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-3 pl-10 pr-4 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-orange-500/60 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-syne font-semibold text-slate-300 mb-1">
              Mobile Number (For Customer Contact)
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 9876543210"
                className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-3 pl-10 pr-4 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-orange-500/60 transition-all font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-syne font-semibold text-slate-300 mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="partner@houserve.com"
                className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-3 pl-10 pr-4 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-orange-500/60 transition-all font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-syne font-semibold text-slate-300 mb-1">
              Create Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-3 pl-10 pr-4 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-orange-500/60 transition-all font-mono"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-3 py-4 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-slate-950 font-syne font-bold text-sm shadow-xl shadow-orange-500/25 active:scale-98 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                <span>Registering Partner Profile...</span>
              </>
            ) : (
              <>
                <span>Continue to Trade Setup</span>
                <ArrowRight className="w-4 h-4 text-slate-950" />
              </>
            )}
          </button>
        </form>
      </div>

      {/* Footer */}
      <div className="pt-3 border-t border-slate-800/80 text-center pb-safe">
        <p className="text-xs text-slate-400">
          Already registered?{' '}
          <Link to="/login" className="text-orange-400 font-syne font-bold hover:underline">
            Sign In here
          </Link>
        </p>
      </div>
    </div>
  );
}
