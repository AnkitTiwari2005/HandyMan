import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Navigation, Banknote, ArrowRight, ShieldCheck } from 'lucide-react';
import { triggerHapticImpact } from '../lib/haptics';

const slides = [
  {
    id: 1,
    icon: Zap,
    title: 'Instant Job Radar',
    subtitle: 'Zero Bidding Wars',
    description: 'Get matched directly with pre-priced, verified home service bookings from Houserve customers in your area.',
    color: 'from-orange-500 to-amber-500',
    badge: 'Direct Dispatch',
  },
  {
    id: 2,
    icon: Navigation,
    title: 'Turn-by-Turn Routing',
    subtitle: 'Precision Arrival',
    description: 'One-tap Google Maps navigation right to the customer doorstep with anti-fraud OTP job start verification.',
    color: 'from-blue-500 to-cyan-500',
    badge: 'Verified Locations',
  },
  {
    id: 3,
    icon: Banknote,
    title: 'Fast Daily Payouts',
    subtitle: 'Guaranteed 80% Take-Home',
    description: 'Earn on every completed service with zero hidden deductions. Request payouts directly to your UPI or bank account.',
    color: 'from-emerald-500 to-teal-500',
    badge: 'Daily Settlements',
  },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);

  const handleNext = () => {
    triggerHapticImpact();
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      navigate('/signup');
    }
  };

  const slide = slides[currentSlide];
  const Icon = slide.icon;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-6 max-w-lg mx-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between pt-safe">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-orange-500 flex items-center justify-center font-syne font-bold text-white text-sm">
            H
          </div>
          <span className="font-syne font-bold text-base text-white">HandyMan</span>
        </div>
        <button
          onClick={() => navigate('/login')}
          className="text-xs font-syne font-bold text-slate-400 hover:text-white px-3 py-1.5 rounded-full hover:bg-slate-900 transition-colors"
        >
          Sign In
        </button>
      </div>

      {/* Slide Visual and Content */}
      <div className="my-auto py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={slide.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center text-center"
          >
            {/* Visual Icon Halo */}
            <div className="relative mb-8">
              <div className={`w-28 h-28 rounded-3xl bg-gradient-to-tr ${slide.color} flex items-center justify-center shadow-2xl shadow-orange-500/20`}>
                <Icon className="w-14 h-14 text-white" />
              </div>
              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-slate-900 border border-slate-750 text-[10px] font-syne font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1 shadow-md whitespace-nowrap">
                <ShieldCheck className="w-3 h-3 text-orange-400" />
                <span>{slide.badge}</span>
              </div>
            </div>

            {/* Typography */}
            <h2 className="text-2xl font-syne font-bold text-white mb-1">
              {slide.title}
            </h2>
            <p className="text-xs font-mono font-bold text-orange-400 uppercase tracking-widest mb-3">
              {slide.subtitle}
            </p>
            <p className="text-sm text-slate-400 max-w-xs leading-relaxed">
              {slide.description}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom Controls */}
      <div className="space-y-6 pb-safe">
        {/* Pagination Dots */}
        <div className="flex items-center justify-center gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentSlide(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === currentSlide ? 'w-8 bg-orange-500' : 'w-2 bg-slate-800'
              }`}
            />
          ))}
        </div>

        {/* Buttons */}
        <div className="space-y-3">
          <button
            onClick={handleNext}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-slate-950 font-syne font-bold text-sm shadow-xl shadow-orange-500/25 active:scale-98 transition-all flex items-center justify-center gap-2"
          >
            <span>{currentSlide === slides.length - 1 ? 'Start Partner Registration' : 'Next'}</span>
            <ArrowRight className="w-4 h-4 text-slate-950" />
          </button>

          <button
            onClick={() => navigate('/login')}
            className="w-full py-3 text-center text-xs font-syne font-bold text-slate-400 hover:text-white transition-colors"
          >
            Already an approved partner? <span className="text-orange-400 underline">Log In</span>
          </button>
        </div>
      </div>
    </div>
  );
}
