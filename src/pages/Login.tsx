import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Wrench, Mail, Lock } from 'lucide-react';
import { Button, Input, ErrorBanner } from '../components/ui';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { triggerHapticImpact } from '../lib/haptics';
import { ImpactStyle } from '@capacitor/haptics';

export default function Login() {
  const navigate = useNavigate();
  const { setUser, fetchProfiles } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    void triggerHapticImpact(ImpactStyle.Light);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        setError(authError.message);
        void triggerHapticImpact(ImpactStyle.Heavy);
        return;
      }

      if (data.user) {
        setUser(data.user);
        await fetchProfiles(data.user.id);
        void triggerHapticImpact(ImpactStyle.Medium);

        // Smart redirect to avoid intermediate hops or blank screen loops
        const tech = useAuthStore.getState().technicianProfile;
        if (!tech) {
          navigate('/kyc', { replace: true });
        } else if (tech.verification_status !== 'approved') {
          navigate('/kyc-pending', { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid partner credentials. Please try again.';
      setError(msg);
      void triggerHapticImpact(ImpactStyle.Heavy);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-bg flex flex-col max-w-lg mx-auto">
      {/* ── Diagonal hero header ── */}
      <div
        className="gradient-brand flex flex-col items-center justify-center py-12 px-6 relative overflow-hidden"
        style={{ clipPath: 'polygon(0 0, 100% 0, 100% 88%, 0 100%)' }}
      >
        {/* Subtle noise overlay */}
        <div className="absolute inset-0 opacity-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJub2lzZSI+PGZlVHVyYnVsZW5jZSB0eXBlPSJmcmFjdGFsTm9pc2UiIGJhc2VGcmVxdWVuY3k9IjAuNjUiIG51bU9jdGF2ZXM9IjMiIHN0aXRjaFRpbGVzPSJzdGl0Y2giLz48L2ZpbHRlcj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgZmlsdGVyPSJ1cmwoI25vaXNlKSIgb3BhY2l0eT0iMSIvPjwvc3ZnPg==')] pointer-events-none" />

        {/* Logo badge */}
        <div className="w-16 h-16 rounded-2xl bg-white shadow-xl flex items-center justify-center mb-3">
          <Wrench className="w-8 h-8 text-brand" />
        </div>

        <h1 className="font-display text-3xl font-bold text-white tracking-tight">HandyMan</h1>
        <p className="text-white/80 text-sm font-medium mt-0.5">Partner Operating System</p>
      </div>

      {/* ── Form container ── */}
      <div className="flex-1 px-5 py-6 flex flex-col justify-between">
        <div className="space-y-5 animate-fade-up stagger-1">
          <div>
            <h2 className="text-xl font-bold text-ink">Welcome back</h2>
            <p className="text-sm text-ink-3 mt-1">Sign in to check live requests and your wallet.</p>
          </div>

          {error && <ErrorBanner message={error} />}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email address"
              icon={<Mail className="w-4 h-4" />}
              type="email"
              autoComplete="username"
              inputMode="email"
              placeholder="technician@houserve.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Input
              label="Password"
              icon={<Lock className="w-4 h-4" />}
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              full
              loading={loading}
              className="mt-2"
            >
              Sign In
            </Button>
          </form>
        </div>

        {/* ── Footer ── */}
        <div className="pt-6 pb-nav text-center border-t border-line mt-6">
          <p className="text-sm text-ink-3">
            New service partner?{' '}
            <Link to="/signup" className="text-brand font-semibold hover:underline">
              Register here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
