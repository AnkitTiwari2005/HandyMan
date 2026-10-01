import { useEffect, useState, useCallback } from 'react';
import { ArrowDownLeft, ArrowUpRight, Wallet as WalletIcon, CheckCircle2, ReceiptText } from 'lucide-react';
import {
  Button, Card, Badge, SectionHeader, SkeletonCard,
  EmptyState, ErrorBanner, StatCard, MoneyDisplay, Input, ModalBackdrop,
} from '../components/ui';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';
import { formatMoney, formatDateTime } from '../lib/format';
import type { PayoutTransaction } from '../types';

// ── quick-amount pills ─────────────────────────────────────────
const QUICK_AMOUNTS = [500, 1000, 2000];

// ── helper: label for transaction type ────────────────────────
function txLabel(type: PayoutTransaction['type']): string {
  const map: Record<PayoutTransaction['type'], string> = {
    job_payout: 'Job Payout',
    incentive:  'Incentive',
    withdrawal: 'Withdrawal',
    penalty:    'Penalty',
  };
  return map[type] ?? type;
}

export default function Wallet() {
  const { technicianProfile, profile, fetchProfiles, user } = useAuthStore();

  const [ledger, setLedger]         = useState<PayoutTransaction[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(true);
  const [ledgerError, setLedgerError]     = useState<string | null>(null);

  // withdrawal modal state
  const [showModal, setShowModal]   = useState(false);
  const [amount, setAmount]         = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawSuccess, setWithdrawSuccess] = useState(false);

  const balance     = technicianProfile?.wallet_balance ?? 0;
  const upiId       = technicianProfile?.bank_upi_id ?? null;
  const totalJobs   = technicianProfile?.total_completed_jobs ?? 0;

  // ── fetch ledger ──────────────────────────────────────────────
  const fetchLedger = useCallback(async () => {
    if (!user) return;
    setLedgerLoading(true);
    setLedgerError(null);
    const { data, error } = await supabase
      .from('payout_transactions')
      .select('*')
      .eq('technician_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) {
      setLedgerError('Could not load transaction ledger. Tap to retry.');
    } else {
      setLedger((data ?? []) as PayoutTransaction[]);
    }
    setLedgerLoading(false);
  }, [user]);

  useEffect(() => { fetchLedger(); }, [fetchLedger]);

  // ── derived: total earned (sum of job_payout + incentive) ─────
  const totalEarned = ledger
    .filter(t => t.type === 'job_payout' || t.type === 'incentive')
    .reduce((sum, t) => sum + t.amount, 0);

  // ── withdrawal handler ────────────────────────────────────────
  async function handleWithdraw() {
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum < 100) {
      setWithdrawError('Minimum withdrawal is ₹100.');
      return;
    }
    if (amountNum > balance) {
      setWithdrawError('Amount exceeds available balance.');
      return;
    }
    setWithdrawing(true);
    setWithdrawError(null);
    const { error } = await supabase.rpc('request_withdrawal', { p_amount: amountNum });
    if (error) {
      setWithdrawError(error.message || 'Withdrawal failed. Please try again.');
    } else {
      setWithdrawSuccess(true);
      if (user) await fetchProfiles(user.id);
      await fetchLedger();
      setTimeout(() => {
        setShowModal(false);
        setWithdrawSuccess(false);
        setAmount('');
      }, 1800);
    }
    setWithdrawing(false);
  }

  function openModal() {
    setAmount('');
    setWithdrawError(null);
    setWithdrawSuccess(false);
    setShowModal(true);
  }

  return (
    <div className="pb-nav">

      {/* ── Hero Balance Card ─────────────────────────────────── */}
      <div className="mx-4 mt-4 rounded-3xl overflow-hidden relative animate-fade-up">
        <div className="gradient-brand relative">
          {/* decorative circles */}
          <div className="absolute -top-10 -right-10 w-52 h-52 bg-white/5 rounded-full pointer-events-none" />
          <div className="absolute top-24 -right-6 w-28 h-28 bg-white/5 rounded-full pointer-events-none" />

          <div className="relative p-5 space-y-4">
            {/* header row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center">
                  <WalletIcon className="w-4 h-4 text-white" aria-hidden />
                </div>
                <span className="text-sm font-medium text-white/80">Available Balance</span>
              </div>
              <Badge tone="money" className="bg-white/15 text-white border-white/20">
                Paid per job
              </Badge>
            </div>

            {/* balance */}
            <div>
              <MoneyDisplay amount={balance} size="xl" className="text-white" />
            </div>

            {/* UPI */}
            <p className="text-xs text-white/60">
              {upiId ? `UPI: ${upiId}` : 'Add UPI in Profile to withdraw'}
            </p>

            {/* Withdraw CTA */}
            <button
              onClick={openModal}
              disabled={balance <= 0}
              className="w-full flex items-center justify-center gap-2 bg-white/15 backdrop-blur-sm border border-white/20 rounded-2xl py-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-white/25 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ArrowUpRight className="w-4 h-4" aria-hidden />
              Withdraw to UPI
            </button>
          </div>
        </div>
      </div>

      {/* ── Metrics row ──────────────────────────────────────────── */}
      <div className="flex gap-3 px-4 mt-4 animate-fade-up stagger-1">
        <StatCard
          label="Total Earned"
          value={<MoneyDisplay amount={totalEarned} size="sm" tone="money" />}
          tone="money"
          icon={<ReceiptText className="w-4 h-4" />}
        />
        <StatCard
          label="Jobs Done"
          value={totalJobs}
          tone="brand"
          icon={<CheckCircle2 className="w-4 h-4" />}
        />
      </div>

      {/* ── Transaction Ledger ───────────────────────────────────── */}
      <div className="px-4 mt-5 space-y-3 animate-fade-up stagger-2">
        <SectionHeader
          title="Ledger"
          action={
            !ledgerLoading && ledger.length > 0
              ? <Badge tone="neutral">{ledger.length} entries</Badge>
              : undefined
          }
        />

        {ledgerError && (
          <ErrorBanner message={ledgerError} onRetry={fetchLedger} />
        )}

        {ledgerLoading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map(i => <SkeletonCard key={i} lines={2} />)}
          </div>
        ) : ledger.length === 0 && !ledgerError ? (
          <EmptyState
            icon={<ReceiptText className="w-6 h-6" />}
            title="No transactions yet"
            body="Your payouts and withdrawal requests will appear here once you complete your first job."
          />
        ) : (
          <div className="space-y-2.5">
            {ledger.map(tx => {
              const isCredit = tx.type === 'job_payout' || tx.type === 'incentive';
              return (
                <Card key={tx.id} className="p-4">
                  <div className="flex items-center gap-3">
                    {/* icon */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isCredit ? 'bg-money-soft' : 'bg-card-2'}`}>
                      {isCredit
                        ? <ArrowDownLeft className="w-5 h-5 text-money" aria-hidden />
                        : <ArrowUpRight className="w-5 h-5 text-ink-3" aria-hidden />
                      }
                    </div>

                    {/* center */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ink">{txLabel(tx.type)}</p>
                      <p className="text-xs text-ink-3 mt-0.5 truncate">
                        {tx.notes ?? formatDateTime(tx.created_at)}
                      </p>
                      {tx.status === 'pending' && (
                        <Badge tone="warn" className="mt-1">Pending</Badge>
                      )}
                      {tx.status === 'failed' && (
                        <Badge tone="danger" className="mt-1">Failed</Badge>
                      )}
                    </div>

                    {/* amount */}
                    <div className="text-right shrink-0">
                      <span className={`text-base font-bold font-mono ${isCredit ? 'text-money' : 'text-ink-2'}`}>
                        {isCredit ? '+' : '−'}{formatMoney(tx.amount)}
                      </span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Withdrawal Modal ─────────────────────────────────────── */}
      {showModal && (
        <ModalBackdrop onClose={() => !withdrawing && setShowModal(false)}>
          <Card className="p-5 space-y-4">
            <div>
              <h2 className="text-lg font-bold text-ink">Withdraw Balance</h2>
              {upiId
                ? <p className="text-xs text-ink-3 mt-1">Funds will be sent to <span className="font-mono text-ink-2">{upiId}</span></p>
                : <p className="text-xs text-warn mt-1">⚠ No UPI linked — add one in Profile first.</p>
              }
            </div>

            {withdrawSuccess ? (
              <div className="flex flex-col items-center gap-3 py-6">
                <div className="w-14 h-14 rounded-2xl bg-money-soft flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7 text-money" />
                </div>
                <p className="text-base font-semibold text-ink">Withdrawal requested!</p>
                <p className="text-sm text-ink-2 text-center">Your payout is being processed.</p>
              </div>
            ) : (
              <>
                <Input
                  label="Amount"
                  type="number"
                  placeholder="Enter amount (min ₹100)"
                  value={amount}
                  onChange={e => { setAmount(e.target.value); setWithdrawError(null); }}
                  error={withdrawError ?? undefined}
                  min={100}
                  max={balance}
                  required
                />

                {/* quick amounts */}
                <div>
                  <p className="text-xs text-ink-3 mb-2">Quick select</p>
                  <div className="flex gap-2">
                    {QUICK_AMOUNTS.map(q => (
                      <button
                        key={q}
                        type="button"
                        disabled={q > balance}
                        onClick={() => { setAmount(String(q)); setWithdrawError(null); }}
                        className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed
                          ${amount === String(q)
                            ? 'bg-brand-soft text-brand border-brand/40'
                            : 'bg-card-2 text-ink-2 border-line hover:border-ink-3 hover:text-ink'
                          }`}
                      >
                        ₹{q.toLocaleString('en-IN')}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <Button
                    variant="ghost"
                    full
                    onClick={() => setShowModal(false)}
                    disabled={withdrawing}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="success"
                    full
                    loading={withdrawing}
                    disabled={!upiId || !amount || parseFloat(amount) < 100}
                    onClick={handleWithdraw}
                  >
                    Confirm Payout
                  </Button>
                </div>
              </>
            )}
          </Card>
        </ModalBackdrop>
      )}
    </div>
  );
}
