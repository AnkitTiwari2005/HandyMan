import { useEffect, useState, useCallback } from 'react';
import { Star, LogOut, CheckCircle2, CreditCard, MapPin } from 'lucide-react';
import {
  Button, Card, Badge, Chip, SectionHeader, ErrorBanner,
} from '../components/ui';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';

// ── All 7 supported trades ─────────────────────────────────────
const ALL_TRADES = [
  'Electrician',
  'Plumber',
  'Carpenter',
  'Painter',
  'AC Technician',
  'Appliance Repair',
  'Cleaning',
] as const;

export default function Profile() {
  const { profile, technicianProfile, fetchProfiles, user, signOut } = useAuthStore();

  // local editable state
  const [skills, setSkills]   = useState<string[]>(technicianProfile?.skills ?? []);
  const [radius, setRadius]   = useState<number>(technicianProfile?.service_radius_km ?? 10);
  const [saving, setSaving]   = useState(false);
  const [saveError, setSaveError]   = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // sync when store loads
  useEffect(() => {
    if (technicianProfile) {
      setSkills(technicianProfile.skills ?? []);
      setRadius(technicianProfile.service_radius_km ?? 10);
    }
  }, [technicianProfile]);

  const toggleTrade = useCallback((trade: string) => {
    setSkills(prev => {
      if (prev.includes(trade)) {
        if (prev.length <= 1) return prev; // keep at least 1
        return prev.filter(s => s !== trade);
      }
      return [...prev, trade];
    });
    setSaveSuccess(false);
  }, []);

  // ── save changes ──────────────────────────────────────────────
  async function handleSave() {
    if (!user) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    const { error } = await supabase
      .from('technician_profiles')
      .update({ skills, service_radius_km: radius, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    if (error) {
      setSaveError(error.message || 'Could not save changes. Please try again.');
    } else {
      setSaveSuccess(true);
      await fetchProfiles(user.id);
    }
    setSaving(false);
  }

  // ── derived display values ────────────────────────────────────
  const name     = profile?.full_name ?? 'Partner';
  const email    = profile?.email ?? '';
  const phone    = profile?.phone ?? '';
  const initial  = name.charAt(0).toUpperCase();
  const rating   = technicianProfile?.rating ?? 0;
  const jobsDone = technicianProfile?.total_completed_jobs ?? 0;
  const expYears = technicianProfile?.experience_years ?? 0;
  const verified = technicianProfile?.verification_status === 'approved';
  const upiId    = technicianProfile?.bank_upi_id;
  const bankName = technicianProfile?.bank_account_name;

  return (
    <div className="pb-nav space-y-0">

      {/* ── Profile Hero ─────────────────────────────────────────── */}
      <div className="gradient-brand relative overflow-hidden">
        {/* decorative depth circles */}
        <div className="absolute -top-12 -right-12 w-56 h-56 bg-white/5 rounded-full pointer-events-none" />
        <div className="absolute top-20 -right-4 w-32 h-32 bg-white/5 rounded-full pointer-events-none" />
        <div className="absolute -bottom-8 -left-8 w-40 h-40 bg-white/5 rounded-full pointer-events-none" />

        <div className="relative pt-safe px-5 pt-8 pb-14">
          <div className="flex items-center gap-4">
            {/* avatar */}
            <div className="w-20 h-20 rounded-2xl gradient-brand border-2 border-white/30 flex items-center justify-center font-display text-3xl font-bold text-white shadow-xl bg-white/10 shrink-0">
              {initial}
            </div>

            {/* info */}
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-white truncate">{name}</h1>
              {email && <p className="text-sm text-white/70 mt-0.5 truncate">{email}</p>}
              {phone && <p className="text-sm text-white/70 truncate">{phone}</p>}
              <div className="mt-2">
                {verified
                  ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-money-soft text-money border border-money/20">
                      <CheckCircle2 className="w-3 h-3" aria-hidden /> Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-warn-soft text-warn border border-warn/20">
                      Pending KYC
                    </span>
                  )
                }
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats row (floats over hero bottom) ─────────────────── */}
      <div className="grid grid-cols-3 gap-3 px-4 -mt-6 animate-fade-up">
        {[
          { label: 'Jobs Done', value: jobsDone, icon: null },
          {
            label: 'Rating',
            value: (
              <span className="flex items-center gap-1">
                <Star className="w-4 h-4 text-warn fill-warn" aria-hidden />
                {rating > 0 ? rating.toFixed(1) : '—'}
              </span>
            ),
            icon: null,
          },
          { label: 'Exp. (yrs)', value: expYears > 0 ? expYears : '—', icon: null },
        ].map(stat => (
          <div
            key={stat.label}
            className="rounded-2xl bg-card border border-line p-3 text-center shadow-sm"
          >
            <p className="text-lg font-bold text-ink flex items-center justify-center">
              {stat.value}
            </p>
            <p className="text-xs text-ink-3 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* ── Content sections ─────────────────────────────────────── */}
      <div className="p-4 space-y-4 animate-fade-up stagger-1">

        {saveError && <ErrorBanner message={saveError} />}

        {/* Active Trades */}
        <Card className="p-4 space-y-3">
          <SectionHeader
            title="Active Trades"
            action={
              <Badge tone="brand">{skills.length} selected</Badge>
            }
          />
          <div className="flex flex-wrap gap-2">
            {ALL_TRADES.map(trade => (
              <Chip
                key={trade}
                label={trade}
                selected={skills.includes(trade)}
                onClick={() => toggleTrade(trade)}
              />
            ))}
          </div>
          <p className="text-xs text-ink-3">At least 1 trade must remain selected.</p>
        </Card>

        {/* Service Radius */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-ink-3 shrink-0" aria-hidden />
            <span className="text-sm font-semibold text-ink flex-1">Dispatch Radius</span>
            <Badge tone="brand" className="font-mono">{radius} km</Badge>
          </div>
          <input
            type="range"
            min={5}
            max={30}
            step={1}
            value={radius}
            onChange={e => { setRadius(Number(e.target.value)); setSaveSuccess(false); }}
            className="w-full accent-brand h-2 rounded-full cursor-pointer"
            aria-label="Service radius in km"
          />
          <div className="flex justify-between text-xs text-ink-4">
            <span>5 km</span>
            <span>30 km</span>
          </div>
        </Card>

        {/* Save Button */}
        <Button
          variant="secondary"
          full
          loading={saving}
          onClick={handleSave}
          icon={saveSuccess ? <CheckCircle2 className="w-4 h-4 text-money" /> : undefined}
        >
          {saveSuccess ? 'Saved!' : 'Save Changes'}
        </Button>

        {/* Linked Payout */}
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-money-soft flex items-center justify-center shrink-0">
              <CreditCard className="w-5 h-5 text-money" aria-hidden />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink">
                {upiId ? 'UPI Account' : bankName ? 'Bank Account' : 'No payout linked'}
              </p>
              <p className="text-xs text-ink-3 truncate font-mono mt-0.5">
                {upiId ?? technicianProfile?.bank_account_number ?? 'Add in KYC settings'}
              </p>
            </div>
            {(upiId || technicianProfile?.bank_account_number) && (
              <Badge tone="money" dot>Active</Badge>
            )}
          </div>
        </Card>

        {/* Sign Out */}
        <Button
          variant="ghost"
          full
          icon={<LogOut className="w-4 h-4" />}
          className="text-danger hover:text-danger hover:bg-danger-soft border border-danger/20 mt-2"
          onClick={signOut}
        >
          Sign Out
        </Button>
      </div>
    </div>
  );
}
