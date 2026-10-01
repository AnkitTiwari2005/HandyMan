import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Phone, MessageSquare, Navigation, MapPin, Calendar, 
  Clock, ShieldCheck, CheckCircle2, Camera, Upload, AlertCircle, 
  Loader2, IndianRupee, Sparkles, ExternalLink 
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { useRadarStore } from '../stores/radarStore';
import { triggerHapticImpact, triggerHapticNotification } from '../lib/haptics';
import { playSuccessChime } from '../lib/audio';
import type { Booking } from '../types';

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { setActiveJob } = useRadarStore();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);

  // Proof uploads
  const [proofBeforeFile, setProofBeforeFile] = useState<File | null>(null);
  const [proofAfterFile, setProofAfterFile] = useState<File | null>(null);
  const [technicianNotes, setTechnicianNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchBookingData(id);

    // Realtime changes on this booking
    const channel = supabase
      .channel(`job-detail-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'bookings', filter: `id=eq.${id}` },
        () => {
          fetchBookingData(id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const fetchBookingData = async (bookingId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          services ( name, category, image_url ),
          booking_items (
            id,
            quantity,
            unit_price,
            total_price,
            services ( name, image_url )
          )
        `)
        .eq('id', bookingId)
        .single();

      if (!error && data) {
        setBooking(data as unknown as Booking);
        setActiveJob(data as unknown as Booking);
      }
    } catch (err) {
      console.error('Failed to load booking:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (nextStatus: 'on_the_way' | 'in_progress') => {
    if (!booking) return;
    triggerHapticImpact();
    setActionLoading(true);
    setErrorMsg(null);

    try {
      const { error } = await supabase
        .from('bookings')
        .update({
          status: nextStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', booking.id);

      if (error) throw error;
      setBooking({ ...booking, status: nextStatus });
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to update status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!booking || !user) return;
    triggerHapticImpact();
    setOtpError(null);
    setActionLoading(true);

    try {
      const { data, error } = await supabase.rpc('verify_start_otp', {
        p_booking_id: booking.id,
        p_technician_id: user.id,
        p_otp: otpInput.trim()
      });

      if (error) throw error;

      const res = data as { success: boolean; message: string };
      if (res.success) {
        triggerHapticNotification();
        setOtpModalOpen(false);
        setBooking({ ...booking, status: 'in_progress' });
      } else {
        setOtpError(res.message);
      }
    } catch (err: any) {
      setOtpError(err.message || 'Verification failed. Try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteJob = async () => {
    if (!booking || !user) return;
    triggerHapticImpact();
    setActionLoading(true);
    setErrorMsg(null);

    try {
      let afterUrl: string | undefined = undefined;

      // Upload completion proof if attached
      if (proofAfterFile) {
        const fileExt = proofAfterFile.name.split('.').pop();
        const filePath = `${booking.id}/after_${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('job-proofs')
          .upload(filePath, proofAfterFile);

        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage
            .from('job-proofs')
            .getPublicUrl(filePath);
          afterUrl = publicUrlData.publicUrl;
        }
      }

      // Call completion RPC
      const { data, error } = await supabase.rpc('complete_booking_service', {
        p_booking_id: booking.id,
        p_technician_id: user.id,
        p_proof_after_url: afterUrl,
        p_notes: technicianNotes.trim() || undefined
      });

      if (error) throw error;

      const res = data as { success: boolean; message: string; credited_amount: number };
      if (res.success) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
        playSuccessChime();
        triggerHapticNotification();
        setBooking({ ...booking, status: 'completed' });
        setActiveJob(null);
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to complete booking');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6">
        <Loader2 className="w-10 h-10 animate-spin text-orange-500 mb-3" />
        <p className="text-xs font-syne text-slate-400">Loading Job Cockpit...</p>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="w-12 h-12 text-slate-500 mb-3" />
        <h2 className="text-lg font-syne font-bold text-white mb-2">Job Not Found</h2>
        <button
          onClick={() => navigate('/')}
          className="px-5 py-2.5 rounded-xl bg-orange-500 text-slate-950 font-syne font-bold text-xs"
        >
          Return to Radar
        </button>
      </div>
    );
  }

  const address = booking.address_snapshot;
  const customerPhone = address?.phone || '';
  const customerAddressText = address?.full_address || `${address?.flat_number || ''}, ${address?.street || ''}, ${address?.city || ''}`;
  const payout = booking.technician_earnings || Math.round(booking.subtotal * 0.8);

  // Turn-by-turn Google Maps URL
  const mapsUrl = address?.latitude && address?.longitude
    ? `https://www.google.com/maps/dir/?api=1&destination=${address.latitude},${address.longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(customerAddressText)}`;

  const isCompleted = booking.status === 'completed';

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto pb-safe">
      {/* 1. Header Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/')}
          className="p-2 -ml-2 rounded-xl text-slate-400 hover:text-white active:scale-95"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="font-mono text-xs font-bold text-orange-400 bg-orange-500/10 px-2.5 py-1 rounded-lg border border-orange-500/20">
          {booking.booking_ref}
        </span>
      </div>

      {/* 2. Status Stepper */}
      <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-syne font-bold text-slate-400 uppercase tracking-wider">
            Job Lifecycle
          </span>
          <span className={`font-syne font-bold px-2.5 py-0.5 rounded-full text-[11px] uppercase ${
            isCompleted 
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-orange-500/20 text-orange-400 border border-orange-500/30 animate-pulse'
          }`}>
            {booking.status.replace('_', ' ')}
          </span>
        </div>

        {/* Visual Progress Steps */}
        <div className="grid grid-cols-4 gap-1.5 pt-1">
          {[
            { key: 'accepted', label: 'Accepted' },
            { key: 'on_the_way', label: 'On Way' },
            { key: 'in_progress', label: 'In Work' },
            { key: 'completed', label: 'Done' }
          ].map((step, index) => {
            const stepOrder = ['accepted', 'on_the_way', 'in_progress', 'completed'];
            const currentIndex = stepOrder.indexOf(booking.status);
            const isDone = currentIndex >= index;
            const isCurrent = currentIndex === index;

            return (
              <div key={step.key} className="flex flex-col items-center">
                <div className={`w-full h-1.5 rounded-full mb-1.5 transition-colors ${
                  isDone ? 'bg-orange-500 shadow-sm shadow-orange-500/50' : 'bg-slate-800'
                }`} />
                <span className={`text-[10px] font-syne ${isCurrent ? 'text-orange-400 font-bold' : isDone ? 'text-slate-300' : 'text-slate-600'}`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Customer Address & Navigation Card */}
      <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 space-y-3.5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-syne font-bold uppercase tracking-wider text-slate-400">
              Customer Destination
            </span>
            <p className="text-sm font-semibold text-white leading-snug">
              {customerAddressText}
            </p>
            {address?.landmark && (
              <p className="text-xs text-orange-300">
                Landmark: {address.landmark}
              </p>
            )}
          </div>
        </div>

        {/* Action Buttons: Navigate, Call, WhatsApp */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800">
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 active:scale-95 transition-all text-center"
          >
            <Navigation className="w-4 h-4 mb-1" />
            <span className="text-[10px] font-syne font-bold">Directions</span>
          </a>

          {customerPhone ? (
            <a
              href={`tel:${customerPhone}`}
              className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 active:scale-95 transition-all text-center"
            >
              <Phone className="w-4 h-4 mb-1" />
              <span className="text-[10px] font-syne font-bold">Call User</span>
            </a>
          ) : (
            <div className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-slate-800/40 text-slate-600 text-center opacity-50">
              <Phone className="w-4 h-4 mb-1" />
              <span className="text-[10px] font-syne">No Phone</span>
            </div>
          )}

          {customerPhone ? (
            <a
              href={`https://wa.me/${customerPhone.replace(/[^0-9]/g, '')}?text=Hello!%20I%20am%20your%20Houserve%20technician%20for%20booking%20${booking.booking_ref}.`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 border border-teal-500/20 active:scale-95 transition-all text-center"
            >
              <MessageSquare className="w-4 h-4 mb-1" />
              <span className="text-[10px] font-syne font-bold">WhatsApp</span>
            </a>
          ) : null}
        </div>
      </div>

      {/* 4. Service Breakdown & Guaranteed Payout */}
      <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-syne font-bold uppercase tracking-wider text-slate-400">
            Ordered Services
          </span>
          <span className="text-xs font-mono font-bold text-emerald-400">
            Payout: ₹{payout}
          </span>
        </div>

        <div className="space-y-2">
          {booking.booking_items && booking.booking_items.length > 0 ? (
            booking.booking_items.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-800/60 last:border-0">
                <span className="text-slate-200">
                  {item.services?.name || 'Service Task'} × {item.quantity}
                </span>
                <span className="font-mono text-slate-400">
                  ₹{item.total_price}
                </span>
              </div>
            ))
          ) : (
            <div className="flex items-center justify-between text-xs py-1.5">
              <span className="text-slate-200">{booking.services?.name}</span>
              <span className="font-mono text-slate-400">₹{booking.subtotal}</span>
            </div>
          )}
        </div>

        {booking.special_instructions && (
          <div className="p-3 rounded-2xl bg-amber-950/20 border border-amber-500/20 text-xs text-amber-200">
            <span className="font-bold text-amber-300">Instructions: </span>
            {booking.special_instructions}
          </div>
        )}
      </div>

      {/* 5. Error Alerts if any */}
      {errorMsg && (
        <div className="p-3 rounded-2xl bg-rose-950/60 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 6. Contextual Action Execution Bar */}
      {!isCompleted && (
        <div className="space-y-3 pt-2">
          {/* Stage A: Accepted -> Tap to start transit */}
          {booking.status === 'accepted' && (
            <button
              onClick={() => handleUpdateStatus('on_the_way')}
              disabled={actionLoading}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 font-syne font-bold text-sm shadow-xl shadow-orange-500/25 active:scale-98 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
              <span>Start Travel (Mark "On The Way 🚗")</span>
            </button>
          )}

          {/* Stage B: On The Way -> Tap to enter Start OTP */}
          {booking.status === 'on_the_way' && (
            <div className="space-y-2">
              <button
                onClick={() => setOtpModalOpen(true)}
                disabled={actionLoading}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-syne font-bold text-sm shadow-xl shadow-emerald-500/25 active:scale-98 transition-all flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Arrived at Doorstep (Verify Customer OTP)</span>
              </button>
              <p className="text-center text-[11px] text-slate-400">
                Ask customer for the 4-digit code shown on their Houserve app.
              </p>
            </div>
          )}

          {/* Stage C: In Progress -> Upload after photo & complete */}
          {booking.status === 'in_progress' && (
            <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-center gap-2 text-xs font-syne font-bold uppercase tracking-wider text-white">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Service in Progress</span>
              </div>

              {/* Photo Proof Upload */}
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Upload "After Service" Photo Proof (Optional)
                </label>
                <label className="flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-slate-700 bg-slate-950 hover:border-orange-500/50 cursor-pointer text-xs text-slate-400">
                  <Camera className="w-4 h-4 text-orange-400" />
                  <span>{proofAfterFile ? proofAfterFile.name : 'Take or upload photo'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => e.target.files && setProofAfterFile(e.target.files[0])}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Technician Notes */}
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Technician Notes / Work Summary
                </label>
                <textarea
                  rows={2}
                  value={technicianNotes}
                  onChange={(e) => setTechnicianNotes(e.target.value)}
                  placeholder="Completed wiring fix and tested switchboard successfully..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-orange-500/50 resize-none"
                />
              </div>

              <button
                onClick={handleCompleteJob}
                disabled={actionLoading}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-syne font-bold text-sm shadow-xl shadow-emerald-500/25 active:scale-98 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                    <span>Settling Service & Wallet...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-slate-950" />
                    <span>Complete Service (Collect ₹{payout})</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Completed Success Banner */}
      {isCompleted && (
        <div className="p-5 rounded-3xl bg-emerald-950/60 border border-emerald-500/40 text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="font-syne font-bold text-base text-white">
            Job Successfully Completed!
          </h3>
          <p className="text-xs text-slate-300">
            ₹{payout} has been credited to your Partner Wallet balance.
          </p>
          <button
            onClick={() => navigate('/wallet')}
            className="mt-3 px-5 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-syne font-bold text-xs shadow-md"
          >
            View Wallet Balance
          </button>
        </div>
      )}

      {/* 7. Start OTP Modal */}
      {otpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-400 flex items-center justify-center mx-auto mb-2 border border-orange-500/20">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="font-syne font-bold text-lg text-white">
                Customer Start OTP
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Enter the 4-digit verification code from the customer's phone to start service.
              </p>
            </div>

            {otpError && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/30 text-rose-300 text-xs">
                {otpError}
              </div>
            )}

            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <input
                type="text"
                maxLength={4}
                required
                autoFocus
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="••••"
                className="w-full bg-slate-950 border border-slate-700 rounded-2xl py-3 text-center text-3xl font-mono tracking-[0.5em] text-white focus:outline-none focus:border-orange-500"
              />

              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setOtpModalOpen(false)}
                  className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-300 font-syne font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || otpInput.length < 4}
                  className="flex-1 py-3 rounded-xl bg-orange-500 text-slate-950 font-syne font-bold text-xs shadow-md disabled:opacity-50"
                >
                  {actionLoading ? 'Verifying...' : 'Start Job'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
