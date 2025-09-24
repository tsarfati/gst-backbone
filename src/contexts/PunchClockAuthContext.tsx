import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface PunchClockUser {
  user_id: string;
  name: string;
  role: string;
  pin_authenticated?: boolean;
  pin?: string;
}

interface PunchClockAuthContextType {
  user: User | PunchClockUser | null;
  session: Session | null;
  profile: any | null;
  loading: boolean;
  isPinAuthenticated: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const PunchClockAuthContext = createContext<PunchClockAuthContextType | undefined>(undefined);

export function PunchClockAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | PunchClockUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPinAuthenticated, setIsPinAuthenticated] = useState(false);

  useEffect(() => {
    // Check for PIN authentication first
    const punchClockUserData = localStorage.getItem('punch_clock_user');
    if (punchClockUserData) {
      try {
        const punchUser = JSON.parse(punchClockUserData);
        setUser(punchUser);
        setIsPinAuthenticated(true);
        
        // Fetch profile data for PIN user
        fetchPinUserProfile(punchUser.user_id);
        setLoading(false);
        return;
      } catch (error) {
        console.error('Error parsing punch clock user data:', error);
        localStorage.removeItem('punch_clock_user');
      }
    }

    // Fall back to regular Supabase authentication
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setIsPinAuthenticated(false);
        
        if (session?.user) {
          setTimeout(async () => {
            try {
              const { data: profileData } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', session.user.id)
                .single();
              setProfile(profileData);
            } catch (error) {
              console.error('Error fetching profile:', error);
              setProfile(null);
            }
          }, 0);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!punchClockUserData) {
        setSession(session);
        setUser(session?.user ?? null);
        setIsPinAuthenticated(false);
        
        if (session?.user) {
          setTimeout(async () => {
            try {
              const { data: profileData } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', session.user.id)
                .single();
              setProfile(profileData);
            } catch (error) {
              console.error('Error fetching profile:', error);
              setProfile(null);
            }
          }, 0);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchPinUserProfile = async (userId: string) => {
    try {
      // For PIN authentication, we need to use the service role or a different approach
      // since we don't have a proper session. For now, we'll create a minimal profile
      // from the stored data and fetch what we can without authentication
      const punchClockUserData = localStorage.getItem('punch_clock_user');
      if (punchClockUserData) {
        const punchUser = JSON.parse(punchClockUserData);
        setProfile({
          user_id: punchUser.user_id,
          display_name: punchUser.name,
          role: punchUser.role,
          first_name: punchUser.name.split(' ')[0],
          last_name: punchUser.name.split(' ').slice(1).join(' ')
        });
      }
    } catch (error) {
      console.error('Error fetching PIN user profile:', error);
    }
  };

  const signOut = async () => {
    if (isPinAuthenticated) {
      // Clear PIN authentication
      localStorage.removeItem('punch_clock_user');
      setUser(null);
      setProfile(null);
      setIsPinAuthenticated(false);
      window.location.href = '/punch-clock-login';
    } else {
      // Regular sign out
      await supabase.auth.signOut();
      window.location.href = '/auth';
    }
  };

  const refreshProfile = async () => {
    if (isPinAuthenticated) {
      const userId = (user as PunchClockUser)?.user_id;
      if (userId) {
        await fetchPinUserProfile(userId);
      }
    } else if (user && 'id' in user) {
      try {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();
        setProfile(profileData);
      } catch (error) {
        console.error('Error refreshing profile:', error);
      }
    }
  };

  const value = {
    user,
    session,
    profile,
    loading,
    isPinAuthenticated,
    signOut,
    refreshProfile,
  };

  return <PunchClockAuthContext.Provider value={value}>{children}</PunchClockAuthContext.Provider>;
}

export function usePunchClockAuth() {
  const context = useContext(PunchClockAuthContext);
  if (context === undefined) {
    throw new Error('usePunchClockAuth must be used within a PunchClockAuthProvider');
  }
  return context;
}