import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { useActiveCompanyRole } from '@/hooks/useActiveCompanyRole';
import { Navigate } from 'react-router-dom';
import { PremiumLoadingScreen } from '@/components/PremiumLoadingScreen';

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

  // Show loading while authentication is in progress
  if (loading) {
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

  // Use company-specific role if available, otherwise fall back to profile role
  const normalizeRole = (role?: string | null) => {
    const r = (role ?? '').trim().toLowerCase();
    return r.length ? r : null;
  };

  const effectiveRole = normalizeRole(activeCompanyRole || profile.role);
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
