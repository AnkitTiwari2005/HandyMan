import { useState, useEffect } from 'react';
import { 
  Wallet as WalletIcon, ArrowUpRight, ArrowDownLeft, 
  IndianRupee, Sparkles, Building, AlertCircle, CheckCircle2, Loader2, ArrowRight 
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { triggerHapticImpact, triggerHapticNotification } from '../lib/haptics';
import { formatDateTime, formatMoney } from '../lib/format';
import type { PayoutTransaction } from '../types';

export default function Wallet() {
  const { user, technicianProfile, fetchProfiles } = useAuthStore();
  const [payouts, setPayouts] = useState<PayoutTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [withdrawModal, setWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchLedger();
  }, [user]);

  const fetchLedger = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('technician_payouts')
        .select('*')
        .eq('technician_id', user?.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setPayouts(data as PayoutTransaction[]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !technicianProfile) return;
    triggerHapticImpact();
    const amountNum = parseFloat(withdrawAmount);

    if (isNaN(amountNum) || amountNum <= 0) {
      setErrorMsg('Please enter a valid amount');
      return;
    }

    if (amountNum > technicianProfile.wallet_balance) {
      setErrorMsg('Amount is more than your wallet balance');
      return;
    }

    setWithdrawLoading(true);
    setErrorMsg(null);

    try {
      // Atomic, server-side: checks balance, deducts and writes the ledger in ONE transaction.
      const { data, error } = await supabase.rpc('request_withdrawal', { p_amount: amountNum });
      if (error) throw error;
      const res = data as { success: boolean; message: string };
      if (!res.success) {
        setErrorMsg(res.message);
        return;
      }

      triggerHapticNotification();
      setSuccessMsg(`Withdrawal of ${formatMoney(amountNum)} requested. It shows as pending until the transfer is confirmed.`);
      window.setTimeout(() => setSuccessMsg(null), 6000);
      setWithdrawModal(false);
      setWithdrawAmount('');
      await fetchProfiles(user.id);
      await fetchLedger();
    } catch (err: any) {
      setErrorMsg(err.message || 'Withdrawal failed. Try again.');
    } finally {
      setWithdrawLoading(false);
    }
  };

  const balance = technicianProfile?.wallet_balance || 0;

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto pb-safe">
      <h1 className="text-xl font-bold text-ink">Earnings</h1>

      {/* Hero Wallet Balance Card */}
      <div className="p-6 rounded-3xl bg-gradient-to-tr from-slate-900 via-slate-900 to-orange-950/60 border border-orange-500/30 shadow-2xl relative overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20">
              <WalletIcon className="w-5 h-5" />
            </div>
            <span className="text-xs font-syne font-bold uppercase tracking-wider text-slate-300">
              Available Balance
            </span>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            Paid per job
          </span>
        </div>

        <div className="flex items-baseline gap-1 my-2">
          <span className="text-4xl font-mono font-bold text-white tracking-tight">
            {formatMoney(balance, { paise: true })}
          </span>
        </div>

        <p className="text-[11px] text-slate-400 mt-2">
          Linked Payout UPI: <span className="font-mono text-slate-200">{technicianProfile?.bank_upi_id || 'Not configured'}</span>
        </p>

        {/* Withdrawal Trigger Button */}
        <button
          onClick={() => {
            triggerHapticImpact();
            setWithdrawModal(true);
          }}
          disabled={balance <= 0}
          className="w-full mt-5 py-3 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 font-syne font-bold text-xs shadow-lg shadow-orange-500/20 active:scale-98 transition-all flex items-center justify-center gap-1.5 disabled:opacity-40"
        >
          <ArrowUpRight className="w-4 h-4 text-slate-950" />
          <span>Withdraw to Bank / UPI</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-3 rounded-2xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Transaction History Ledger */}
      <div>
        <h3 className="text-xs font-syne font-bold uppercase tracking-wider text-slate-300 mb-3 px-1">
          Settlement Ledger ({payouts.length})
        </h3>

        {loading ? (
          <div className="p-8 text-center">
            <Loader2 className="w-6 h-6 animate-spin text-orange-500 mx-auto mb-2" />
            <p className="text-xs text-slate-400">Loading ledger...</p>
          </div>
        ) : payouts.length === 0 ? (
          <div className="p-8 rounded-3xl bg-slate-900/40 border border-slate-800 text-center">
            <p className="text-xs font-syne text-slate-400">No transactions recorded yet.</p>
            <p className="text-[11px] text-slate-500 mt-1">Earnings will credit automatically upon job completion.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {payouts.map((tx) => {
              const isCredit = tx.type === 'job_payout' || tx.type === 'incentive';

              return (
                <div
                  key={tx.id}
                  className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800/80 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl border ${
                      isCredit
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    }`}>
                      {isCredit ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="text-xs font-syne font-bold text-white capitalize">
                        {tx.type.replace('_', ' ')}
                      </p>
                      <p className="text-xs text-slate-400 truncate max-w-[180px]">
                        {tx.notes || formatDateTime(tx.created_at)}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className={`text-base font-bold ${
                      isCredit ? 'text-emerald-400' : 'text-slate-200'
                    }`}>
                      {isCredit ? '+' : '−'}{formatMoney(Number(tx.amount), { paise: true })}
                    </p>
                    <span className="text-xs text-slate-400">
                      {tx.status === 'pending' ? 'Pending · ' : ''}{formatDateTime(tx.created_at)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Withdrawal Modal */}
      {withdrawModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4">
            <h3 className="font-syne font-bold text-lg text-white">
              Withdraw Earnings
            </h3>
            <p className="text-xs text-slate-400">
              Funds will be dispatched to <span className="font-mono text-orange-400">{technicianProfile?.bank_upi_id}</span>
            </p>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/30 text-rose-300 text-xs">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleWithdraw} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1.5">Amount (₹) · minimum ₹100</label>
                <input
                  type="number"
                  min="100"
                  max={balance}
                  inputMode="decimal"
                  required
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder={`Max ₹${balance.toFixed(0)}`}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-3 text-lg font-mono text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setWithdrawModal(false)}
                  className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-300 font-syne font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={withdrawLoading || !withdrawAmount}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 font-syne font-bold text-xs shadow-md disabled:opacity-50"
                >
                  {withdrawLoading ? 'Transferring...' : 'Confirm Payout'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
