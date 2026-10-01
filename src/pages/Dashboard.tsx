import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Power, Clock, MapPin, ChevronRight, Navigation, Briefcase, WifiOff, Wallet } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useRadarStore } from '../stores/radarStore';
import { supabase } from '../lib/supabase';
import { formatDay, formatMoney, payoutFor } from '../lib/format';
import { Badge, Button, Card, EmptyState, ErrorBanner, Skeleton } from '../components/ui';
import type { Booking } from '../types';

function JobCard({ job, onOpen }: { job: Booking; onOpen: () => void }) {
  const a = job.address_snapshot;
  return (
    <Card onClick={onOpen} className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Badge tone="brand">{job.services?.category ?? 'Service'}</Badge>
          <h3 className="text-base font-semibold text-ink mt-2 truncate">{job.services?.name ?? 'Home service'}</h3>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xl font-bold text-money leading-none">{formatMoney(payoutFor(job))}</p>
          <p className="text-xs text-ink-3 mt-1">you earn</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-sm text-ink-2">
        <span className="flex items-center gap-1.5 min-w-0">
          <Clock className="w-4 h-4 shrink-0 text-ink-3" aria-hidden />
          <span className="truncate">{formatDay(job.scheduled_date)} · {job.scheduled_time}</span>
        </span>
        <span className="flex items-center gap-1.5 min-w-0">
          <MapPin className="w-4 h-4 shrink-0 text-ink-3" aria-hidden />
          <span className="truncate">{a?.city || a?.pincode || 'Nearby'}</span>
        </span>
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, technicianProfile, toggleOnlineStatus } = useAuthStore();
  const { activeJob, upcomingJobs, availableJobs, feedLoading, feedError, connection, fetchAvailableJobs, presentOffer } = useRadarStore();
  const [todayEarnings, setTodayEarnings] = useState<number | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  const isOnline = technicianProfile?.is_online ?? false;
  const skills = technicianProfile?.skills ?? [];

  // Today's earnings is what a technician actually opens the app to see.
  useEffect(() => {
    if (!user) return;
    const start = new Date(); start.setHours(0, 0, 0, 0);
    void supabase
      .from('technician_payouts')
      .select('amount')
      .eq('technician_id', user.id)
      .eq('type', 'job_payout')
      .gte('created_at', start.toISOString())
      .then(({ data, error }) => {
        if (!error && data) setTodayEarnings(data.reduce((s, r) => s + Number(r.amount), 0));
      });
  }, [user, activeJob]);

  const goOnline = async () => {
    setToggleError(null);
    const res = await toggleOnlineStatus(true);
    if (!res.ok) setToggleError(res.message ?? 'Could not go online.');
  };

  return (
    <div className="p-4 space-y-5">
      {/* Today */}
      <section aria-label="Today" className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-sm text-ink-2">Earned today</p>
          {todayEarnings === null ? <Skeleton className="h-8 w-24 mt-1" /> :
            <p className="text-2xl font-bold text-money mt-0.5">{formatMoney(todayEarnings)}</p>}
        </Card>
        <Card className="p-4" onClick={() => navigate('/wallet')}>
          <p className="text-sm text-ink-2 flex items-center gap-1.5"><Wallet className="w-4 h-4" aria-hidden />Wallet</p>
          <p className="text-2xl font-bold text-ink mt-0.5">{formatMoney(technicianProfile?.wallet_balance)}</p>
        </Card>
      </section>

      {/* Current job: one clear next action */}
      {activeJob && (
        <button
          onClick={() => navigate(`/job/${activeJob.id}`)}
          className="w-full text-left rounded-2xl bg-brand text-slate-950 p-4 active:scale-[0.99] transition-transform"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold uppercase tracking-wide">
              {activeJob.status === 'in_progress' ? 'Job in progress' : 'On the way'}
            </span>
            <span className="text-sm font-semibold opacity-80">{activeJob.booking_ref}</span>
          </div>
          <p className="text-xl font-bold mt-1">{activeJob.services?.name ?? 'Current job'}</p>
          <div className="mt-3 inline-flex items-center gap-2 rounded-xl bg-slate-950 text-brand px-4 min-h-11 font-bold">
            <Navigation className="w-5 h-5" aria-hidden /> Open job
          </div>
        </button>
      )}

      {/* Upcoming accepted jobs never block new offers */}
      {upcomingJobs.length > 0 && (
        <section aria-label="Next up" className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-ink">Next up</h2>
            <button onClick={() => navigate('/schedule')} className="text-sm font-semibold text-brand min-h-11 px-1">See all</button>
          </div>
          {upcomingJobs.slice(0, 2).map((j) => (
            <Card key={j.id} onClick={() => navigate(`/job/${j.id}`)} className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-base font-semibold text-ink truncate">{j.services?.name}</p>
                <p className="text-sm text-ink-2">{formatDay(j.scheduled_date)} · {j.scheduled_time}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-ink-3 shrink-0" aria-hidden />
            </Card>
          ))}
        </section>
      )}

      {/* Open jobs */}
      {!isOnline ? (
        <EmptyState
          icon={<WifiOff className="w-6 h-6" aria-hidden />}
          title="You're offline"
          body={technicianProfile?.verification_status === 'approved'
            ? 'Go online to see and receive job requests that match your trades.'
            : 'You can go online once your profile is verified.'}
          action={technicianProfile?.verification_status === 'approved'
            ? <Button onClick={goOnline} icon={<Power className="w-5 h-5" aria-hidden />} size="lg">Go online</Button>
            : undefined}
        />
      ) : (
        <section aria-label="Open jobs" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-ink">Open jobs{availableJobs.length ? ` (${availableJobs.length})` : ''}</h2>
            <span className="text-sm text-ink-3">
              {connection === 'live' ? 'Live' : 'Reconnecting…'}
            </span>
          </div>

          {feedError && <ErrorBanner message={feedError} onRetry={() => void fetchAvailableJobs()} />}

          {feedLoading && availableJobs.length === 0 ? (
            <div className="space-y-3"><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
          ) : availableJobs.length === 0 && !feedError ? (
            <EmptyState
              icon={<Briefcase className="w-6 h-6" aria-hidden />}
              title="No open jobs right now"
              body={skills.length ? `We'll ring you the moment a ${skills.slice(0, 2).join(' or ')} job comes in. Keep the app open.` : 'Add your trades in Me to get matching jobs.'}
            />
          ) : (
            availableJobs.map((job) => (
              <JobCard key={job.id} job={job} onOpen={() => presentOffer(job)} />
            ))
          )}
        </section>
      )}
      {toggleError && <ErrorBanner message={toggleError} />}
    </div>
  );
}
