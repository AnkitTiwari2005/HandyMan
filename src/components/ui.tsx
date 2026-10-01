import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';
import { Loader2, AlertCircle, RefreshCw, Info, Check } from 'lucide-react';

/* ══════════════════════════════════════════════════════════════
   HANDYMAN UI COMPONENT LIBRARY
   Premium shared kit — every page imports from here.
══════════════════════════════════════════════════════════════ */

// ── Button ────────────────────────────────────────────────────
type BtnVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'ghost' | 'outline';
type BtnSize = 'sm' | 'md' | 'lg';

const BTN_VARIANTS: Record<BtnVariant, string> = {
  primary:   'gradient-brand text-white shadow-lg shadow-brand/25 hover:shadow-brand/40 hover:brightness-110',
  secondary: 'bg-card-2 text-ink border border-line hover:bg-card-3 hover:border-ink-4',
  success:   'gradient-money text-white shadow-lg shadow-money/25 hover:brightness-110',
  danger:    'bg-danger-soft text-danger border border-danger/30 hover:bg-danger/20',
  ghost:     'bg-transparent text-ink-2 hover:text-ink hover:bg-card-2',
  outline:   'bg-transparent text-brand border border-brand/40 hover:bg-brand-soft',
};
const BTN_SIZES: Record<BtnSize, string> = {
  sm: 'min-h-10 px-4 text-sm gap-1.5 rounded-xl',
  md: 'min-h-12 px-5 text-sm gap-2   rounded-2xl',
  lg: 'min-h-14 px-6 text-base gap-2.5 rounded-2xl',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  size?: BtnSize;
  loading?: boolean;
  full?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
}

export function Button({
  variant = 'primary', size = 'md', loading, full, icon, iconRight,
  className = '', children, disabled, ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center font-semibold
        transition-all duration-200 ease-out
        active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100
        ${BTN_SIZES[size]} ${BTN_VARIANTS[variant]} ${full ? 'w-full' : ''} ${className}
      `.replace(/\s+/g, ' ').trim()}
    >
      {loading
        ? <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden />
        : icon && <span className="shrink-0">{icon}</span>
      }
      {children && <span>{children}</span>}
      {!loading && iconRight && <span className="shrink-0">{iconRight}</span>}
    </button>
  );
}

// ── Card ──────────────────────────────────────────────────────
interface CardProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  glow?: boolean;
  variant?: 'default' | 'raised' | 'brand' | 'money' | 'glass';
}
const CARD_VARIANTS = {
  default: 'bg-card border border-line',
  raised:  'bg-card-2 border border-line',
  brand:   'bg-brand-soft border border-brand/30',
  money:   'bg-money-soft border border-money/30',
  glass:   'glass border border-line-soft',
};
export function Card({ children, className = '', style, onClick, glow, variant = 'default' }: CardProps) {
  const base = `rounded-2xl ${CARD_VARIANTS[variant]} ${glow ? 'pulse-brand' : ''} ${className}`;
  return onClick ? (
    <button
      onClick={onClick}
      style={style}
      className={`${base} w-full text-left transition-all duration-200 active:scale-[0.99] hover:border-ink-4`}
    >
      {children}
    </button>
  ) : (
    <div className={base} style={style}>{children}</div>
  );
}

// ── Badge ─────────────────────────────────────────────────────
type BadgeTone = 'brand' | 'money' | 'warn' | 'danger' | 'info' | 'neutral';
const BADGE_TONES: Record<BadgeTone, string> = {
  brand:   'bg-brand-soft text-brand border border-brand/20',
  money:   'bg-money-soft text-money border border-money/20',
  warn:    'bg-warn-soft  text-warn  border border-warn/20',
  danger:  'bg-danger-soft text-danger border border-danger/20',
  info:    'bg-info-soft  text-info  border border-info/20',
  neutral: 'bg-card-2 text-ink-2 border border-line',
};
export function Badge({
  children, tone = 'neutral', dot, className = ''
}: { children: ReactNode; tone?: BadgeTone; dot?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${BADGE_TONES[tone]} ${className}`}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}

// ── StatusBadge ───────────────────────────────────────────────
const STATUS_MAP: Record<string, { label: string; tone: BadgeTone }> = {
  confirmed:   { label: 'Open',        tone: 'info'    },
  assigned:    { label: 'Assigned',    tone: 'brand'   },
  accepted:    { label: 'Accepted',    tone: 'brand'   },
  on_the_way:  { label: 'On the Way',  tone: 'warn'    },
  in_progress: { label: 'In Progress', tone: 'warn'    },
  completed:   { label: 'Completed',   tone: 'money'   },
  cancelled:   { label: 'Cancelled',   tone: 'neutral' },
};
export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? { label: status.replace(/_/g, ' '), tone: 'neutral' as BadgeTone };
  return <Badge tone={s.tone} dot>{s.label}</Badge>;
}

// ── Skeleton ──────────────────────────────────────────────────
export function Skeleton({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`skeleton ${className}`} style={style} aria-hidden />;
}
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <Card className="p-4 space-y-3">
      <Skeleton className="h-4 w-2/3" />
      {Array.from({ length: lines - 1 }).map((_, i) => (
        <Skeleton key={i} className={`h-3 ${i === lines - 2 ? 'w-1/2' : 'w-full'}`} />
      ))}
    </Card>
  );
}

// ── EmptyState ────────────────────────────────────────────────
export function EmptyState({
  icon, title, body, action, className = ''
}: { icon: ReactNode; title: string; body?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-dashed border-line p-8 text-center flex flex-col items-center gap-3 ${className}`}>
      <div className="w-14 h-14 rounded-2xl bg-card-2 text-ink-3 flex items-center justify-center">
        {icon}
      </div>
      <div>
        <p className="text-base font-semibold text-ink">{title}</p>
        {body && <p className="text-sm text-ink-2 mt-1 max-w-xs">{body}</p>}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

// ── ErrorBanner ───────────────────────────────────────────────
export function ErrorBanner({ message, onRetry, className = '' }: { message: string; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={`flex items-start gap-3 rounded-xl bg-danger-soft border border-danger/25 p-3.5 ${className}`}>
      <AlertCircle className="w-4 h-4 text-danger shrink-0 mt-0.5" aria-hidden />
      <span className="flex-1 text-sm text-ink">{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="inline-flex items-center gap-1 text-sm font-semibold text-danger min-h-8 shrink-0" aria-label="Retry">
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </button>
      )}
    </div>
  );
}

// ── InfoBanner ────────────────────────────────────────────────
export function InfoBanner({ message, className = '' }: { message: string; className?: string }) {
  return (
    <div className={`flex items-start gap-3 rounded-xl bg-info-soft border border-info/20 p-3.5 ${className}`}>
      <Info className="w-4 h-4 text-info shrink-0 mt-0.5" aria-hidden />
      <span className="text-sm text-ink">{message}</span>
    </div>
  );
}

// ── Input ─────────────────────────────────────────────────────
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: ReactNode;
  iconRight?: ReactNode;
  hint?: string;
}
export function Input({ label, error, icon, iconRight, hint, className = '', ...rest }: InputProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-sm font-medium text-ink-2">
          {label}
          {rest.required && <span className="text-brand ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none">
            {icon}
          </span>
        )}
        <input
          {...rest}
          className={`
            w-full bg-card-2 border rounded-xl px-4 py-3 text-sm text-ink placeholder:text-ink-4
            transition-all duration-200
            focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? 'border-danger/60 focus:border-danger focus:ring-danger/15' : 'border-line hover:border-ink-4'}
            ${icon ? 'pl-10' : ''}
            ${iconRight ? 'pr-10' : ''}
            ${className}
          `.replace(/\s+/g, ' ').trim()}
        />
        {iconRight && (
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-3">
            {iconRight}
          </span>
        )}
      </div>
      {error && <p className="text-xs text-danger flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>}
      {hint && !error && <p className="text-xs text-ink-3">{hint}</p>}
    </div>
  );
}

// ── Textarea ──────────────────────────────────────────────────
interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}
export function Textarea({ label, error, hint, className = '', ...rest }: TextareaProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-sm font-medium text-ink-2">{label}</label>
      )}
      <textarea
        {...rest}
        className={`
          w-full bg-card-2 border rounded-xl px-4 py-3 text-sm text-ink placeholder:text-ink-4
          transition-all duration-200 resize-none
          focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15
          ${error ? 'border-danger/60' : 'border-line hover:border-ink-4'}
          ${className}
        `.replace(/\s+/g, ' ').trim()}
      />
      {error && <p className="text-xs text-danger">{error}</p>}
      {hint && !error && <p className="text-xs text-ink-3">{hint}</p>}
    </div>
  );
}

// ── Select ────────────────────────────────────────────────────
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}
export function Select({ label, error, className = '', children, ...rest }: SelectProps) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-sm font-medium text-ink-2">{label}</label>}
      <select
        {...rest}
        className={`
          w-full bg-card-2 border border-line rounded-xl px-4 py-3 text-sm text-ink
          focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15
          transition-all duration-200 appearance-none cursor-pointer
          ${error ? 'border-danger/60' : ''}
          ${className}
        `.replace(/\s+/g, ' ').trim()}
      >
        {children}
      </select>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

// ── Divider ───────────────────────────────────────────────────
export function Divider({ label, className = '' }: { label?: string; className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="flex-1 h-px bg-line" />
      {label && <span className="text-xs text-ink-3 font-medium">{label}</span>}
      <div className="flex-1 h-px bg-line" />
    </div>
  );
}

// ── SectionHeader ─────────────────────────────────────────────
export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {action}
    </div>
  );
}

// ── PageHeader ────────────────────────────────────────────────
export function PageHeader({
  title, subtitle, action, back
}: { title: string; subtitle?: string; action?: ReactNode; back?: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <div className="flex items-start gap-3">
        {back && (
          <button onClick={back} className="w-9 h-9 rounded-xl bg-card-2 border border-line flex items-center justify-center text-ink-2 hover:text-ink transition-colors shrink-0 mt-0.5" aria-label="Go back">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
        )}
        <div>
          <h1 className="text-xl font-bold text-ink">{title}</h1>
          {subtitle && <p className="text-sm text-ink-2 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

// ── StatCard ──────────────────────────────────────────────────
export function StatCard({
  label, value, sub, tone = 'neutral', icon, onClick
}: { label: string; value: ReactNode; sub?: string; tone?: 'brand' | 'money' | 'neutral'; icon?: ReactNode; onClick?: () => void }) {
  const colors = {
    brand:   'text-brand',
    money:   'text-money',
    neutral: 'text-ink',
  };
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      {...(onClick ? { onClick } : {})}
      className={`flex-1 bg-card border border-line rounded-2xl p-4 text-left ${onClick ? 'hover:bg-card-2 active:scale-[0.98] transition-all duration-200' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm text-ink-2">{label}</span>
        {icon && <span className="text-ink-3">{icon}</span>}
      </div>
      <p className={`text-2xl font-bold mt-1.5 leading-none ${colors[tone]}`}>{value}</p>
      {sub && <p className="text-xs text-ink-3 mt-1">{sub}</p>}
    </Wrapper>
  );
}

// ── ProgressSteps ─────────────────────────────────────────────
export function ProgressSteps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="flex items-center gap-1">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={s} className="flex-1 flex flex-col items-center gap-1">
            <div className={`h-1 w-full rounded-full transition-all duration-500 ${done || active ? 'bg-brand' : 'bg-line'}`} />
            <span className={`text-[10px] font-medium transition-colors ${active ? 'text-brand' : done ? 'text-ink-2' : 'text-ink-4'}`}>
              {s}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Tag chip ──────────────────────────────────────────────────
export function Chip({
  label, selected, onClick, icon
}: { label: string; selected?: boolean; onClick?: () => void; icon?: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium
        border transition-all duration-200 active:scale-95
        ${selected
          ? 'bg-brand-soft text-brand border-brand/40 shadow-sm shadow-brand/10'
          : 'bg-card-2 text-ink-2 border-line hover:border-ink-3 hover:text-ink'
        }
      `}
    >
      {icon && <span className="w-4 h-4">{icon}</span>}
      {label}
      {selected && (
        <span className="w-4 h-4 rounded-full bg-brand text-white flex items-center justify-center shrink-0">
          <Check className="w-2.5 h-2.5 stroke-[3]" />
        </span>
      )}
    </button>
  );
}

// ── MoneyDisplay ──────────────────────────────────────────────
export function MoneyDisplay({
  amount, size = 'lg', tone = 'default', className = ''
}: { amount: number | null | undefined; size?: 'sm' | 'md' | 'lg' | 'xl'; tone?: 'default' | 'money' | 'brand'; className?: string }) {
  const v = Number(amount ?? 0);
  const fmt = v.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const sizeClass = { sm: 'text-lg', md: 'text-2xl', lg: 'text-3xl', xl: 'text-4xl' }[size];
  const colorClass = { default: 'text-ink', money: 'text-money', brand: 'text-brand' }[tone];
  return (
    <span className={`font-bold font-mono leading-none ${sizeClass} ${colorClass} ${className}`}>
      <span className="text-[0.6em] font-sans font-semibold opacity-80">₹</span>{fmt}
    </span>
  );
}

// ── Modal backdrop ────────────────────────────────────────────
export function ModalBackdrop({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" />
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-sm animate-scale-in">
        {children}
      </div>
    </div>
  );
}
