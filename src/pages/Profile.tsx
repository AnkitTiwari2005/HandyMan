import { useEffect, useState, useCallback } from 'react';
import { Star, LogOut, CheckCircle2, CreditCard, MapPin } from 'lucide-react';
import {
  Button, Card, Badge, Chip, SectionHeader, ErrorBanner,
} from '../components/ui';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';

// ── Canonical categories matching the database service catalog ──
const ALL_TRADES = [
  'Electrical',
  'Plumbing',
  'Carpentry',
  'Painting',
  'Cleaning',
  'Pest Control',
  'Appliance Repair',
] as const;

// ── Normalize legacy terms to canonical category names ────────
function normalizeTrade(t: string): string {
  const map: Record<string, string> = {
    'Electrician': 'Electrical',
    'Plumber': 'Plumbing',
    'Carpenter': 'Carpentry',
    'Painter': 'Painting',
    'AC Technician': 'Appliance Repair',
  };
  return map[t] || t;
}

export default function Profile() {
  const { profile, technicianProfile, fetchProfiles, user, signOut } = useAuthStore();

  // local editable state with normalization
  const [skills, setSkills] = useState<string[]>(() => {
    const raw = technicianProfile?.skills ?? [];
    return Array.from(new Set(raw.map(normalizeTrade)));
  });
  const [radius, setRadius] = useState<number>(technicianProfile?.service_radius_km ?? 15);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // sync when technicianProfile loads or changes
  useEffect(() => {
    if (technicianProfile) {
      const raw = technicianProfile.skills ?? [];
      const normalized = Array.from(new Set(raw.map(normalizeTrade)));
      setSkills(normalized);
      setRadius(technicianProfile.service_radius_km ?? 15);
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

    const cleanSkills = Array.from(new Set(skills.map(normalizeTrade)));

    const { error } = await supabase
      .from('technician_profiles')
      .update({
        skills: cleanSkills,
        service_radius_km: radius,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (error) {
      setSaveError(error.message || 'Could not save changes. Please try again.');
    } else {
      setSaveSuccess(true);
      await fetchProfiles(user.id);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
    setSaving(false);
  }

  // ── derived display values ────────────────────────────────────
  const name     = profile?.full_name ?? 'Partner';
  const email    = profile?.email ?? '';
  const initial  = name.charAt(0).toUpperCase();
  const rating   = technicianProfile?.rating ?? 5.0;
  const jobsDone = technicianProfile?.total_completed_jobs ?? 0;
  const expYears = technicianProfile?.experience_years ?? 3;
  const verified = technicianProfile?.verification_status === 'approved';
  const upiId    = technicianProfile?.bank_upi_id;
  const bankName = technicianProfile?.bank_account_name;

  return (
    <div className="pb-32 space-y-0">
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
              <div className="mt-2">
                {verified ? (
                  <span className="inline-flex items-center gap-1 bg-white/20 text-white text-xs font-semibold px-2.5 py-0.5 rounded-full backdrop-blur-sm">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" /> Verified Partner
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 bg-amber-400/20 text-amber-200 text-xs font-semibold px-2.5 py-0.5 rounded-full backdrop-blur-sm">
                    Pending Verification
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Floating Stats Row ────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3 px-4 -mt-7 relative z-10">
        {[
          { label: 'Jobs Done',  value: String(jobsDone) },
          {
            label: 'Rating',
            value: (
              <span className="inline-flex items-center gap-1">
                <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                {Number(rating).toFixed(1)}
              </span>
            ),
          },
          { label: 'Exp. (yrs)', value: String(expYears) },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl bg-card border border-line p-3.5 text-center shadow-lg">
            <p className="text-lg font-bold text-ink flex items-center justify-center font-mono">
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
          <p className="text-xs text-ink-3">At least 1 trade must remain selected to receive matches.</p>
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
            className="w-full accent-[var(--color-brand)] h-2 rounded-full cursor-pointer"
            aria-label="Service radius in km"
          />
          <div className="flex justify-between text-xs text-ink-4 font-mono">
            <span>5 km</span>
            <span>30 km</span>
          </div>
        </Card>

        {/* Save Button */}
        <Button
          variant="primary"
          full
          loading={saving}
          onClick={handleSave}
          icon={saveSuccess ? <CheckCircle2 className="w-4 h-4 text-white" /> : undefined}
        >
          {saveSuccess ? 'Changes Saved!' : 'Save Changes'}
        </Button>

        {/* Linked Payout */}
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-money-soft flex items-center justify-center shrink-0">
              <CreditCard className="w-5 h-5 text-money" aria-hidden />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink">
                {upiId ? 'UPI Settlement' : bankName ? 'Bank Account' : 'No payout linked'}
              </p>
              <p className="text-xs text-ink-3 truncate font-mono mt-0.5">
                {upiId ?? technicianProfile?.bank_account_number ?? 'Configured during KYC'}
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
          className="text-danger hover:text-danger hover:bg-danger-soft border border-danger/20"
          onClick={signOut}
        >
          Sign Out
        </Button>
      </div>
    </div>
  );
}
