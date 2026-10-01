import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays, Clock, MapPin, ChevronRight,
  CheckCircle2, Briefcase,
} from 'lucide-react';
import {
  PageHeader, Card, Badge, StatusBadge,
  SkeletonCard, EmptyState, ErrorBanner,
} from '../components/ui';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';
import { formatDay, formatMoney, payoutFor } from '../lib/format';
import type { Booking, BookingStatus } from '../types';

const ACTIVE_STATUSES: BookingStatus[] = [
  'confirmed', 'assigned', 'accepted', 'on_the_way', 'in_progress',
];
const COMPLETED_STATUSES: BookingStatus[] = ['completed', 'cancelled'];

export default function Schedule() {
  const navigate  = useNavigate();
  const { user }  = useAuthStore();

  const [bookings, setBookings]   = useState<Booking[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [tab, setTab]             = useState<'upcoming' | 'completed'>('upcoming');

  const fetchBookings = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('bookings')
      .select('*, services(name, category, image_url)')
      .eq('technician_id', user.id)
      .order('scheduled_date', { ascending: true });

    if (err) {
      setError('Could not load your bookings. Tap to retry.');
    } else {
      setBookings((data ?? []) as Booking[]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  const upcoming = bookings
    .filter(b => ACTIVE_STATUSES.includes(b.status))
    .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));

  const completed = bookings
    .filter(b => COMPLETED_STATUSES.includes(b.status))
    .sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date));

  const list = tab === 'upcoming' ? upcoming : completed;

  return (
    <div className="p-4 space-y-4 pb-nav">
      <PageHeader
        title="My Jobs"
        subtitle="Your accepted and completed bookings"
      />

      {/* ── Tab bar ──────────────────────────────────────────────── */}
      <div className="flex bg-card-2 p-1 rounded-2xl border border-line gap-1 animate-fade-up">
        {(['upcoming', 'completed'] as const).map(t => {
          const count = t === 'upcoming' ? upcoming.length : completed.length;
          const active = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-sm rounded-xl transition-all duration-200 capitalize font-medium
                ${active
                  ? 'bg-brand text-white font-semibold shadow-sm shadow-brand/20'
                  : 'text-ink-3 hover:text-ink'
                }`}
            >
              {t === 'upcoming' ? 'Upcoming' : 'Completed'}
              {!loading && count > 0 && (
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full font-semibold
                  ${active ? 'bg-white/20 text-white' : 'bg-card-3 text-ink-2'}`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Error ─────────────────────────────────────────────────── */}
      {error && <ErrorBanner message={error} onRetry={fetchBookings} />}

      {/* ── List ─────────────────────────────────────────────────── */}
      <div className="space-y-3">
        {loading ? (
          [0, 1, 2].map(i => <SkeletonCard key={i} lines={3} />)
        ) : list.length === 0 && !error ? (
          <EmptyState
            icon={<Briefcase className="w-6 h-6" />}
            title={tab === 'upcoming' ? 'No upcoming jobs' : 'No completed jobs'}
            body={
              tab === 'upcoming'
                ? 'Accepted bookings will show up here. Go online to start receiving jobs.'
                : "Jobs you've completed will appear here."
            }
          />
        ) : (
          list.map((b, idx) => {
            const payout    = payoutFor(b);
            const city      = b.address_snapshot?.city ?? '';
            const isCompleted = b.status === 'completed';

            return (
              <Card
                key={b.id}
                onClick={() => navigate('/job/' + b.id)}
                className={`p-4 animate-fade-up`}
                style={{ animationDelay: `${idx * 60}ms` } as React.CSSProperties}
              >
                {/* TOP ROW: ref + status + payout */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge tone="brand" className="font-mono">#{b.booking_ref}</Badge>
                  <StatusBadge status={b.status} />
                  {isCompleted && (
                    <CheckCircle2 className="w-4 h-4 text-money" aria-label="Completed" />
                  )}
                  <span className="ml-auto text-sm font-bold text-money font-mono">
                    {formatMoney(payout)}
                  </span>
                </div>

                {/* Service name */}
                <p className="text-base font-semibold text-ink mt-2">
                  {b.services?.name ?? 'Service'}
                </p>

                {/* BOTTOM ROW: date + time + city */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-ink-3">
                  <span className="flex items-center gap-1">
                    <CalendarDays className="w-3.5 h-3.5 shrink-0" aria-hidden />
                    {formatDay(b.scheduled_date)}
                  </span>
                  {b.scheduled_time && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden />
                      {b.scheduled_time}
                    </span>
                  )}
                  {city && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden />
                      {city}
                    </span>
                  )}
                </div>

                {/* separator + chevron */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-line">
                  <span className="text-xs text-ink-4">
                    {b.services?.category ?? ''}
                  </span>
                  <ChevronRight className="w-4 h-4 text-ink-3" aria-hidden />
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
