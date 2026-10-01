import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import type { UserProfile, TechnicianProfile } from '../types';

interface AuthState {
  user: any | null;
  profile: UserProfile | null;
  technicianProfile: TechnicianProfile | null;
  isLoading: boolean;
  setUser: (user: any | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  setTechnicianProfile: (techProfile: TechnicianProfile | null) => void;
  setLoading: (loading: boolean) => void;
  signOut: () => Promise<void>;
  fetchProfiles: (userId: string) => Promise<void>;
  toggleOnlineStatus: (status?: boolean) => Promise<boolean>;
  updateLocation: (lat: number, lng: number) => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      profile: null,
      technicianProfile: null,
      isLoading: true,

      setUser: (user) => set({ user }),
      setProfile: (profile) => set({ profile }),
      setTechnicianProfile: (technicianProfile) => set({ technicianProfile }),
      setLoading: (isLoading) => set({ isLoading }),

      signOut: async () => {
        const { technicianProfile } = get();
        // Automatically switch offline on logout if online
        if (technicianProfile?.is_online) {
          try {
            await supabase
              .from('technician_profiles')
              .update({ is_online: false, updated_at: new Date().toISOString() })
              .eq('id', technicianProfile.id);
          } catch (e) {
            console.error('Error toggling offline on signout:', e);
          }
        }
        await supabase.auth.signOut();
        set({ user: null, profile: null, technicianProfile: null });
      },

      fetchProfiles: async (userId: string) => {
        try {
          set({ isLoading: true });

          // 1. Fetch main base profile
          const { data: baseProfile, error: baseErr } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

          if (!baseErr && baseProfile) {
            set({ profile: baseProfile });
          }

          // 2. Fetch or initialize technician profile companion
          const { data: techProfile, error: techErr } = await supabase
            .from('technician_profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

          if (!techErr && techProfile) {
            set({ technicianProfile: techProfile });
          } else if (!techProfile) {
            // Create default companion record if missing
            const newTech = {
              id: userId,
              skills: ['Electrical'],
              experience_years: 1,
              verification_status: 'pending',
              is_online: false,
              wallet_balance: 0.00,
              rating: 5.00,
              total_completed_jobs: 0,
            };

            const { data: createdTech } = await supabase
              .from('technician_profiles')
              .insert(newTech)
              .select()
              .single();

            if (createdTech) {
              set({ technicianProfile: createdTech as TechnicianProfile });
            }
          }
        } catch (error) {
          console.error('Error in fetchProfiles:', error);
        } finally {
          set({ isLoading: false });
        }
      },

      toggleOnlineStatus: async (forceStatus?: boolean) => {
        const { user, technicianProfile } = get();
        if (!user || !technicianProfile) return false;

        const nextStatus = forceStatus !== undefined ? forceStatus : !technicianProfile.is_online;

        try {
          const { error } = await supabase
            .from('technician_profiles')
            .update({
              is_online: nextStatus,
              updated_at: new Date().toISOString()
            })
            .eq('id', user.id);

          if (!error) {
            set({
              technicianProfile: {
                ...technicianProfile,
                is_online: nextStatus
              }
            });
            return nextStatus;
          }
          return technicianProfile.is_online;
        } catch (err) {
          console.error('Failed to toggle online status:', err);
          return technicianProfile.is_online;
        }
      },

      updateLocation: async (lat: number, lng: number) => {
        const { user, technicianProfile } = get();
        if (!user || !technicianProfile) return;

        try {
          await supabase
            .from('technician_profiles')
            .update({
              current_latitude: lat,
              current_longitude: lng,
              updated_at: new Date().toISOString()
            })
            .eq('id', user.id);

          set({
            technicianProfile: {
              ...technicianProfile,
              current_latitude: lat,
              current_longitude: lng
            }
          });
        } catch (e) {
          console.warn('Location update failed:', e);
        }
      }
    }),
    {
      name: 'handyman-auth-storage',
      partialize: (state) => ({
        user: state.user,
        profile: state.profile,
        technicianProfile: state.technicianProfile
      })
    }
  )
);
