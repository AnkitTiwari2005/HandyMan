import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, Wallet, Navigation, Clock, MapPin, WifiOff, Briefcase, ChevronRight,
} from 'lucide-react';
import {
  StatCard, MoneyDisplay, SectionHeader, Badge, SkeletonCard, Skeleton,
  EmptyState, ErrorBanner, Card,
} from '../components/ui';
import { useAuthStore } from '../stores/authStore';
import { useRadarStore } from '../stores/radarStore';
import { supabase } from '../lib/supabase';
import { formatDay, payoutFor, addressLine } from '../lib/format';
import type { Booking } from '../types';

// ── JobCard ─────────────────────────────────────────────────────────────────
function JobCard({ job, onOpen }: { job: Booking; onOpen: () => void }) {
  const payout = payoutFor(job);
  const city = job.address_snapshot?.city ?? '';
  const category = job.services?.category ?? '';

  return (
    <button
      onClick={onOpen}
      className="w-full text-left rounded-2xl bg-card border border-line p-4 space-y-3
                 transition-all duration-200 active:scale-[0.98] hover:border-brand/40
                 hover:bg-card-2"
    >
      {/* Top row: category badge + payout */}
      <div className="flex items-start justify-between gap-2">
        {category && (
          <span className="inline-flex items-center rounded-full bg-brand-soft border border-brand/20
                           px-2.5 py-0.5 text-xs font-semibold text-brand capitalize">
            {category}
          </span>
        )}
        <MoneyDisplay amount={payout} size="md" tone="money" className="ml-auto shrink-0" />
      </div>

      {/* Service name */}
      <p className="font-semibold text-ink truncate">
        {job.services?.name ?? 'Service'}
      </p>

      {/* Bottom row: time + city */}
      <div className="flex items-center gap-4 text-xs text-ink-3">
        <span className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          {formatDay(job.scheduled_date)}&nbsp;·&nbsp;{job.scheduled_time?.slice(0, 5)}
        </span>
        {city && (
          <span className="flex items-center gap-1 truncate">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            {city}
          </span>
        )}
      </div>
    </button>
  );
}

// ── ActiveJobBanner ──────────────────────────────────────────────────────────
function ActiveJobBanner({ job }: { job: Booking }) {
  const navigate = useNavigate();
  const isOnWay = job.status === 'on_the_way';
  const city = job.address_snapshot?.city ?? '';

  return (
    <button
      onClick={() => navigate(`/job/${job.id}`)}
      className="w-full text-left rounded-2xl gradient-brand p-4 space-y-3
                 active:scale-[0.99] transition-transform cursor-pointer"
    >
      {/* Row 1: status pill + ref */}
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center rounded-full bg-black/25 px-2.5 py-0.5
                         text-xs font-bold text-white uppercase tracking-wide">
          {isOnWay ? 'On the way' : 'In progress'}
        </span>
        <span className="font-mono text-xs text-white/70">{job.booking_ref}</span>
      </div>

      {/* Service name */}
      <p className="text-xl font-bold text-white leading-snug">
        {job.services?.name ?? 'Active Job'}
      </p>

      {/* Time + city */}
      <div className="flex items-center gap-3 text-sm text-white/75">
        <span className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          {formatDay(job.scheduled_date)}&nbsp;·&nbsp;{job.scheduled_time?.slice(0, 5)}
        </span>
        {city && (
          <span className="flex items-center gap-1 truncate">
            <MapPin className="w-3.5 h-3.5" />
            {city}
          </span>
        )}
      </div>

      {/* Open button */}
      <div className="flex items-center justify-end">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-black/30 px-4 py-2
                         text-sm font-semibold text-white">
          <Navigation className="w-3.5 h-3.5" />
          Open Job →
        </span>
      </div>
    </button>
  );
}

// ── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();
  const { technicianProfile, user, toggleOnlineStatus } = useAuthStore();
  const {
    activeJob, upcomingJobs, availableJobs, feedLoading, feedError,
    connection, fetchAvailableJobs,
  } = useRadarStore();

  const isOnline = technicianProfile?.is_online ?? false;

  // Today's earnings ─────────────────────────────────────────────────────────
  const [todayEarnings, setTodayEarnings] = useState<number | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  const loadTodayEarnings = async () => {
    if (!user?.id) return;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from('technician_payouts')
      .select('amount')
      .eq('technician_id', user.id)
      .eq('type', 'job_payout')
      .gte('created_at', todayStart.toISOString());

    const total = (data ?? []).reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
    setTodayEarnings(total);
  };

  // Load today's earnings on mount and whenever the active job changes
  useEffect(() => {
    void loadTodayEarnings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, activeJob?.id]);

  // Go online handler ────────────────────────────────────────────────────────
  const handleToggleOnline = async () => {
    setToggleError(null);
    const result = await toggleOnlineStatus();
    if (!result.ok) setToggleError(result.message ?? 'Could not change status.');
  };

  // Counts for section header
  const feedCount = availableJobs.length;

  return (
    <div className="p-4 space-y-5 pb-nav">

      {/* ── Stats row ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 animate-fade-up">
        <StatCard
          label="Earned today"
          value={
            todayEarnings === null
              ? <Skeleton className="h-7 w-20 mt-1" />
              : <MoneyDisplay amount={todayEarnings} size="lg" tone="money" />
          }
          tone="money"
          icon={<TrendingUp className="w-4 h-4" />}
        />
        <StatCard
          label="Wallet"
          value={<MoneyDisplay amount={technicianProfile?.wallet_balance} size="lg" />}
          icon={<Wallet className="w-4 h-4" />}
          onClick={() => navigate('/wallet')}
        />
      </div>

      {/* ── Active job banner ─────────────────────────────────────────── */}
      {activeJob && (
        <div className="animate-fade-up stagger-1">
          <ActiveJobBanner job={activeJob} />
        </div>
      )}

      {/* ── Upcoming jobs ─────────────────────────────────────────────── */}
      {upcomingJobs.length > 0 && (
        <div className="space-y-3 animate-fade-up stagger-2">
          <SectionHeader
            title="Upcoming"
            action={
              <button
                onClick={() => navigate('/schedule')}
                className="text-sm font-semibold text-brand min-h-8 flex items-center gap-1"
              >
                See all <ChevronRight className="w-3.5 h-3.5" />
              </button>
            }
          />
          <div className="space-y-2.5">
            {upcomingJobs.slice(0, 2).map((j) => (
              <Card
                key={j.id}
                onClick={() => navigate(`/job/${j.id}`)}
                className="p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-ink truncate flex-1">{j.services?.name ?? 'Job'}</p>
                  <span className="text-money font-semibold text-sm shrink-0">
                    +{/* MoneyDisplay inline */}
                    <MoneyDisplay amount={payoutFor(j)} size="sm" tone="money" />
                  </span>
                </div>
                <p className="text-xs text-ink-3 mt-1.5 flex items-center gap-1.5">
                  <Clock className="w-3 h-3" />
                  {formatDay(j.scheduled_date)} · {j.scheduled_time?.slice(0, 5)}
                  {j.address_snapshot?.city && (
                    <>
                      <span className="text-ink-4">·</span>
                      <MapPin className="w-3 h-3" />
                      {j.address_snapshot.city}
                    </>
                  )}
                </p>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── Job feed ──────────────────────────────────────────────────── */}
      <div className="space-y-3 animate-fade-up stagger-3">
        {!isOnline ? (
          /* Offline state */
          <EmptyState
            icon={<WifiOff className="w-6 h-6" />}
            title="You're offline"
            body="Go online to start receiving job requests in your area."
            action={
              <button
                onClick={handleToggleOnline}
                className="gradient-brand text-white text-sm font-semibold rounded-xl
                           px-5 min-h-10 inline-flex items-center gap-2
                           active:scale-[0.97] transition-all shadow-lg shadow-brand/25"
              >
                Go Online
              </button>
            }
          />
        ) : (
          <>
            <SectionHeader
              title={`Open Jobs${feedCount ? ` (${feedCount})` : ''}`}
              action={
                connection === 'live'
                  ? <Badge tone="money" dot>Live</Badge>
                  : <Badge tone="warn" dot>Reconnecting</Badge>
              }
            />

            {toggleError && (
              <ErrorBanner message={toggleError} onRetry={() => setToggleError(null)} />
            )}

            {feedError && (
              <ErrorBanner message={feedError} onRetry={fetchAvailableJobs} />
            )}

            {feedLoading && availableJobs.length === 0 && (
              <div className="space-y-3">
                <SkeletonCard lines={3} />
                <SkeletonCard lines={3} />
                <SkeletonCard lines={3} />
              </div>
            )}

            {!feedLoading && !feedError && availableJobs.length === 0 && (
              <EmptyState
                icon={<Briefcase className="w-6 h-6" />}
                title="No open jobs right now"
                body={
                  technicianProfile?.skills?.length
                    ? `We'll notify you the moment a ${technicianProfile.skills.slice(0, 2).join(' or ')} job is posted nearby.`
                    : "We'll notify you as soon as a matching job is posted nearby."
                }
              />
            )}

            {availableJobs.length > 0 && (
              <div className="space-y-3">
                {availableJobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onOpen={() => navigate(`/job/${job.id}`)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
