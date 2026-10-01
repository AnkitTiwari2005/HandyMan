import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { UserProfile, TechnicianProfile } from '../types';

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  technicianProfile: TechnicianProfile | null;
  /** True only until the FIRST session + profile load finishes. Later refreshes are silent. */
  isLoading: boolean;
  profileError: string | null;
  /** id of the user whose profiles have been loaded at least once (prevents a wrong /kyc redirect while loading) */
  profileLoadedFor: string | null;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  signOut: () => Promise<void>;
  /** Reloads profiles without ever unmounting the app after the first load. */
  fetchProfiles: (userId: string) => Promise<void>;
  toggleOnlineStatus: (status?: boolean) => Promise<{ ok: boolean; message?: string }>;
  updateLocation: (lat: number, lng: number) => Promise<void>;
}

// NOTE: deliberately NOT persisted. Wallet, ID number and UPI must not sit in
// localStorage. Supabase already persists the session itself.
export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  profile: null,
  technicianProfile: null,
  isLoading: true,
  profileError: null,
  profileLoadedFor: null,

  setUser: (user) => set({ user }),
  setLoading: (isLoading) => set({ isLoading }),

  signOut: async () => {
    const { technicianProfile } = get();
    if (technicianProfile?.is_online) {
      try {
        await supabase
          .from('technician_profiles')
          .update({ is_online: false, updated_at: new Date().toISOString() })
          .eq('id', technicianProfile.id);
      } catch (e) {
        console.error('Error going offline on sign out:', e);
      }
    }
    await supabase.auth.signOut();
    set({ user: null, profile: null, technicianProfile: null, profileLoadedFor: null, isLoading: false });
  },

  fetchProfiles: async (userId: string) => {
    try {
      const [baseRes, techRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        supabase.from('technician_profiles').select('*').eq('id', userId).maybeSingle(),
      ]);

      if (baseRes.error || techRes.error) {
        set({ profileError: 'Could not load your profile. Check your connection and try again.' });
      } else {
        set({
          profile: (baseRes.data as UserProfile | null) ?? null,
          // No auto-created default profile any more: a missing row means
          // "has not completed trade + KYC setup yet" and routes to /kyc.
          technicianProfile: (techRes.data as TechnicianProfile | null) ?? null,
          profileError: null,
        });
      }
    } catch (error) {
      console.error('Error in fetchProfiles:', error);
      set({ profileError: 'Could not load your profile. Check your connection and try again.' });
    } finally {
      set({ profileLoadedFor: userId, isLoading: false });
    }
  },

  toggleOnlineStatus: async (forceStatus?: boolean) => {
    const { user, technicianProfile } = get();
    if (!user || !technicianProfile) return { ok: false, message: 'Profile not loaded.' };
    if (technicianProfile.verification_status !== 'approved') {
      return { ok: false, message: 'You can go online once your profile is verified.' };
    }

    const nextStatus = forceStatus ?? !technicianProfile.is_online;
    const { error } = await supabase
      .from('technician_profiles')
      .update({ is_online: nextStatus, updated_at: new Date().toISOString() })
      .eq('id', user.id);

    if (error) return { ok: false, message: 'Could not change status. Please try again.' };
    set({ technicianProfile: { ...technicianProfile, is_online: nextStatus } });
    return { ok: true };
  },

  updateLocation: async (lat: number, lng: number) => {
    const { user, technicianProfile } = get();
    if (!user || !technicianProfile) return;
    const { error } = await supabase
      .from('technician_profiles')
      .update({ current_latitude: lat, current_longitude: lng, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    if (error) return console.warn('Location update failed:', error.message);
    set({ technicianProfile: { ...technicianProfile, current_latitude: lat, current_longitude: lng } });
  },
}));
