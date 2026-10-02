import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './authStore';
import type { Booking } from '../types';
import { startContinuousRadarAlert, stopContinuousRadarAlert, playSuccessChime } from '../lib/audio';
import { triggerHapticNotification, triggerHapticImpact } from '../lib/haptics';

export const OFFER_TIMEOUT_SECONDS = 45;

const BOOKING_SELECT = `
  *,
  services ( name, category, image_url ),
  booking_items ( id, quantity, unit_price, total_price, services ( name, image_url ) )
`;

type Connection = 'offline' | 'connecting' | 'live' | 'reconnecting';

interface RadarState {
  /** Offers waiting for a decision. First item is the one on screen. */
  offerQueue: Booking[];
  incomingOffer: Booking | null;
  /** epoch ms at which the on-screen offer expires (computed, so background throttling can't drift it) */
  offerDeadline: number | null;
  /** Job the technician is physically doing right now (on_the_way / in_progress). Only this blocks new offers. */
  activeJob: Booking | null;
  /** Accepted but not started yet (soonest first). These do NOT block accepting other jobs. */
  upcomingJobs: Booking[];
  availableJobs: Booking[];
  feedLoading: boolean;
  feedError: string | null;
  connection: Connection;
  isClaiming: boolean;
  claimError: string | null;

  setActiveJob: (job: Booking | null) => void;
  startRadarSubscription: (technicianId: string) => () => void;
  fetchAvailableJobs: () => Promise<void>;
  fetchMyJobs: (technicianId: string) => Promise<void>;
  claimJob: (bookingId: string) => Promise<{ success: boolean; message: string }>;
  declineOffer: (bookingId: string) => void;
  /** Open a job from the feed in the same sheet used for live offers (no alert sound). */
  presentOffer: (job: Booking) => void;
  reset: () => void;
}

const seenOfferIds = new Set<string>(); // ids already offered (or dismissed) this session

const mySkills = () => useAuthStore.getState().technicianProfile?.skills ?? [];

function matchesSkills(b: Booking): boolean {
  const skills = mySkills();
  const category = b.services?.category;
  // Unknown category = cannot verify, so do NOT show it (old code let everything through).
  return Boolean(category) && skills.includes(category as string);
}

export const useRadarStore = create<RadarState>((set, get) => ({
  offerQueue: [],
  incomingOffer: null,
  offerDeadline: null,
  activeJob: null,
  upcomingJobs: [],
  availableJobs: [],
  feedLoading: false,
  feedError: null,
  connection: 'offline',
  isClaiming: false,
  claimError: null,

  setActiveJob: (job) => set({ activeJob: job }),

  reset: () => {
    stopContinuousRadarAlert();
    seenOfferIds.clear();
    set({
      offerQueue: [], incomingOffer: null, offerDeadline: null, availableJobs: [],
      feedError: null, connection: 'offline', claimError: null,
    });
  },

  fetchMyJobs: async (technicianId) => {
    const { data, error } = await supabase
      .from('bookings')
      .select(BOOKING_SELECT)
      .eq('technician_id', technicianId)
      .in('status', ['accepted', 'assigned', 'on_the_way', 'in_progress'])
      .order('scheduled_date', { ascending: true });

    if (error || !data) return;
    const jobs = data as unknown as Booking[];
    set({
      activeJob: jobs.find((j) => j.status === 'on_the_way' || j.status === 'in_progress') ?? null,
      upcomingJobs: jobs.filter((j) => j.status === 'accepted' || j.status === 'assigned'),
    });
  },

  fetchAvailableJobs: async () => {
    set({ feedLoading: true });
    const { data, error } = await supabase
      .from('bookings')
      .select(BOOKING_SELECT)
      .is('technician_id', null)
      .eq('status', 'confirmed')
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      set({ feedLoading: false, feedError: 'Could not load jobs. Pull to retry.' });
      return;
    }
    const jobs = ((data ?? []) as unknown as Booking[]).filter(matchesSkills);
    set({ availableJobs: jobs, feedLoading: false, feedError: null });
  },

  startRadarSubscription: (technicianId) => {
    const { fetchAvailableJobs, fetchMyJobs } = get();
    set({ connection: 'connecting' });
    void fetchAvailableJobs();
    void fetchMyJobs(technicianId);

    const enqueueOffer = (b: Booking) => {
      if (seenOfferIds.has(b.id) || !matchesSkills(b)) return;
      seenOfferIds.add(b.id);
      // Only a job in progress blocks ringing; a future accepted job does not.
      if (get().activeJob) return;

      const queue = [...get().offerQueue, b];
      const wasEmpty = get().incomingOffer === null;
      set({
        offerQueue: queue,
        incomingOffer: wasEmpty ? b : get().incomingOffer,
        offerDeadline: wasEmpty ? Date.now() + OFFER_TIMEOUT_SECONDS * 1000 : get().offerDeadline,
      });
      if (wasEmpty) {
        startContinuousRadarAlert();
        void triggerHapticNotification();
      }
    };

    const loadAndEnqueue = async (id: string) => {
      const { data } = await supabase.from('bookings').select(BOOKING_SELECT).eq('id', id).maybeSingle();
      if (data) {
        const b = data as unknown as Booking;
        if (b.status === 'confirmed' && !b.technician_id) {
          enqueueOffer(b);
          void get().fetchAvailableJobs();
        }
      }
    };

    const dropFromQueues = (id: string) => {
      const queue = get().offerQueue.filter((o) => o.id !== id);
      const wasFront = get().incomingOffer?.id === id;
      set({
        offerQueue: queue,
        availableJobs: get().availableJobs.filter((j) => j.id !== id),
        ...(wasFront
          ? {
              incomingOffer: queue[0] ?? null,
              offerDeadline: queue[0] ? Date.now() + OFFER_TIMEOUT_SECONDS * 1000 : null,
              claimError: null,
            }
          : {}),
      });
      if (wasFront && !queue[0]) stopContinuousRadarAlert();
    };

    const channel = supabase
      .channel('handyman-radar')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bookings' }, (payload) => {
        const nb = payload.new as { id: string; status: string; technician_id: string | null };
        if (nb.status === 'confirmed' && !nb.technician_id) void loadAndEnqueue(nb.id);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'bookings' }, (payload) => {
        const u = payload.new as { id: string; status: string; technician_id: string | null };

        // pending -> confirmed after payment is the usual flow, so UPDATE must also create offers.
        if (u.status === 'confirmed' && !u.technician_id) {
          void loadAndEnqueue(u.id);
          return;
        }
        // Taken by someone else / cancelled: remove locally (no full refetch for every booking change).
        if ((u.technician_id && u.technician_id !== technicianId) || u.status === 'cancelled') {
          dropFromQueues(u.id);
        }
        // Changes to my own jobs (or newly assigned to me):
        if (u.technician_id === technicianId) {
          dropFromQueues(u.id); // ALWAYS drop from open/available queues!
          void get().fetchMyJobs(technicianId);
          void get().fetchAvailableJobs(); // refresh available feed immediately
          if (u.status === 'assigned') {
            playSuccessChime();
            void triggerHapticNotification();
          }
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          set({ connection: 'live' });
          void get().fetchAvailableJobs(); // catch up on anything missed while disconnected
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          set({ connection: 'reconnecting' });
        }
      });

    return () => {
      supabase.removeChannel(channel);
      get().reset();
    };
  },

  claimJob: async (bookingId) => {
    set({ isClaiming: true, claimError: null });
    stopContinuousRadarAlert();
    void triggerHapticImpact();

    try {
      const { data, error } = await supabase.rpc('claim_booking', { p_booking_id: bookingId });
      if (error) throw error;

      const result = data as { success: boolean; message: string };
      if (result.success) {
        playSuccessChime();
        void triggerHapticNotification();
        const technicianId = useAuthStore.getState().user?.id;
        get().declineOffer(bookingId); // removes it from the queue; no alert restart needed
        set({ isClaiming: false, claimError: null });
        if (technicianId) await get().fetchMyJobs(technicianId);
        return result;
      }
      // KEEP the offer on screen so the technician actually sees why it failed.
      set({ claimError: result.message, isClaiming: false });
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not accept the job. Please try again.';
      set({ claimError: msg, isClaiming: false });
      return { success: false, message: msg };
    }
  },

  presentOffer: (job) => {
    if (get().incomingOffer) return;
    set({
      incomingOffer: job,
      offerQueue: [job, ...get().offerQueue.filter((o) => o.id !== job.id)],
      offerDeadline: Date.now() + OFFER_TIMEOUT_SECONDS * 1000,
      claimError: null,
    });
  },

  declineOffer: (bookingId) => {
    void triggerHapticImpact();
    const queue = get().offerQueue.filter((o) => o.id !== bookingId);
    const wasFront = get().incomingOffer?.id === bookingId;
    set({
      offerQueue: queue,
      ...(wasFront
        ? {
            incomingOffer: queue[0] ?? null,
            offerDeadline: queue[0] ? Date.now() + OFFER_TIMEOUT_SECONDS * 1000 : null,
            claimError: null,
          }
        : {}),
    });
    if (wasFront) {
      if (queue[0]) startContinuousRadarAlert();
      else stopContinuousRadarAlert();
    }
  },
}));
