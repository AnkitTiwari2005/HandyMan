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
  const { fetchProfiles } = useAuthStore();

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

      if (data.session) {
        await fetchProfiles(data.session.user.id);
        void triggerHapticImpact(ImpactStyle.Medium);
        navigate('/');
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
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
        <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-4 shadow-lg">
          <Wrench className="w-9 h-9 text-white" strokeWidth={2.5} />
        </div>

        <h1 className="font-display text-3xl font-bold text-white">HandyMan</h1>
        <p className="text-white/80 text-sm mt-1">Partner Portal</p>
      </div>

      {/* ── Form area ── */}
      <div className="flex-1 px-5 py-6 flex flex-col gap-5 pb-nav animate-fade-up">
        <div>
          <h2 className="text-xl font-bold text-ink">Welcome back</h2>
          <p className="text-sm text-ink-3 mt-0.5">Sign in to your partner account</p>
        </div>

        {error && (
          <ErrorBanner message={error} onRetry={() => setError(null)} />
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <Input
            label="Email"
            type="email"
            autoComplete="username"
            inputMode="email"
            required
            icon={<Mail className="w-4 h-4" />}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            icon={<Lock className="w-4 h-4" />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <div className="pt-2">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              full
              loading={loading}
            >
              Sign In
            </Button>
          </div>
        </form>

        <p className="text-center text-sm text-ink-3 pt-2">
          New partner?{' '}
          <Link to="/signup" className="text-brand font-medium hover:underline">
            Register here
          </Link>
        </p>
      </div>
    </div>
  );
}

