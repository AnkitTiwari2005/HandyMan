import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, ChevronRight, ShieldCheck, IndianRupee, Wrench, Briefcase, CheckCircle2,
} from 'lucide-react';
import { Button, EmptyState, ErrorBanner, PageHeader, SkeletonCard, Badge } from '../components/ui';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';
import { formatDateTime } from '../lib/format';
import type { NotificationItem } from '../types';

// Regex to strip all emojis and special decorative pictographs
const EMOJI_REGEX = /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2B50}\u{FE0F}]/gu;
function cleanText(text: string): string {
  return (text || '').replace(EMOJI_REGEX, '').replace(/\s{2,}/g, ' ').trim();
}

// Helper to determine if a notification is a customer receipt
function isCustomerReceipt(n: NotificationItem): boolean {
  const title = (n.title || '').toLowerCase();
  const body = (n.body || '').toLowerCase();
  return (
    (title.includes('booking confirmed') || title.includes('order placed')) &&
    body.startsWith('your booking')
  );
}

// Icon and tone resolver based on notification content
function getNotificationBadge(item: NotificationItem) {
  const t = (item.type || '').toLowerCase();
  const title = (item.title || '').toLowerCase();

  if (t === 'kyc' || title.includes('kyc') || title.includes('approved') || title.includes('verification')) {
    return {
      icon: <ShieldCheck className="w-4 h-4 text-brand" />,
      tone: 'brand' as const,
      label: 'Verification',
    };
  }
  if (t === 'payout' || title.includes('payout') || title.includes('earnings') || title.includes('credited') || title.includes('withdrawal')) {
    return {
      icon: <IndianRupee className="w-4 h-4 text-money" />,
      tone: 'money' as const,
      label: 'Earnings',
    };
  }
  if (t === 'booking' || title.includes('job') || title.includes('assigned') || title.includes('service')) {
    return {
      icon: <Wrench className="w-4 h-4 text-info" />,
      tone: 'info' as const,
      label: 'Job Alert',
    };
  }
  return {
    icon: <Bell className="w-4 h-4 text-ink-3" />,
    tone: 'neutral' as const,
    label: 'Alert',
  };
}

export default function Notifications() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [items, setItems]         = useState<NotificationItem[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<'partner' | 'customer'>('partner');

  /* ── Fetch ─────────────────────────────────────────────────── */
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(80);

      if (fetchErr) throw new Error(fetchErr.message);
      setItems((data ?? []) as NotificationItem[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  /* ── Realtime subscription ─────────────────────────────────── */
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newItem = payload.new as NotificationItem;
          setItems((prev) => [newItem, ...prev]);
        }
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [user]);

  /* ── Filter items into partner vs customer ─────────────────── */
  const partnerItems = items.filter((n) => !isCustomerReceipt(n));
  const customerItems = items.filter((n) => isCustomerReceipt(n));
  const activeItems = filterTab === 'partner' ? partnerItems : customerItems;

  const unreadCount = activeItems.filter((n) => !n.is_read).length;

  /* ── Actions ───────────────────────────────────────────────── */
  async function openNotification(item: NotificationItem) {
    if (!item.is_read) {
      setItems((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n))
      );
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', item.id);
    }

    if (item.booking_id) {
      navigate(`/job/${item.booking_id}`);
    } else if (item.type === 'payout') {
      navigate('/wallet');
    } else if (item.type === 'kyc') {
      navigate('/profile');
    }
  }

  async function markAllRead() {
    if (!user || unreadCount === 0) return;

    const unreadIds = activeItems.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length === 0) return;

    setItems((prev) =>
      prev.map((n) => (unreadIds.includes(n.id) ? { ...n, is_read: true } : n))
    );

    await supabase
      .from('notifications')
      .update({ is_read: true })
      .in('id', unreadIds);
  }

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto pb-nav">
      {/* Header */}
      <div className="animate-fade-up">
        <PageHeader
          title="Notifications"
          subtitle="Partner dispatches, payouts & updates"
          action={
            unreadCount > 0 ? (
              <Button variant="ghost" size="sm" onClick={markAllRead}>
                Mark all read
              </Button>
            ) : undefined
          }
        />
      </div>

      {/* Tabs if account has customer history as well */}
      {customerItems.length > 0 && (
        <div className="flex bg-card-2 p-1 rounded-2xl border border-line gap-1 animate-fade-up">
          <button
            type="button"
            onClick={() => setFilterTab('partner')}
            className={`
              flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all
              ${filterTab === 'partner'
                ? 'bg-brand text-white shadow-sm shadow-brand/20'
                : 'text-ink-3 hover:text-ink'
              }
            `}
          >
            Partner Alerts {partnerItems.length > 0 && `(${partnerItems.length})`}
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('customer')}
            className={`
              flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all
              ${filterTab === 'customer'
                ? 'bg-brand text-white shadow-sm shadow-brand/20'
                : 'text-ink-3 hover:text-ink'
              }
            `}
          >
            Customer Orders ({customerItems.length})
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <ErrorBanner
          message={error}
          onRetry={fetchNotifications}
          className="animate-fade-up stagger-1"
        />
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="space-y-2 animate-fade-up stagger-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} lines={3} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && activeItems.length === 0 && (
        <div className="animate-fade-up stagger-2">
          <EmptyState
            icon={<Bell className="w-7 h-7" />}
            title="All clear!"
            body={
              filterTab === 'partner'
                ? 'No new partner alerts. Incoming job requests, arrival confirmations, and wallet payouts will appear here.'
                : 'No customer order receipts found.'
            }
          />
        </div>
      )}

      {/* Notification list */}
      {!loading && activeItems.length > 0 && (
        <div className="space-y-2.5 animate-fade-up stagger-1">
          {activeItems.map((item) => {
            const badge = getNotificationBadge(item);
            const isUnread = !item.is_read;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => openNotification(item)}
                className={`
                  w-full text-left rounded-2xl border p-4 transition-all duration-200 active:scale-[0.99]
                  ${isUnread
                    ? 'bg-card border-brand/35 shadow-md shadow-brand/5 hover:border-brand/50'
                    : 'bg-card-2/60 border-line opacity-85 hover:opacity-100 hover:border-ink-4'
                  }
                `}
              >
                <div className="flex items-start gap-3">
                  {/* Category icon badge */}
                  <div className="w-9 h-9 rounded-xl bg-card-2 border border-line flex items-center justify-center shrink-0 mt-0.5">
                    {badge.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Badge tone={badge.tone} className="text-[10px] px-2 py-0">
                          {badge.label}
                        </Badge>
                        {isUnread && (
                          <span className="w-1.5 h-1.5 rounded-full bg-brand shrink-0" />
                        )}
                      </div>
                      <span className="font-mono text-xs text-ink-3 whitespace-nowrap shrink-0">
                        {formatDateTime(item.created_at)}
                      </span>
                    </div>

                    <p className={`text-sm leading-snug ${isUnread ? 'font-bold text-ink' : 'font-semibold text-ink-2'}`}>
                      {cleanText(item.title)}
                    </p>
                    <p className="text-xs text-ink-3 mt-1 leading-relaxed line-clamp-2">
                      {cleanText(item.body)}
                    </p>
                  </div>

                  {/* Chevron if navigable */}
                  {(item.booking_id || item.type === 'payout' || item.type === 'kyc') && (
                    <ChevronRight className="w-4 h-4 text-ink-4 shrink-0 mt-2" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
