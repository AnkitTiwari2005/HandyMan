import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Wrench, User, Phone, Mail, Lock } from 'lucide-react';
import { Button, Input, ErrorBanner } from '../components/ui';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { triggerHapticImpact } from '../lib/haptics';
import { ImpactStyle } from '@capacitor/haptics';

export default function Signup() {
  const navigate = useNavigate();
  const { setUser, fetchProfiles } = useAuthStore();

  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      void triggerHapticImpact(ImpactStyle.Heavy);
      return;
    }

    setLoading(true);
    void triggerHapticImpact(ImpactStyle.Light);

    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            phone: mobile.trim(),
            role: 'technician',
          },
        },
      });

      if (authError) {
        setError(authError.message);
        void triggerHapticImpact(ImpactStyle.Heavy);
        return;
      }

      if (data.user && data.session) {
        setUser(data.user);
        await fetchProfiles(data.user.id);
        void triggerHapticImpact(ImpactStyle.Medium);
        navigate('/kyc', { replace: true });
      } else {
        // Email confirmation required
        setNotice(
          'Account created! Check your email and click the confirmation link, then sign in.'
        );
        void triggerHapticImpact(ImpactStyle.Medium);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed. Please try again.';
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

        <h1 className="font-display text-3xl font-bold text-white tracking-tight">Join as Partner</h1>
        <p className="text-white/80 text-sm font-medium mt-0.5">Start Earning Today</p>
      </div>

      {/* ── Form container ── */}
      <div className="flex-1 px-5 py-6 flex flex-col justify-between">
        <div className="space-y-4 animate-fade-up stagger-1">
          <div>
            <h2 className="text-xl font-bold text-ink">Create partner account</h2>
            <p className="text-sm text-ink-3 mt-1">Get matched with high-paying local jobs.</p>
          </div>

          {error && <ErrorBanner message={error} />}

          {notice && (
            <div className="rounded-xl bg-money-soft border border-money/30 p-3.5 text-sm text-money font-medium">
              {notice}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <Input
              label="Full Name"
              icon={<User className="w-4 h-4" />}
              type="text"
              placeholder="e.g. Ramesh Kumar"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />

            <Input
              label="Mobile Number"
              icon={<Phone className="w-4 h-4" />}
              type="tel"
              inputMode="tel"
              placeholder="+91 9876543210"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              required
            />

            <Input
              label="Email address"
              icon={<Mail className="w-4 h-4" />}
              type="email"
              autoComplete="email"
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
              autoComplete="new-password"
              placeholder="Min. 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              hint="Must be at least 8 characters"
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
              Continue to Trade Setup
            </Button>
          </form>
        </div>

        {/* ── Footer ── */}
        <div className="pt-6 pb-nav text-center border-t border-line mt-6">
          <p className="text-sm text-ink-3">
            Already registered?{' '}
            <Link to="/login" className="text-brand font-semibold hover:underline">
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
