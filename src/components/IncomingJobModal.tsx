import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Clock, CalendarDays, Timer, X, Zap, ArrowRight, Coins, AlertCircle } from 'lucide-react';
import { useRadarStore, OFFER_TIMEOUT_SECONDS } from '../stores/radarStore';
import { formatDay, formatMoney, payoutFor } from '../lib/format';
import { Badge, Button } from './ui';

export default function IncomingJobModal() {
  const navigate     = useNavigate();
  const offer        = useRadarStore((s) => s.incomingOffer);
  const deadline     = useRadarStore((s) => s.offerDeadline);
  const queueLength  = useRadarStore((s) => s.offerQueue.length);
  const isClaiming   = useRadarStore((s) => s.isClaiming);
  const claimError   = useRadarStore((s) => s.claimError);
  const claimJob     = useRadarStore((s) => s.claimJob);
  const declineOffer = useRadarStore((s) => s.declineOffer);

  const [now, setNow] = useState(() => Date.now());

  // Deadline-based countdown (background throttle safe)
  useEffect(() => {
    if (!deadline) return;
    setNow(Date.now());
    const tick = window.setInterval(() => setNow(Date.now()), 250);
    const onVisible = () => setNow(Date.now());
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(tick);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [deadline]);

  const remaining = deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : 0;
  const progress  = deadline ? (remaining / OFFER_TIMEOUT_SECONDS) * 100 : 0;
  const isUrgent  = remaining <= 10;
  const hasFailed = Boolean(claimError);

  // Auto-dismiss when timer hits 0
  useEffect(() => {
    if (offer && deadline && remaining === 0 && !isClaiming) {
      declineOffer(offer.id);
    }
  }, [offer, deadline, remaining, isClaiming, declineOffer]);

  if (!offer) return null;

  const payout  = payoutFor(offer);
  const address = offer.address_snapshot;
  const extraItems = (offer.booking_items?.length ?? 0) - 1;

  const handleAccept = async () => {
    const res = await claimJob(offer.id);
    if (res.success) navigate(`/job/${offer.id}`);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center animate-fade-in"
      role="presentation"
      style={{ background: 'rgba(6,12,25,0.85)', backdropFilter: 'blur(8px)' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="offer-title"
        className="w-full max-w-lg flex flex-col animate-slide-up"
        style={{ maxHeight: '92dvh' }}
      >
        {/* Countdown bar */}
        <div className="h-1 bg-line-soft rounded-t-3xl overflow-hidden">
          <div
            className={`h-full rounded-full transition-none ${isUrgent ? 'bg-danger' : 'bg-brand'}`}
            style={{ width: `${progress}%`, transition: 'width 0.25s linear' }}
          />
        </div>

        <div className="bg-card border border-line rounded-t-3xl overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-line">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-brand-soft border border-brand/20 flex items-center justify-center">
                <Zap className="w-4.5 h-4.5 text-brand" aria-hidden />
              </div>
              <div>
                <p className="text-sm font-bold text-ink">
                  New job request
                  {queueLength > 1 ? (
                    <span className="ml-2 text-xs font-medium text-ink-3">+{queueLength - 1} more</span>
                  ) : null}
                </p>
                <p className="text-xs text-ink-3">Respond before the timer expires</p>
              </div>
            </div>
            {/* Timer */}
            <span
              role="timer"
              aria-label={`${remaining} seconds remaining`}
              className={`
                inline-flex items-center gap-1.5 text-sm font-bold font-mono px-3 py-1.5 rounded-xl border
                ${isUrgent
                  ? 'text-danger bg-danger-soft border-danger/30'
                  : 'text-ink-2 bg-card-2 border-line'
                }
              `}
            >
              <Timer className="w-3.5 h-3.5" aria-hidden />
              {remaining}s
            </span>
          </div>

          {/* Scrollable body */}
          <div className="px-5 py-4 overflow-y-auto space-y-4 flex-1">
            {/* Payout hero — the ONE number that matters */}
            <div className="rounded-2xl bg-money-soft border border-money/25 p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-ink-3 mb-1">You will earn</p>
                <p className="text-4xl font-bold font-mono text-money leading-none">{formatMoney(payout)}</p>
                <p className="text-xs text-ink-3 mt-1.5">Order {formatMoney(offer.subtotal)} · paid online</p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-money/10 border border-money/20 flex items-center justify-center shrink-0">
                <Coins className="w-7 h-7 text-money" aria-hidden />
              </div>
            </div>

            {/* Service info */}
            <div>
              <Badge tone="brand">{offer.services?.category ?? 'Service'}</Badge>
              <h2 id="offer-title" className="text-xl font-bold text-ink mt-2 leading-snug">
                {offer.services?.name ?? 'Home service'}
              </h2>
              {extraItems > 0 && (
                <p className="text-sm text-ink-2 mt-0.5">
                  + {extraItems} more service{extraItems > 1 ? 's' : ''} in this booking
                </p>
              )}
            </div>

            {/* Details */}
            <div className="bg-card-2 rounded-xl border border-line p-3.5 space-y-3">
              <div className="flex items-start gap-3">
                <CalendarDays className="w-4.5 h-4.5 text-ink-3 mt-0.5 shrink-0" aria-hidden />
                <div>
                  <p className="text-sm font-semibold text-ink">{formatDay(offer.scheduled_date)}</p>
                  <p className="text-xs text-ink-3 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3.5 h-3.5" /> {offer.scheduled_time}
                  </p>
                </div>
              </div>
              <div className="h-px bg-line" />
              <div className="flex items-start gap-3">
                <MapPin className="w-4.5 h-4.5 text-ink-3 mt-0.5 shrink-0" aria-hidden />
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {[address?.city, address?.pincode].filter(Boolean).join(' · ') || 'Nearby area'}
                  </p>
                  <p className="text-xs text-ink-3 mt-0.5">
                    {address?.landmark || 'Exact address shared after accepting'}
                  </p>
                </div>
              </div>
            </div>

            {/* Customer note */}
            {offer.special_instructions && (
              <div className="rounded-xl bg-warn-soft border border-warn/25 p-3.5">
                <p className="text-xs font-semibold text-warn mb-1">Customer note</p>
                <p className="text-sm text-ink">{offer.special_instructions}</p>
              </div>
            )}

            {/* Claim error */}
            {hasFailed && (
              <div role="alert" className="flex items-start gap-3 rounded-xl bg-danger-soft border border-danger/25 p-3.5">
                <AlertCircle className="w-4 h-4 text-danger shrink-0 mt-0.5" aria-hidden />
                <p className="text-sm text-ink">{claimError}</p>
              </div>
            )}
          </div>

          {/* CTA footer */}
          <div className="px-5 pb-safe border-t border-line bg-card flex gap-3 pt-4">
            <Button
              variant="secondary"
              size="lg"
              icon={<X className="w-4.5 h-4.5" />}
              onClick={() => declineOffer(offer.id)}
              disabled={isClaiming}
              className="flex-1"
            >
              {hasFailed ? 'Close' : 'Skip'}
            </Button>
            {!hasFailed && (
              <Button
                size="lg"
                loading={isClaiming}
                iconRight={<ArrowRight className="w-4.5 h-4.5" />}
                onClick={handleAccept}
                className="flex-[2]"
              >
                Accept · {formatMoney(payout)}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
