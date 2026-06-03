import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { getPublicAuthOrigin } from '@/utils/publicAuthOrigin';
import { flushPendingNonDirectMessageReadWrites } from '@/utils/nonDirectMessageRead';
import { clearAuthEntryContext } from '@/utils/authEntryContext';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: any | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, firstName?: string, lastName?: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signOut: (redirectTo?: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  setProfile: React.Dispatch<React.SetStateAction<any | null>>;
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

  const LOGOUT_IN_PROGRESS_KEY = 'builderlynk_logout_in_progress';
  const buildFallbackProfile = (authUser: User) => {
    const metadata = (authUser.user_metadata || {}) as Record<string, any>;
    return {
      user_id: authUser.id,
      email: authUser.email || null,
      first_name: metadata.first_name || metadata.firstName || null,
      last_name: metadata.last_name || metadata.lastName || null,
      display_name:
        metadata.display_name ||
        metadata.full_name ||
        [metadata.first_name || metadata.firstName, metadata.last_name || metadata.lastName]
          .filter(Boolean)
          .join(' ')
          .trim() ||
        authUser.email ||
        null,
      phone: metadata.phone || null,
      role: metadata.role || null,
      status: 'active',
      profile_completed: Boolean(metadata.profile_completed),
      current_company_id: null,
      avatar_url: metadata.avatar_url || null,
    };
  };

  const logLoginAttempt = async (userId: string, success: boolean, method: string) => {
    try {
      // Client-side de-dupe to prevent accidental spam from session refreshes, remounts, multi-tabs, etc.
      const dedupeKey = `login_audit:last:${userId}:${method}:${success ? 1 : 0}`;
      const lastMs = Number(safeLocalStorage.get(dedupeKey) || 0);
      const nowMs = getNowMs();
      if (lastMs && nowMs - lastMs < LOGIN_AUDIT_DEDUPE_MS) return;
      safeLocalStorage.set(dedupeKey, String(nowMs));

      const { error: rpcError } = await supabase.rpc('log_user_login_event' as any, {
        p_app_source: 'builderlynk_web',
        p_login_method: method,
        p_success: success,
        p_user_agent: navigator.userAgent,
      });

      // Backward-compatible fallback if RPC has not been migrated yet.
      if (rpcError) {
        await supabase.from('user_login_audit').insert({
          user_id: userId,
          login_time: new Date().toISOString(),
          login_method: method,
          success,
          user_agent: navigator.userAgent,
          app_source: 'builderlynk_web',
        });
      }
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

  const resolveLoginMethodFromSession = (session: Session | null): string => {
    const provider = (session?.user as any)?.app_metadata?.provider;
    if (typeof provider === 'string' && provider.trim().length > 0) {
      return provider.toLowerCase();
    }
    return 'email';
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          safeLocalStorage.remove(LOGOUT_IN_PROGRESS_KEY);
        }
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
                const method = provider || resolveLoginMethodFromSession(session);
                await logLoginAttempt(session.user.id, true, method);
              }
              
              const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', session.user.id)
                .maybeSingle();
              if (profileError) {
                console.error('Error fetching profile:', profileError);
                setProfile(buildFallbackProfile(session.user));
                return;
              }
              setProfile(profileData || buildFallbackProfile(session.user));
            } catch (error) {
              console.error('Error fetching profile:', error);
              setProfile(buildFallbackProfile(session.user));
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
      if (session?.user) {
        safeLocalStorage.remove(LOGOUT_IN_PROGRESS_KEY);
      }
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        // Fetch user profile for existing session
        setTimeout(async () => {
          try {
            const { data: profileData, error: profileError } = await supabase
              .from('profiles')
              .select('*')
              .eq('user_id', session.user.id)
              .maybeSingle();
            if (profileError) {
              console.error('Error fetching profile:', profileError);
              setProfile(buildFallbackProfile(session.user));
              return;
            }
            setProfile(profileData || buildFallbackProfile(session.user));
          } catch (error) {
            console.error('Error fetching profile:', error);
            setProfile(buildFallbackProfile(session.user));
          }
        }, 0);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!loading) return;

    const timeoutId = window.setTimeout(async () => {
      try {
        const { data: { session: fallbackSession } } = await supabase.auth.getSession();
        if (fallbackSession?.user) {
          setSession(fallbackSession);
          setUser(fallbackSession.user);
          setProfile((prev) => prev || buildFallbackProfile(fallbackSession.user));
        } else {
          setSession(null);
          setUser(null);
          setProfile(null);
        }
      } catch (error) {
        console.error('Auth watchdog failed to recover session state:', error);
        setSession(null);
        setUser(null);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    }, 4000);

    return () => window.clearTimeout(timeoutId);
  }, [loading]);

  const signIn = async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = password;
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: normalizedPassword,
    });

    if (data?.session) {
      setSession(data.session);
      setUser(data.user);
      setProfile((prev) => prev || buildFallbackProfile(data.user));
      setLoading(false);
    }
    
    // Log login attempt only on actual sign-in action
    if (data?.user) {
      await logLoginAttempt(data.user.id, true, 'email');
    }
    
    return { error };
  };

  const signUp = async (email: string, password: string, firstName?: string, lastName?: string) => {
    const currentUrl = new URL(window.location.href);
    const inviteToken = currentUrl.searchParams.get('invite');
    const authOrigin = getPublicAuthOrigin();
    const redirectUrl = inviteToken
      ? `${authOrigin}/auth?invite=${encodeURIComponent(inviteToken)}`
      : `${authOrigin}/`;
    
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
        redirectTo: `${window.location.origin}/dashboard`,
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

  const signOut = async (redirectTo?: string) => {
    // Clear local state first to prevent race conditions with LandingPage redirect
    await flushPendingNonDirectMessageReadWrites();
    safeLocalStorage.set(LOGOUT_IN_PROGRESS_KEY, '1');
    clearAuthEntryContext();
    setUser(null);
    setSession(null);
    setProfile(null);
    await supabase.auth.signOut();
    const safeRedirectTo = typeof redirectTo === 'string' && redirectTo.trim().length > 0
      ? redirectTo
      : '/';
    navigate(safeRedirectTo, { replace: true });
  };

  const refreshProfile = async () => {
    if (!user) return;
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (profileError) {
        console.error('Error refreshing profile:', profileError);
        setProfile(buildFallbackProfile(user));
        return;
      }
      setProfile(profileData || buildFallbackProfile(user));
    } catch (error) {
      console.error('Error refreshing profile:', error);
      setProfile(buildFallbackProfile(user));
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
    setProfile,
  };

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as any).__builderAuthDebug = {
      loading,
      userId: user?.id || null,
      userEmail: user?.email || null,
      hasSession: !!session,
      profileUserId: profile?.user_id || null,
      profileRole: profile?.role || null,
      profileCompleted: profile?.profile_completed ?? null,
      currentCompanyId: profile?.current_company_id || null,
    };
  }, [loading, user?.id, user?.email, session, profile?.user_id, profile?.role, profile?.profile_completed, profile?.current_company_id]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
