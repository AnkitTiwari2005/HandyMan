import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarCheck, Clock, MapPin, CheckCircle2, ChevronRight, Loader2, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import type { Booking } from '../types';

export default function Schedule() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'active' | 'completed'>('active');

  useEffect(() => {
    if (!user) return;
    fetchSchedule();
  }, [user]);

  const fetchSchedule = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          services ( name, category, image_url ),
          booking_items ( id, quantity, unit_price, total_price, services ( name ) )
        `)
        .eq('technician_id', user?.id)
        .order('scheduled_date', { ascending: false });

      if (!error && data) {
        setBookings(data as unknown as Booking[]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const activeStatuses = ['assigned', 'accepted', 'on_the_way', 'in_progress'];
  const filteredBookings = bookings.filter((b) => 
    tab === 'active' 
      ? activeStatuses.includes(b.status)
      : b.status === 'completed'
  );

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto pb-safe">
      <div className="pt-safe flex items-center justify-between">
        <div>
          <h1 className="text-xl font-syne font-bold text-white">My Bookings</h1>
          <p className="text-xs text-slate-400">Assigned customer appointments</p>
        </div>
        <span className="text-xs font-mono text-orange-400 bg-orange-500/10 px-2.5 py-1 rounded-lg border border-orange-500/20">
          {bookings.length} Total
        </span>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-900 p-1 rounded-2xl border border-slate-800">
        <button
          onClick={() => setTab('active')}
          className={`flex-1 py-2.5 text-xs font-syne font-bold rounded-xl transition-all ${
            tab === 'active'
              ? 'bg-orange-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Active Orders ({bookings.filter(b => activeStatuses.includes(b.status)).length})
        </button>
        <button
          onClick={() => setTab('completed')}
          className={`flex-1 py-2.5 text-xs font-syne font-bold rounded-xl transition-all ${
            tab === 'completed'
              ? 'bg-orange-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Completed ({bookings.filter(b => b.status === 'completed').length})
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto mb-2" />
          <p className="text-xs text-slate-400">Loading schedule...</p>
        </div>
      ) : filteredBookings.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-slate-900/50 border border-slate-800">
          <CalendarCheck className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="font-syne font-bold text-sm text-slate-300">No {tab} orders found</p>
          <p className="text-xs text-slate-500 mt-1">
            {tab === 'active' ? 'New accepted jobs will appear here.' : 'Completed bookings will be archived here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredBookings.map((b) => {
            const payout = b.technician_earnings || Math.round(b.subtotal * 0.8);
            const address = b.address_snapshot;

            return (
              <div
                key={b.id}
                onClick={() => navigate(`/job/${b.id}`)}
                className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer active:scale-98"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span className="font-mono text-[10px] text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20">
                      {b.booking_ref}
                    </span>
                    <h3 className="font-syne font-bold text-sm text-white mt-1">
                      {b.services?.name || 'Service Appointment'}
                    </h3>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-mono font-bold text-emerald-400">₹{payout}</p>
                    <span className="text-[10px] font-syne uppercase text-slate-400">
                      {b.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs text-slate-400">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-500" />
                      {b.scheduled_date}
                    </span>
                    <span className="flex items-center gap-1 text-slate-300">
                      <Clock className="w-3 h-3" />
                      {b.scheduled_time}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-orange-400 font-syne font-semibold text-[11px]">
                    <span>View</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
