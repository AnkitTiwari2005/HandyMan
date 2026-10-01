import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Navigation, Banknote, Wrench } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../components/ui';

interface Slide {
  icon: React.ReactNode;
  gradient: string;
  title: string;
  subtitle: string;
  description: string;
}

const SLIDES: Slide[] = [
  {
    icon: <Zap className="w-12 h-12 text-white" strokeWidth={2} />,
    gradient: 'from-brand to-orange-600',
    title: 'Instant Job Matching',
    subtitle: 'ZERO BIDDING',
    description:
      'Receive direct, pre-priced bookings from verified customers — no auctions, no haggling. Just show up and get paid.',
  },
  {
    icon: <Navigation className="w-12 h-12 text-white" strokeWidth={2} />,
    gradient: 'from-blue-500 to-cyan-500',
    title: 'Turn-by-Turn Navigation',
    subtitle: 'PRECISE ROUTING',
    description:
      'Built-in Maps integration guides you to every job. OTP-protected check-ins keep your earnings safe from fraud.',
  },
  {
    icon: <Banknote className="w-12 h-12 text-white" strokeWidth={2} />,
    gradient: 'from-money to-green-600',
    title: 'Daily Payouts',
    subtitle: '80% GUARANTEED',
    description:
      'Your earnings are credited the moment a job is marked complete. Keep 80 % of every booking — no hidden deductions.',
  },
];

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 280 : -280, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -280 : 280, opacity: 0 }),
};

export default function Onboarding() {
  const navigate = useNavigate();
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(1);

  const goNext = () => {
    if (current < SLIDES.length - 1) {
      setDirection(1);
      setCurrent((c) => c + 1);
    } else {
      navigate('/signup');
    }
  };

  const slide = SLIDES[current];
  const isLast = current === SLIDES.length - 1;

  return (
    <div className="min-h-dvh bg-bg flex flex-col max-w-lg mx-auto">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 pt-safe pt-4 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl gradient-brand flex items-center justify-center">
            <Wrench className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-display text-base font-bold text-white">
            Handy<span className="text-brand">Man</span>
          </span>
        </div>

        <button
          onClick={() => navigate('/login')}
          className="text-sm text-ink-3 hover:text-ink transition-colors px-3 py-2 rounded-xl"
        >
          Skip
        </button>
      </div>

      {/* Slide area */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={current}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="flex flex-col items-center gap-5 text-center w-full"
          >
            {/* Icon badge */}
            <div
              className={`w-24 h-24 rounded-3xl bg-gradient-to-br ${slide.gradient} flex items-center justify-center shadow-2xl`}
            >
              {slide.icon}
            </div>

            {/* Subtitle / pill */}
            <p className="text-brand font-mono text-xs uppercase tracking-widest">
              {slide.subtitle}
            </p>

            {/* Title */}
            <h2 className="font-display text-3xl font-bold text-ink leading-tight">
              {slide.title}
            </h2>

            {/* Description */}
            <p className="text-sm text-ink-2 max-w-xs leading-relaxed">
              {slide.description}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom controls */}
      <div className="px-5 pb-safe pb-8 flex flex-col items-center gap-6">
        {/* Pagination dots */}
        <div className="flex items-center gap-2">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                setDirection(i > current ? 1 : -1);
                setCurrent(i);
              }}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === current ? 'w-6 bg-brand' : 'w-2 bg-card-3'
              }`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>

        {/* CTA */}
        <Button
          variant="primary"
          size="lg"
          full
          onClick={goNext}
        >
          {isLast ? 'Get Started' : 'Next'}
        </Button>

        {/* Login link */}
        <button
          onClick={() => navigate('/login')}
          className="text-sm text-ink-3 hover:text-ink transition-colors pb-2"
        >
          Already a partner?{' '}
          <span className="text-brand font-medium">Log in</span>
        </button>
      </div>
    </div>
  );
}
