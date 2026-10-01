import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Clock, CalendarDays, Timer, AlertCircle } from 'lucide-react';
import { useRadarStore, OFFER_TIMEOUT_SECONDS } from '../stores/radarStore';
import { formatDay, formatMoney, payoutFor } from '../lib/format';
import { Button, Badge } from './ui';

export default function IncomingJobModal() {
  const navigate = useNavigate();
  const offer = useRadarStore((s) => s.incomingOffer);
  const deadline = useRadarStore((s) => s.offerDeadline);
  const queueLength = useRadarStore((s) => s.offerQueue.length);
  const isClaiming = useRadarStore((s) => s.isClaiming);
  const claimError = useRadarStore((s) => s.claimError);
  const claimJob = useRadarStore((s) => s.claimJob);
  const declineOffer = useRadarStore((s) => s.declineOffer);
  const [now, setNow] = useState(() => Date.now());

  // Remaining time is derived from a deadline, not decremented, so a throttled
  // background tab can't make the countdown drift.
  useEffect(() => {
    if (!deadline) return;
    setNow(Date.now());
    const tick = window.setInterval(() => setNow(Date.now()), 250);
    const onVisible = () => setNow(Date.now());
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearInterval(tick); document.removeEventListener('visibilitychange', onVisible); };
  }, [deadline]);

  const remaining = deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : 0;

  useEffect(() => {
    if (offer && deadline && remaining === 0 && !isClaiming) declineOffer(offer.id);
  }, [offer, deadline, remaining, isClaiming, declineOffer]);

  if (!offer) return null;

  const payout = payoutFor(offer);
  const address = offer.address_snapshot;
  const extraItems = (offer.booking_items?.length ?? 0) - 1;
  const urgent = remaining <= 10;
  const failed = Boolean(claimError);

  const handleAccept = async () => {
    const res = await claimJob(offer.id);
    if (res.success) navigate(`/job/${offer.id}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="offer-title"
        className="w-full max-w-lg bg-card border-t border-line rounded-t-3xl overflow-hidden flex flex-col max-h-[92dvh]"
      >
        {/* countdown */}
        <div className="h-1.5 bg-card-2" aria-hidden>
          <div
            className={`h-full ${urgent ? 'bg-danger' : 'bg-brand'} transition-[width] duration-300 ease-linear`}
            style={{ width: `${(remaining / OFFER_TIMEOUT_SECONDS) * 100}%` }}
          />
        </div>

        <div className="px-5 pt-4 pb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-brand">
            New job request{queueLength > 1 ? ` · ${queueLength - 1} more waiting` : ''}
          </p>
          <span
            role="timer"
            aria-label={`${remaining} seconds left to respond`}
            className={`inline-flex items-center gap-1.5 text-sm font-bold ${urgent ? 'text-danger' : 'text-ink-2'}`}
          >
            <Timer className="w-4 h-4" aria-hidden /> {remaining}s
          </span>
        </div>

        <div className="px-5 pb-4 overflow-y-auto space-y-4">
          {/* what you earn: the one number that matters */}
          <div className="rounded-2xl bg-money/10 border border-money/30 p-4">
            <p className="text-sm text-ink-2">You will earn</p>
            <p className="text-4xl font-bold text-money leading-tight">{formatMoney(payout)}</p>
            <p className="text-sm text-ink-3 mt-1">
              Order value {formatMoney(offer.subtotal)} · paid online by customer
            </p>
          </div>

          <div>
            <Badge tone="brand">{offer.services?.category ?? 'Service'}</Badge>
            <h2 id="offer-title" className="text-xl font-bold text-ink mt-2 leading-snug">
              {offer.services?.name ?? 'Home service'}
            </h2>
            {extraItems > 0 && <p className="text-sm text-ink-2 mt-0.5">+ {extraItems} more service{extraItems > 1 ? 's' : ''} in this order</p>}
          </div>

          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <CalendarDays className="w-5 h-5 text-ink-3 mt-0.5 shrink-0" aria-hidden />
              <div>
                <p className="text-base font-semibold text-ink">{formatDay(offer.scheduled_date)}</p>
                <p className="text-sm text-ink-2 flex items-center gap-1"><Clock className="w-3.5 h-3.5" aria-hidden />{offer.scheduled_time}</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-ink-3 mt-0.5 shrink-0" aria-hidden />
              <div>
                <p className="text-base font-semibold text-ink">
                  {[address?.city, address?.pincode].filter(Boolean).join(' · ') || 'Locality shared after accepting'}
                </p>
                <p className="text-sm text-ink-2">{address?.landmark || 'Exact address is shown after you accept'}</p>
              </div>
            </li>
          </ul>

          {offer.special_instructions && (
            <div className="rounded-2xl bg-warn/10 border border-warn/30 p-3.5 text-sm text-ink">
              <span className="font-semibold text-warn">Customer note: </span>{offer.special_instructions}
            </div>
          )}

          {failed && (
            <div role="alert" className="flex items-start gap-3 rounded-2xl bg-danger/10 border border-danger/30 p-3.5 text-sm text-ink">
              <AlertCircle className="w-5 h-5 text-danger shrink-0 mt-0.5" aria-hidden />
              <span>{claimError}</span>
            </div>
          )}
        </div>

        <div className="px-5 pt-3 pb-safe border-t border-line flex gap-3 bg-card">
          <Button variant="secondary" onClick={() => declineOffer(offer.id)} disabled={isClaiming} className="flex-1" size="lg">
            {failed ? 'Close' : 'Skip'}
          </Button>
          {!failed && (
            <Button onClick={handleAccept} loading={isClaiming} className="flex-[2]" size="lg">
              Accept · {formatMoney(payout)}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
