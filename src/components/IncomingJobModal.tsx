import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Clock, Calendar, CheckCircle2, XCircle, IndianRupee, Sparkles, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useRadarStore } from '../stores/radarStore';
import { useAuthStore } from '../stores/authStore';

const OFFER_TIMEOUT_SECONDS = 45;

export default function IncomingJobModal() {
  const navigate = useNavigate();
  const { incomingOffer, claimJob, declineOffer, isClaiming, claimError } = useRadarStore();
  const { user } = useAuthStore();
  const [timeLeft, setTimeLeft] = useState(OFFER_TIMEOUT_SECONDS);

  useEffect(() => {
    if (!incomingOffer) {
      setTimeLeft(OFFER_TIMEOUT_SECONDS);
      return;
    }

    setTimeLeft(OFFER_TIMEOUT_SECONDS);
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          declineOffer(incomingOffer.id);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [incomingOffer, declineOffer]);

  if (!incomingOffer) return null;

  const estimatedEarnings = Math.round(incomingOffer.subtotal * 0.8);
  const primaryService = incomingOffer.services?.name || 'Home Maintenance';
  const category = incomingOffer.services?.category || 'Service';
  const address = incomingOffer.address_snapshot;
  const progressPercent = (timeLeft / OFFER_TIMEOUT_SECONDS) * 100;

  const handleAccept = async () => {
    if (!user) return;
    const res = await claimJob(incomingOffer.id, user.id);
    if (res.success) {
      navigate(`/job/${incomingOffer.id}`);
    }
  };

  const handleDecline = () => {
    declineOffer(incomingOffer.id);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-md">
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full max-w-lg bg-slate-900 border border-orange-500/40 rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl shadow-orange-500/10 flex flex-col max-h-[90vh]"
        >
          {/* Header Progress Bar */}
          <div className="w-full bg-slate-800 h-1.5 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-amber-500 to-orange-500"
              style={{ width: `${progressPercent}%` }}
              transition={{ ease: 'linear', duration: 1 }}
            />
          </div>

          {/* Modal Header */}
          <div className="p-4 bg-gradient-to-b from-orange-500/10 to-transparent border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-400 animate-ping" />
              <span className="font-syne font-bold text-sm tracking-wide text-orange-400 uppercase">
                Incoming Job Request
              </span>
            </div>
            {/* Timer Badge */}
            <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-800/90 rounded-full border border-slate-700">
              <Clock className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-xs font-mono font-bold text-slate-200">
                {timeLeft}s
              </span>
            </div>
          </div>

          {/* Body Content */}
          <div className="p-5 overflow-y-auto space-y-4">
            {/* Earnings Hero Banner */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/70 to-slate-900 border border-emerald-500/30 flex items-center justify-between shadow-inner">
              <div>
                <p className="text-xs font-syne text-emerald-400 font-semibold uppercase tracking-wider">
                  Partner Payout (80%)
                </p>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-3xl font-mono font-bold text-white tracking-tight">
                    ₹{estimatedEarnings}
                  </span>
                  <span className="text-xs text-slate-400 line-through">
                    ₹{incomingOffer.subtotal}
                  </span>
                </div>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-syne font-bold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Prepaid Order</span>
              </div>
            </div>

            {/* Service Title & Category */}
            <div>
              <div className="inline-block px-2.5 py-0.5 rounded-md text-[11px] font-syne font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20 mb-1.5">
                {category}
              </div>
              <h3 className="text-xl font-syne font-bold text-white leading-snug">
                {primaryService}
              </h3>
              {incomingOffer.booking_items && incomingOffer.booking_items.length > 1 && (
                <p className="text-xs text-slate-400 mt-1">
                  +{incomingOffer.booking_items.length - 1} additional service items included
                </p>
              )}
            </div>

            {/* Schedule & Location Details */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-750 flex items-start gap-2.5">
                <Calendar className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] text-slate-400 font-sans">Date & Slot</p>
                  <p className="text-xs font-mono font-semibold text-slate-200">
                    {incomingOffer.scheduled_date}
                  </p>
                  <p className="text-[11px] text-orange-300 font-medium">
                    {incomingOffer.scheduled_time}
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-750 flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="overflow-hidden">
                  <p className="text-[11px] text-slate-400 font-sans">Location</p>
                  <p className="text-xs font-semibold text-slate-200 truncate">
                    {address?.city || 'Locality'} {address?.pincode ? `(${address.pincode})` : ''}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">
                    {address?.landmark || address?.street || 'Full address after accept'}
                  </p>
                </div>
              </div>
            </div>

            {/* Special Instructions if any */}
            {incomingOffer.special_instructions && (
              <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/20 text-xs text-amber-200">
                <span className="font-bold text-amber-300">Note: </span>
                {incomingOffer.special_instructions}
              </div>
            )}

            {/* Error Message if Claim Failed */}
            {claimError && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/30 text-xs text-rose-300">
                {claimError}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="p-4 bg-slate-900 border-t border-slate-800 flex gap-3 pb-safe">
            <button
              onClick={handleDecline}
              disabled={isClaiming}
              className="flex-1 py-3.5 px-4 rounded-2xl bg-slate-800 hover:bg-slate-750 text-slate-300 font-syne font-bold text-sm border border-slate-700 active:scale-98 transition-all flex items-center justify-center gap-2"
            >
              <XCircle className="w-4 h-4 text-slate-400" />
              <span>Decline</span>
            </button>

            <button
              onClick={handleAccept}
              disabled={isClaiming}
              className="flex-[2] py-3.5 px-4 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-slate-950 font-syne font-bold text-sm shadow-lg shadow-orange-500/25 active:scale-98 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isClaiming ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Claiming Job...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-slate-950" />
                  <span>Accept Job (₹{estimatedEarnings})</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
