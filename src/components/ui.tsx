import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';

/* Small shared kit so screens stop copy-pasting 150-character class strings. */

type Variant = 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-slate-950 hover:bg-brand-strong active:bg-brand-strong font-bold',
  secondary: 'bg-card-2 text-ink border border-line hover:border-ink-3 font-semibold',
  success: 'bg-money text-slate-950 hover:brightness-95 font-bold',
  danger: 'bg-transparent text-danger border border-danger/40 hover:bg-danger/10 font-semibold',
  ghost: 'bg-transparent text-ink-2 hover:text-ink hover:bg-card-2 font-semibold',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  full?: boolean;
  size?: 'md' | 'lg';
  icon?: ReactNode;
}

/** Min height 48px (md) / 56px (lg) so it works with gloves and one thumb. */
export function Button({
  variant = 'primary', loading, full, size = 'md', icon, className = '', children, disabled, ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl px-5 text-base transition-all
        active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed
        ${size === 'lg' ? 'min-h-14' : 'min-h-12'} ${full ? 'w-full' : ''} ${VARIANTS[variant]} ${className}`}
    >
      {loading ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden /> : icon}
      <span>{children}</span>
    </button>
  );
}

export function Card({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  const base = `rounded-2xl bg-card border border-line ${className}`;
  return onClick ? (
    <button onClick={onClick} className={`${base} w-full text-left active:scale-[0.99] transition-transform`}>
      {children}
    </button>
  ) : (
    <div className={base}>{children}</div>
  );
}

type Tone = 'brand' | 'money' | 'warn' | 'danger' | 'neutral';
const TONES: Record<Tone, string> = {
  brand: 'bg-brand-soft text-brand',
  money: 'bg-money/15 text-money',
  warn: 'bg-warn/15 text-warn',
  danger: 'bg-danger/15 text-danger',
  neutral: 'bg-card-2 text-ink-2',
};
export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: Tone }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${TONES[tone]}`}>
      {children}
    </span>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line px-6 py-10 text-center flex flex-col items-center">
      <div className="w-12 h-12 rounded-2xl bg-card-2 text-ink-3 flex items-center justify-center mb-3">{icon}</div>
      <p className="text-base font-semibold text-ink">{title}</p>
      {body && <p className="text-sm text-ink-2 mt-1 max-w-xs">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-2xl bg-danger/10 border border-danger/30 p-3.5 text-sm text-danger">
      <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden />
      <span className="flex-1 text-ink">{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="inline-flex items-center gap-1 font-semibold text-danger min-h-8" aria-label="Retry">
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      )}
    </div>
  );
}
