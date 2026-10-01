import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Wrench } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

export default function Splash() {
  const navigate = useNavigate();
  const { user, technicianProfile, isLoading } = useAuthStore();

  useEffect(() => {
    if (isLoading) return; // Wait until initial session check is complete

    const timer = setTimeout(() => {
      if (user) {
        if (!technicianProfile) {
          navigate('/kyc', { replace: true });
        } else if (technicianProfile.verification_status !== 'approved') {
          navigate('/kyc-pending', { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      } else {
        navigate('/onboarding', { replace: true });
      }
    }, 900);

    return () => clearTimeout(timer);
  }, [user, technicianProfile, isLoading, navigate]);

  return (
    <div className="min-h-dvh bg-bg flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* ── Glowing background blobs for depth ── */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-80 h-80 bg-brand-soft rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-60 h-60 bg-brand-glow rounded-full blur-2xl pointer-events-none" />

      {/* ── Center brand content ── */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, type: 'spring', bounce: 0.4 }}
        className="flex flex-col items-center z-10 text-center"
      >
        {/* Logo badge */}
        <div className="w-24 h-24 rounded-3xl gradient-brand flex items-center justify-center shadow-2xl shadow-brand/40 mb-6 border border-brand/30">
          <Wrench className="w-12 h-12 text-white stroke-[2.2]" />
        </div>

        {/* Wordmark */}
        <h1 className="text-4xl font-display font-bold text-ink tracking-tight">
          Handy<span className="text-brand">Man</span>
        </h1>
        <p className="text-xs font-mono font-bold tracking-widest text-ink-3 uppercase mt-1">
          Houserve Partner Network
        </p>

        {/* ── Staggered pulsing loader dots ── */}
        <div className="mt-12 flex items-center gap-2">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-2.5 h-2.5 rounded-full bg-brand animate-pulse"
              style={{ animationDelay: `${i * 0.25}s` }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}
