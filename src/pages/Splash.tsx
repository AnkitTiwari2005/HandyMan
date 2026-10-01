import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wrench } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../stores/authStore';

export default function Splash() {
  const navigate = useNavigate();
  const { isLoading, user } = useAuthStore();

  useEffect(() => {
    if (isLoading) return;

    const timer = setTimeout(() => {
      if (user) {
        navigate('/');
      } else {
        navigate('/onboarding');
      }
    }, 900);

    return () => clearTimeout(timer);
  }, [isLoading, user, navigate]);

  return (
    <div className="relative min-h-dvh bg-bg flex flex-col items-center justify-center overflow-hidden">
      {/* Ambient blob — top left */}
      <div
        className="absolute -top-32 -left-32 w-80 h-80 rounded-full bg-brand opacity-20 blur-3xl pointer-events-none"
        aria-hidden
      />
      {/* Ambient blob — center */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-brand opacity-10 blur-[100px] pointer-events-none"
        aria-hidden
      />

      {/* Logo + wordmark */}
      <AnimatePresence>
        <div className="flex flex-col items-center gap-6 z-10">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20, duration: 0.7 }}
            className="w-24 h-24 rounded-3xl gradient-brand flex items-center justify-center shadow-2xl"
          >
            <Wrench className="w-12 h-12 text-white" strokeWidth={2} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="flex flex-col items-center gap-1"
          >
            <h1 className="font-display text-4xl font-bold text-white">
              Handy<span className="text-brand">Man</span>
            </h1>
            <p className="text-xs font-mono text-ink-3 uppercase tracking-widest">
              Houserve Partner Network
            </p>
          </motion.div>
        </div>
      </AnimatePresence>

      {/* Loading dots */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="absolute bottom-16 flex items-center gap-2"
        aria-label="Loading"
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-2 h-2 rounded-full bg-brand"
            style={{
              animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </motion.div>

      {/* Keyframe for the dots */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.25; transform: scale(0.8); }
          50%       { opacity: 1;    transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}
