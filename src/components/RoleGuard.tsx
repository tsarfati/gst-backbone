import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { useActiveCompanyRole } from '@/hooks/useActiveCompanyRole';
import { Navigate } from 'react-router-dom';
import { PremiumLoadingScreen } from '@/components/PremiumLoadingScreen';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  redirectTo?: string;
}

export function RoleGuard({
  children,
  allowedRoles = ['admin', 'controller', 'project_manager', 'manager'],
  redirectTo = '/'
}: RoleGuardProps) {
  const { profile, loading, user } = useAuth();
  const { isSuperAdmin } = useTenant();
  const activeCompanyRole = useActiveCompanyRole();
  const { currentCompany, userCompanies, loading: companyLoading } = useCompany();
  const [resolvedExternalRole, setResolvedExternalRole] = React.useState<'vendor' | 'design_professional' | null>(null);
  const [resolvingExternalRole, setResolvingExternalRole] = React.useState(false);

  const normalizeRole = (role?: string | null) => {
    const r = (role ?? '').trim().toLowerCase();
    return r.length ? r : null;
  };

  const profileRole = normalizeRole(profile?.role);
  const activeRole = normalizeRole(activeCompanyRole);
  const authMetadata = (user?.user_metadata || {}) as Record<string, any>;
  const currentCompanyType = normalizeRole(String(currentCompany?.company_type || ''));
  const singleCompanyAccessRole = userCompanies.length === 1 ? normalizeRole(userCompanies[0]?.role) : null;
  const hasVendorIdentity =
    !!(profile as any)?.vendor_id ||
    !!authMetadata.vendor_id ||
    authMetadata.is_vendor === true ||
    authMetadata.is_vendor === 'true';

  React.useEffect(() => {
    let cancelled = false;

    const resolveExternalRole = async () => {
      if (!user?.id) {
        setResolvedExternalRole(null);
        setResolvingExternalRole(false);
        return;
      }

      const directRole =
        profileRole === 'vendor' || profileRole === 'design_professional'
          ? (profileRole as 'vendor' | 'design_professional')
          : null;
      if (directRole) {
        setResolvedExternalRole(directRole);
        setResolvingExternalRole(false);
        return;
      }

      if (currentCompanyType === 'vendor' || currentCompanyType === 'design_professional') {
        setResolvedExternalRole(currentCompanyType as 'vendor' | 'design_professional');
        setResolvingExternalRole(false);
        return;
      }

      if (singleCompanyAccessRole === 'vendor' || singleCompanyAccessRole === 'design_professional') {
        setResolvedExternalRole(singleCompanyAccessRole as 'vendor' | 'design_professional');
        setResolvingExternalRole(false);
        return;
      }

      if (hasVendorIdentity) {
        setResolvedExternalRole('vendor');
        setResolvingExternalRole(false);
        return;
      }

      setResolvingExternalRole(true);
      try {
        const { data, error } = await supabase
          .from('company_access_requests')
          .select('notes, requested_at')
          .eq('user_id', user.id)
          .order('requested_at', { ascending: false })
          .limit(10);

        if (cancelled) return;
        if (error) {
          console.warn('RoleGuard external role lookup failed:', error);
          setResolvedExternalRole(null);
          return;
        }

        const matchedRow = (data || []).find((row: any) => {
          try {
            const parsed = row?.notes ? JSON.parse(row.notes) : null;
            return String(parsed?.requestType || '').toLowerCase() === 'external_access_signup';
          } catch {
            return false;
          }
        }) as { notes?: string | null } | undefined;

        if (!matchedRow?.notes) {
          setResolvedExternalRole(null);
          return;
        }

        try {
          const parsed = JSON.parse(matchedRow.notes);
          const requestedRole = normalizeRole(parsed?.requestedRole);
          setResolvedExternalRole(
            requestedRole === 'vendor' || requestedRole === 'design_professional'
              ? (requestedRole as 'vendor' | 'design_professional')
              : null,
          );
        } catch {
          setResolvedExternalRole(null);
        }
      } finally {
        if (!cancelled) {
          setResolvingExternalRole(false);
        }
      }
    };

    resolveExternalRole();

    return () => {
      cancelled = true;
    };
  }, [user?.id, profileRole, currentCompanyType, singleCompanyAccessRole, hasVendorIdentity]);

  // Show loading while authentication is in progress
  if (loading || companyLoading) {
    return <PremiumLoadingScreen text="Loading your access..." />;
  }

  // If no user is authenticated, redirect to auth
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Super admins can access everything (platform-level access)
  if (isSuperAdmin) {
    return <>{children}</>;
  }

  // If profile is not loaded yet, show loading
  if (!profile) {
    return <PremiumLoadingScreen text="Loading your profile..." />;
  }

  if (resolvingExternalRole) {
    return <PremiumLoadingScreen text="Loading your access..." />;
  }

  // External portal users keep their portal role regardless of company access role rows.
  const effectiveRole =
    resolvedExternalRole === 'vendor' || resolvedExternalRole === 'design_professional'
      ? resolvedExternalRole
      : normalizeRole(activeRole || profileRole);
  const normalizedAllowedRoles = allowedRoles.map((r) => r.trim().toLowerCase());

  // Debug logging for development only
  if (import.meta.env.DEV) {
    console.log('RoleGuard - Active company role:', activeCompanyRole);
    console.log('RoleGuard - Profile role:', profile.role);
    console.log('RoleGuard - Effective role:', effectiveRole);
    console.log('RoleGuard - Allowed roles:', normalizedAllowedRoles);
    console.log('RoleGuard - Has access:', !!effectiveRole && normalizedAllowedRoles.includes(effectiveRole));
  }

  // If user role is not in allowed roles, redirect
  if (!effectiveRole || !normalizedAllowedRoles.includes(effectiveRole)) {
    if (import.meta.env.DEV) {
      console.warn('Access denied - Effective role:', effectiveRole, 'Allowed roles:', normalizedAllowedRoles);
    }
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
