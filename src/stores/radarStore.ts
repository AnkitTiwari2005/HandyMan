import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Booking } from '../types';
import { startContinuousRadarAlert, stopContinuousRadarAlert, playSuccessChime } from '../lib/audio';
import { triggerHapticNotification, triggerHapticImpact } from '../lib/haptics';

interface RadarState {
  incomingOffer: Booking | null;
  activeJob: Booking | null;
  availableJobs: Booking[];
  isSubscribed: boolean;
  isClaiming: boolean;
  claimError: string | null;
  
  setIncomingOffer: (offer: Booking | null) => void;
  setActiveJob: (job: Booking | null) => void;
  setAvailableJobs: (jobs: Booking[]) => void;
  
  startRadarSubscription: (technicianId: string, skills: string[]) => () => void;
  fetchAvailableJobs: (skills: string[]) => Promise<void>;
  fetchActiveJob: (technicianId: string) => Promise<void>;
  
  claimJob: (bookingId: string, technicianId: string) => Promise<{ success: boolean; message: string }>;
  declineOffer: (bookingId: string) => void;
}

export const useRadarStore = create<RadarState>((set, get) => ({
  incomingOffer: null,
  activeJob: null,
  availableJobs: [],
  isSubscribed: false,
  isClaiming: false,
  claimError: null,

  setIncomingOffer: (offer) => {
    if (offer) {
      startContinuousRadarAlert();
      triggerHapticNotification();
    } else {
      stopContinuousRadarAlert();
    }
    set({ incomingOffer: offer });
  },

  setActiveJob: (job) => set({ activeJob: job }),
  setAvailableJobs: (jobs) => set({ availableJobs: jobs }),

  fetchActiveJob: async (technicianId: string) => {
    try {
      const activeStatuses = ['accepted', 'on_the_way', 'in_progress'];
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          services ( name, category, image_url ),
          booking_items (
            id,
            quantity,
            unit_price,
            total_price,
            services ( name, image_url )
          )
        `)
        .eq('technician_id', technicianId)
        .in('status', activeStatuses)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        set({ activeJob: data as unknown as Booking });
      } else if (!data) {
        set({ activeJob: null });
      }
    } catch (e) {
      console.error('Failed to fetch active job:', e);
    }
  },

  fetchAvailableJobs: async (skills: string[]) => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          services ( name, category, image_url ),
          booking_items (
            id,
            quantity,
            unit_price,
            total_price,
            services ( name, image_url )
          )
        `)
        .is('technician_id', null)
        .eq('status', 'confirmed')
        .order('created_at', { ascending: false })
        .limit(20);

      if (!error && data) {
        // Filter by technician skills if specified
        const filtered = data.filter((b: any) => {
          if (!skills.length) return true;
          const serviceCategory = b.services?.category;
          return !serviceCategory || skills.includes(serviceCategory);
        });
        set({ availableJobs: filtered as unknown as Booking[] });
      }
    } catch (e) {
      console.error('Failed to fetch available jobs:', e);
    }
  },

  startRadarSubscription: (technicianId: string, skills: string[]) => {
    const { fetchAvailableJobs, fetchActiveJob } = get();

    // Initial fetch
    fetchAvailableJobs(skills);
    fetchActiveJob(technicianId);

    // Channel for open bookings (Radar broadcast)
    const channel = supabase
      .channel('handyman-radar')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bookings',
        },
        async (payload) => {
          const newBooking = payload.new as any;
          if (newBooking.status === 'confirmed' && !newBooking.technician_id) {
            // Fetch complete relation
            const { data } = await supabase
              .from('bookings')
              .select(`
                *,
                services ( name, category, image_url ),
                booking_items ( id, quantity, unit_price, total_price, services ( name, image_url ) )
              `)
              .eq('id', newBooking.id)
              .single();

            if (data) {
              const fullBooking = data as unknown as Booking;
              const matchesSkill = !skills.length || (fullBooking.services?.category && skills.includes(fullBooking.services.category));
              
              if (matchesSkill) {
                // If technician doesn't currently have an active job in progress, ring the offer
                const currentActive = get().activeJob;
                if (!currentActive) {
                  get().setIncomingOffer(fullBooking);
                }
                // Also update available jobs list
                fetchAvailableJobs(skills);
              }
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings',
        },
        (payload) => {
          const updated = payload.new as any;
          
          // If the incoming offer was claimed by someone else or cancelled
          const currentOffer = get().incomingOffer;
          if (currentOffer && currentOffer.id === updated.id) {
            if (updated.technician_id && updated.technician_id !== technicianId) {
              // Claimed by another partner
              get().setIncomingOffer(null);
            } else if (updated.status === 'cancelled') {
              get().setIncomingOffer(null);
            }
          }

          // If active job was updated
          const currentActive = get().activeJob;
          if (currentActive && currentActive.id === updated.id) {
            if (updated.status === 'completed' || updated.status === 'cancelled') {
              set({ activeJob: null });
            } else {
              fetchActiveJob(technicianId);
            }
          }

          fetchAvailableJobs(skills);
        }
      )
      .subscribe((status) => {
        set({ isSubscribed: status === 'SUBSCRIBED' });
      });

    return () => {
      stopContinuousRadarAlert();
      supabase.removeChannel(channel);
      set({ isSubscribed: false });
    };
  },

  claimJob: async (bookingId: string, technicianId: string) => {
    set({ isClaiming: true, claimError: null });
    stopContinuousRadarAlert();
    triggerHapticImpact();

    try {
      // Call atomic stored procedure
      const { data, error } = await supabase.rpc('claim_booking', {
        p_booking_id: bookingId,
        p_technician_id: technicianId
      });

      if (error) {
        throw error;
      }

      const result = data as { success: boolean; message: string; payout?: number };

      if (result.success) {
        playSuccessChime();
        triggerHapticNotification();
        set({ incomingOffer: null, isClaiming: false });
        
        // Fetch active job state
        await get().fetchActiveJob(technicianId);
        return { success: true, message: result.message };
      } else {
        set({ claimError: result.message, isClaiming: false, incomingOffer: null });
        return { success: false, message: result.message };
      }
    } catch (err: any) {
      const msg = err.message || 'Failed to claim booking. Please try again.';
      set({ claimError: msg, isClaiming: false });
      return { success: false, message: msg };
    }
  },

  declineOffer: (bookingId: string) => {
    stopContinuousRadarAlert();
    triggerHapticImpact();
    const current = get().incomingOffer;
    if (current && current.id === bookingId) {
      set({ incomingOffer: null });
    }
  }
}));
