import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { useActiveCompanyRole } from '@/hooks/useActiveCompanyRole';
import { Navigate } from 'react-router-dom';
import { PremiumLoadingScreen } from '@/components/PremiumLoadingScreen';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { getAuthEntryContext } from '@/utils/authEntryContext';
import { getVendorPortalCompanyId } from '@/utils/vendorPortalSession';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  redirectTo?: string;
}

const resolvedExternalRoleCache = new Map<string, 'vendor' | 'design_professional' | null>();

export function RoleGuard({
  children,
  allowedRoles = ['admin', 'controller', 'project_manager', 'manager'],
  redirectTo = '/'
}: RoleGuardProps) {
  const { profile, loading, user } = useAuth();
  const { isSuperAdmin, tenantMember } = useTenant();
  const activeCompanyRole = useActiveCompanyRole();
  const { currentCompany, userCompanies, loading: companyLoading } = useCompany();
  const [resolvedExternalRole, setResolvedExternalRole] = React.useState<'vendor' | 'design_professional' | null>(null);
  const [resolvingExternalRole, setResolvingExternalRole] = React.useState(false);

  const normalizeRole = (role?: string | null) => {
    const r = (role ?? '').trim().toLowerCase();
    return r.length ? r : null;
  };

  const canonicalizeRole = (role?: string | null) => {
    const normalized = normalizeRole(role);
    if (!normalized) return null;
    if (normalized === 'owner') return 'admin';
    return normalized;
  };

  const profileRole = canonicalizeRole(profile?.role);
  const activeRole = canonicalizeRole(activeCompanyRole);
  const authMetadata = (user?.user_metadata || {}) as Record<string, any>;
  const currentCompanyType = normalizeRole(String(currentCompany?.company_type || ''));
  const singleCompanyAccessRole = userCompanies.length === 1 ? canonicalizeRole(userCompanies[0]?.role) : null;
  const fallbackInternalCompanyRole = React.useMemo(() => {
    const currentCompanyId = currentCompany?.id ?? profile?.current_company_id ?? null;
    const preferredAccess = currentCompanyId
      ? userCompanies.find((company) => company.company_id === currentCompanyId)
      : null;
    const preferredRole = canonicalizeRole(preferredAccess?.role);
    if (preferredRole && preferredRole !== 'vendor' && preferredRole !== 'design_professional') {
      return preferredRole;
    }

    const firstInternalRole = userCompanies
      .map((company) => canonicalizeRole(company.role))
      .find((role) => role && role !== 'vendor' && role !== 'design_professional');

    return firstInternalRole || null;
  }, [currentCompany?.id, profile?.current_company_id, userCompanies]);
  const hasVendorIdentity =
    !!(profile as any)?.vendor_id ||
    !!authMetadata.vendor_id ||
    authMetadata.is_vendor === true ||
    authMetadata.is_vendor === 'true';
  const authEntryContext = getAuthEntryContext();
  const pinnedVendorPortalCompanyId = getVendorPortalCompanyId();
  const hasInternalWorkspace = userCompanies.some((company) => {
    const companyRole = normalizeRole(company?.role);
    return companyRole && companyRole !== 'vendor' && companyRole !== 'design_professional';
  });
  const shouldPreferVendorPortal =
    authEntryContext === 'vendor' &&
    (!!pinnedVendorPortalCompanyId ||
      !hasInternalWorkspace ||
      window.location.pathname.startsWith('/vendor') ||
      window.location.pathname.startsWith('/design-professional'));

  React.useEffect(() => {
    let cancelled = false;

    const resolveExternalRole = async () => {
      if (!user?.id) {
        setResolvedExternalRole(null);
        setResolvingExternalRole(false);
        return;
      }

      if (authEntryContext === 'builder') {
        setResolvedExternalRole(null);
        setResolvingExternalRole(false);
        return;
      }

      const directRole =
        (profileRole === 'vendor' || profileRole === 'design_professional') &&
        shouldPreferVendorPortal
          ? (profileRole as 'vendor' | 'design_professional')
          : null;
      if (directRole) {
        setResolvedExternalRole(directRole);
        setResolvingExternalRole(false);
        return;
      }

      if ((currentCompanyType === 'vendor' || currentCompanyType === 'design_professional') && shouldPreferVendorPortal) {
        setResolvedExternalRole(currentCompanyType as 'vendor' | 'design_professional');
        setResolvingExternalRole(false);
        return;
      }

      if ((singleCompanyAccessRole === 'vendor' || singleCompanyAccessRole === 'design_professional') && shouldPreferVendorPortal) {
        setResolvedExternalRole(singleCompanyAccessRole as 'vendor' | 'design_professional');
        setResolvingExternalRole(false);
        return;
      }

      if (hasVendorIdentity && shouldPreferVendorPortal) {
        setResolvedExternalRole('vendor');
        setResolvingExternalRole(false);
        return;
      }

      const cachedRole = resolvedExternalRoleCache.get(user.id);
      if (cachedRole !== undefined) {
        setResolvedExternalRole(cachedRole);
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
          resolvedExternalRoleCache.set(user.id, null);
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
          resolvedExternalRoleCache.set(user.id, null);
          return;
        }

        try {
          const parsed = JSON.parse(matchedRow.notes);
          const requestedRole = normalizeRole(parsed?.requestedRole);
          const nextRole =
            requestedRole === 'vendor' || requestedRole === 'design_professional'
              ? (requestedRole as 'vendor' | 'design_professional')
              : null;
          resolvedExternalRoleCache.set(user.id, nextRole);
          setResolvedExternalRole(nextRole);
        } catch {
          setResolvedExternalRole(null);
          resolvedExternalRoleCache.set(user.id, null);
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
  }, [user?.id, profileRole, currentCompanyType, singleCompanyAccessRole, hasVendorIdentity, hasInternalWorkspace, shouldPreferVendorPortal, pinnedVendorPortalCompanyId]);

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

  if (resolvingExternalRole) {
    return <PremiumLoadingScreen text="Loading your access..." />;
  }

  // External portal users keep their portal role regardless of company access role rows.
  const effectiveRole =
    resolvedExternalRole === 'vendor' || resolvedExternalRole === 'design_professional'
      ? resolvedExternalRole
      : canonicalizeRole(
          activeRole ||
          profileRole ||
          fallbackInternalCompanyRole ||
          (tenantMember?.role === 'owner' || tenantMember?.role === 'admin'
            ? 'admin'
            : tenantMember?.role === 'member'
              ? 'employee'
              : null),
        );
  const normalizedAllowedRoles = allowedRoles.map((r) => r.trim().toLowerCase());

  // Debug logging for development only
  if (import.meta.env.DEV) {
    console.log('RoleGuard - Active company role:', activeCompanyRole);
    console.log('RoleGuard - Profile role:', profile?.role);
    console.log('RoleGuard - Effective role:', effectiveRole);
    console.log('RoleGuard - Allowed roles:', normalizedAllowedRoles);
    console.log('RoleGuard - Has access:', !!effectiveRole && normalizedAllowedRoles.includes(effectiveRole));
  }

  // If user role is not in allowed roles, redirect
  if (!effectiveRole || !normalizedAllowedRoles.includes(effectiveRole)) {
    const hasWorkspaceContext = !!currentCompany?.id || userCompanies.length > 0 || !!tenantMember;
    if (!effectiveRole && hasWorkspaceContext) {
      if (import.meta.env.DEV) {
        console.warn('RoleGuard fallback allow due to workspace context without resolved role', {
          currentCompanyId: currentCompany?.id || null,
          userCompanies: userCompanies.map((company) => ({
            company_id: company.company_id,
            role: company.role,
          })),
          profileRole,
          activeRole,
        });
      }
      return <>{children}</>;
    }
    if (import.meta.env.DEV) {
      console.warn('Access denied - Effective role:', effectiveRole, 'Allowed roles:', normalizedAllowedRoles);
    }
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
