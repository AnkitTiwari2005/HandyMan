import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ChevronRight } from 'lucide-react';
import { Button, EmptyState, ErrorBanner, PageHeader, SkeletonCard } from '../components/ui';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';
import { formatDateTime } from '../lib/format';
import type { NotificationItem } from '../types';

/* ─── Page ───────────────────────────────────────────────────── */
export default function Notifications() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [items, setItems]       = useState<NotificationItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  const unreadCount = items.filter((n) => !n.is_read).length;

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
        .limit(60);

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

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  /* ── Actions ───────────────────────────────────────────────── */
  async function openNotification(item: NotificationItem) {
    // Optimistic update
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
    }
  }

  async function markAllRead() {
    if (!user || unreadCount === 0) return;

    // Optimistic update
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));

    const unreadIds = items.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length === 0) return;

    await supabase
      .from('notifications')
      .update({ is_read: true })
      .in('id', unreadIds);
  }

  /* ── Render ────────────────────────────────────────────────── */
  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto pb-nav">
      {/* Header */}
      <div className="animate-fade-up">
        <PageHeader
          title="Notifications"
          subtitle="Updates &amp; alerts"
          action={
            unreadCount > 0 ? (
              <Button variant="ghost" size="sm" onClick={markAllRead}>
                Mark all read
              </Button>
            ) : undefined
          }
        />
      </div>

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
      {!loading && !error && items.length === 0 && (
        <div className="animate-fade-up stagger-2">
          <EmptyState
            icon={<Bell className="w-7 h-7" />}
            title="All clear!"
            body="No new alerts. Accepted jobs and earnings appear here."
          />
        </div>
      )}

      {/* Notification list */}
      {!loading && items.length > 0 && (
        <div className="space-y-2 animate-fade-up stagger-1">
          {items.map((item, idx) => (
            <NotificationRow
              key={item.id}
              item={item}
              delay={Math.min(idx, 4) as 0 | 1 | 2 | 3 | 4}
              onOpen={openNotification}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Notification row ───────────────────────────────────────── */
interface RowProps {
  item: NotificationItem;
  delay: 0 | 1 | 2 | 3 | 4;
  onOpen: (item: NotificationItem) => void;
}

function NotificationRow({ item, onOpen }: RowProps) {
  const isUnread = !item.is_read;

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={`
        w-full text-left rounded-2xl border p-4 transition-all duration-200
        ${isUnread
          ? 'bg-card border-brand/30 shadow-sm shadow-brand/5 hover:border-brand/50'
          : 'bg-card-2/50 border-line opacity-80 hover:opacity-100'
        }
      `}
    >
      <div className="flex items-start gap-3">
        {/* Unread dot */}
        <div className="mt-1.5 shrink-0 w-2 h-2">
          {isUnread && (
            <span className="block w-2 h-2 rounded-full bg-brand pulse-brand" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={`text-sm leading-snug ${isUnread ? 'font-semibold text-ink' : 'font-medium text-ink-2'}`}>
              {item.title}
            </p>
            <span className="font-mono text-xs text-ink-3 whitespace-nowrap shrink-0">
              {formatDateTime(item.created_at)}
            </span>
          </div>
          <p className="text-sm text-ink-3 mt-1 leading-relaxed line-clamp-2">
            {item.body}
          </p>
        </div>

        {/* Chevron if navigable */}
        {item.booking_id && (
          <ChevronRight className="w-4 h-4 text-ink-4 shrink-0 mt-0.5" />
        )}
      </div>
    </button>
  );
}
