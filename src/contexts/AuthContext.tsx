import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: any | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, firstName?: string, lastName?: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const LOGIN_AUDIT_DEDUPE_MS = 5 * 60 * 1000; // 5 minutes

  const getNowMs = () => Date.now();

  const safeLocalStorage = {
    get(key: string) {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    set(key: string, value: string) {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        // ignore
      }
    },
    remove(key: string) {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // ignore
      }
    },
  };

  const logLoginAttempt = async (userId: string, success: boolean, method: string) => {
    try {
      // Client-side de-dupe to prevent accidental spam from session refreshes, remounts, multi-tabs, etc.
      const dedupeKey = `login_audit:last:${userId}:${method}:${success ? 1 : 0}`;
      const lastMs = Number(safeLocalStorage.get(dedupeKey) || 0);
      const nowMs = getNowMs();
      if (lastMs && nowMs - lastMs < LOGIN_AUDIT_DEDUPE_MS) return;
      safeLocalStorage.set(dedupeKey, String(nowMs));

      await supabase.from('user_login_audit').insert({
        user_id: userId,
        login_time: new Date().toISOString(),
        login_method: method,
        success,
        user_agent: navigator.userAgent,
      });
    } catch (err) {
      console.error('Failed to log login attempt:', err);
    }
  };

  const consumePendingOAuthLogin = () => {
    // One-time flag set right before redirecting to the OAuth provider.
    // This prevents logging on every session restore.
    const raw = safeLocalStorage.get('oauth_login_pending');
    if (!raw) return null;
    safeLocalStorage.remove('oauth_login_pending');

    try {
      const parsed = JSON.parse(raw) as { provider?: string; startedAt?: number };
      const startedAt = typeof parsed.startedAt === 'number' ? parsed.startedAt : 0;
      // Ignore stale flags (e.g., tab left open overnight)
      if (startedAt && getNowMs() - startedAt > 10 * 60 * 1000) return null;
      return parsed.provider || 'google';
    } catch {
      return 'google';
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Only synchronous state updates here
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Defer Supabase calls with setTimeout to avoid deadlock
          setTimeout(async () => {
            try {
              // Log OAuth sign-in once (only if we initiated an OAuth flow in this tab)
              if (event === 'SIGNED_IN') {
                const provider = consumePendingOAuthLogin();
                if (provider) {
                  await logLoginAttempt(session.user.id, true, provider);
                }
              }
              
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
    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        // Fetch user profile for existing session
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
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    // Log login attempt only on actual sign-in action
    if (data?.user) {
      await logLoginAttempt(data.user.id, true, 'email');
    }
    
    return { error };
  };

  const signUp = async (email: string, password: string, firstName?: string, lastName?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          first_name: firstName,
          last_name: lastName,
          full_name: `${firstName || ''} ${lastName || ''}`.trim()
        }
      }
    });
    return { error };
  };

  const signInWithGoogle = async () => {
    // Mark OAuth as pending before leaving the site so we can log it exactly once upon return.
    safeLocalStorage.set('oauth_login_pending', JSON.stringify({ provider: 'google', startedAt: getNowMs() }));

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
        skipBrowserRedirect: true
      }
    });

    if (error) return { error };

    // Open OAuth in the top window to avoid iframe "refused to connect"
    if (data?.url) {
      try {
        if (window.top && window.top !== window) {
          (window.top as Window).location.href = data.url;
        } else {
          window.location.assign(data.url);
        }
      } catch (_) {
        // Fallbacks for sandboxed iframes
        const win = window.open(data.url, '_blank');
        if (!win) {
          window.location.href = data.url;
        }
      }
    }
    return { error: null } as any;
  };

  const signOut = async () => {
    // Clear local state first to prevent race conditions with LandingPage redirect
    setUser(null);
    setSession(null);
    setProfile(null);
    await supabase.auth.signOut();
    // Navigate to landing page after logout
    navigate('/', { replace: true });
  };

  const refreshProfile = async () => {
    if (!user) return;
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
  };

  const value = {
    user,
    session,
    profile,
    loading,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}