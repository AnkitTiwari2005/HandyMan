import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Wrench } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

export default function Splash() {
  const navigate = useNavigate();
  const { user, isLoading } = useAuthStore();

  useEffect(() => {
    if (isLoading) return; // wait for the real session check instead of guessing
    const timer = setTimeout(() => {
      if (user) {
        navigate('/', { replace: true });
      } else {
        navigate('/onboarding', { replace: true });
      }
    }, 900);

    return () => clearTimeout(timer);
  }, [user, isLoading, navigate]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Glow Blobs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-80 h-80 bg-orange-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-60 h-60 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, type: 'spring', bounce: 0.4 }}
        className="flex flex-col items-center z-10 text-center"
      >
        {/* Logo Badge */}
        <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center shadow-2xl shadow-orange-500/30 mb-6 border border-orange-400/30">
          <Wrench className="w-12 h-12 text-white stroke-[2.2]" />
        </div>

        <h1 className="text-3xl font-syne font-extrabold text-white tracking-tight">
          Handy<span className="text-orange-400">Man</span>
        </h1>
        <p className="text-xs font-mono font-bold tracking-widest text-slate-400 uppercase mt-1">
          Houserve Partner Network
        </p>

        <div className="mt-12 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-orange-500 animate-ping" />
          <span className="text-xs font-mono text-slate-500">Loading…</span>
        </div>
      </motion.div>
    </div>
  );
}
