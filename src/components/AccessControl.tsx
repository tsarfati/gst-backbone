import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useTenant } from '@/contexts/TenantContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AccountStatusScreen } from '@/components/AccountStatusScreen';
import { supabase } from '@/integrations/supabase/client';

interface AccessControlProps {
  children: React.ReactNode;
}

const parseInviteFunctionError = async (error: any) => {
  let payload: any = null;
  try {
    if (typeof error?.context?.json === 'function') {
      payload = await error.context.json();
    }
  } catch {
    payload = null;
  }
  return {
    message: payload?.error || payload?.message || error?.message || 'Unknown invite error',
    code: payload?.code || null,
    requestId: payload?.requestId || null,
    debug: payload?.debug || null,
    raw: payload,
  };
};

export function AccessControl({ children }: AccessControlProps) {
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const { userCompanies, loading: companyLoading } = useCompany();
  const { hasTenantAccess, hasPendingRequest, isSuperAdmin, loading: tenantLoading } = useTenant();
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [autoAcceptingInvite, setAutoAcceptingInvite] = useState(false);
  const [autoAcceptRetryTick, setAutoAcceptRetryTick] = useState(0);
  const lastAutoAcceptAttemptAtRef = useRef<number>(0);
  const autoAcceptAttemptCountRef = useRef(0);
  const isInviteAuthRoute = location.pathname === '/auth' && new URLSearchParams(location.search).has('invite');

  useEffect(() => {
    const maxAutoAcceptAttempts = 8;
    if (!user?.id || !profile || profile.status !== 'pending' || isInviteAuthRoute) {
      return;
    }
    if (autoAcceptAttemptCountRef.current >= maxAutoAcceptAttempts) {
      return;
    }

    const now = Date.now();
    // Avoid hot-loop retries while still allowing recovery from transient 401/session timing failures.
    if (now - lastAutoAcceptAttemptAtRef.current < 4000) return;
    lastAutoAcceptAttemptAtRef.current = now;

    let cancelled = false;
    let retryTimer: number | null = null;

    const tryAutoAcceptInvite = async () => {
      autoAcceptAttemptCountRef.current += 1;
      setAutoAcceptingInvite(true);
      try {
        const invokeWithRetry = async () => {
          let lastError: any = null;
          for (let attempt = 0; attempt < 4; attempt++) {
            const { data: sessionData } = await supabase.auth.getSession();
            const accessToken = sessionData.session?.access_token;

            const result = await supabase.functions.invoke('accept-user-invite', {
              body: {},
              headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
            });

            if (!result.error) return result;

            lastError = result.error;
            const parsed = await parseInviteFunctionError(result.error);
            const msg = String(parsed.message || '');
            const unauthorized = msg.includes('401') || msg.toLowerCase().includes('unauthorized');
            if (!unauthorized || attempt === 3) return result;

            await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
          }

          return { data: null, error: lastError };
        };

        const invokePromise = invokeWithRetry();
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Invite acceptance timed out')), 10000)
        );
        const { error, data } = await Promise.race([invokePromise, timeoutPromise]);

        if (cancelled) return;
        if (error) {
          const parsed = await parseInviteFunctionError(error);
          console.warn('Auto invite acceptance skipped/failed', parsed);
          if (autoAcceptAttemptCountRef.current < maxAutoAcceptAttempts) {
            retryTimer = window.setTimeout(() => {
              setAutoAcceptRetryTick((n) => n + 1);
            }, 3500);
          }
          return;
        }

        if (data?.success || data?.alreadyAccepted) {
          console.info('Auto invite acceptance succeeded', {
            requestId: data?.requestId || null,
            debug: data?.debug || null,
          });
          await refreshProfile();
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('Auto invite acceptance error:', err);
        }
      } finally {
        if (!cancelled) setAutoAcceptingInvite(false);
      }
    };

    tryAutoAcceptInvite();

    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, [user?.id, profile?.status, isInviteAuthRoute, refreshProfile, autoAcceptRetryTick]);

  useEffect(() => {
    if (authLoading || companyLoading || tenantLoading) {
      return;
    }

    // Allow public access to punch clock routes
    const publicPaths = ['/punch-clock', '/punch-clock-login', '/punch-clock-app'];
    if (publicPaths.some(p => location.pathname.startsWith(p))) {
      setChecking(false);
      return;
    }

    // If no user, redirect to auth
    if (!user) {
      if (location.pathname !== '/auth') navigate('/auth', { replace: true });
      return;
    }

    // Allow invited users to reach /auth?invite=... even if their profile is still pending,
    // so the auth page can run the invite acceptance flow and activate their account.
    if (isInviteAuthRoute) {
      setChecking(false);
      if (!initialized) setInitialized(true);
      return;
    }

    // Handle profile completion route
    if (location.pathname === '/profile-completion') {
      if (profile?.profile_completed) {
        navigate('/', { replace: true });
        return;
      }
      setChecking(false);
      return;
    }

    // If profile is known and not completed, redirect to profile completion
    if (profile && profile.profile_completed === false) {
      navigate('/profile-completion', { replace: true });
      return;
    }

    // Check account status - block pending and suspended users
    if (profile && (profile.status === 'pending' || profile.status === 'suspended')) {
      setChecking(false);
      if (!initialized) setInitialized(true);
      return;
    }

    // Super admins who also have tenant access should continue through normal flow
    // Pure super admins (no tenant access) bypass tenant checks
    if (isSuperAdmin && !hasTenantAccess) {
      setChecking(false);
      if (!initialized) setInitialized(true);
      return;
    }
    
    // Super admin WITH tenant access - continue normal flow below

    // Handle tenant request route
    if (location.pathname === '/tenant-request') {
      if (hasTenantAccess) {
        navigate('/', { replace: true });
        return;
      }
      setChecking(false);
      return;
    }

    // If no tenant access and no pending request, redirect to tenant request
    if (!hasTenantAccess && !hasPendingRequest && profile) {
      if (location.pathname !== '/tenant-request') {
        navigate('/tenant-request', { replace: true });
      }
      return;
    }

    // If has pending request but no tenant access, stay on tenant-request
    if (!hasTenantAccess && hasPendingRequest && location.pathname !== '/tenant-request') {
      navigate('/tenant-request', { replace: true });
      return;
    }

    // Determine if user has approved company access
    const isPrivileged = profile?.role === 'admin' || profile?.role === 'controller';
    const hasApprovedAccess = isPrivileged || userCompanies.length > 0 || !!profile?.current_company_id;

    // If on company-request and user already has access, send to home
    if (location.pathname === '/company-request') {
      if (hasApprovedAccess) {
        navigate('/', { replace: true });
        return;
      }
      setChecking(false);
      return;
    }

    // If user lacks company access, force them to company-request
    if (!hasApprovedAccess && profile && hasTenantAccess) {
      if (location.pathname !== '/company-request') navigate('/company-request', { replace: true });
      return;
    }

    setChecking(false);
    if (!initialized) {
      setInitialized(true);
    }
  }, [user?.id, profile?.profile_completed, profile?.current_company_id, profile?.status, userCompanies.length, authLoading, companyLoading, tenantLoading, hasTenantAccess, hasPendingRequest, isSuperAdmin, location.pathname, location.search, isInviteAuthRoute]);

  // Show account status splash screens
  if (autoAcceptingInvite) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isInviteAuthRoute && profile && (profile.status === 'pending' || profile.status === 'suspended')) {
    return <AccountStatusScreen status={profile.status as 'pending' | 'suspended'} />;
  }

  if (!initialized && (authLoading || companyLoading || tenantLoading || checking)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
