import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { useActiveCompanyRole } from '@/hooks/useActiveCompanyRole';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

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
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
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
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Use company-specific role if available, otherwise fall back to profile role
  const effectiveRole = activeCompanyRole || profile.role;

  // Debug logging for development only
  if (import.meta.env.DEV) {
    console.log('RoleGuard - Active company role:', activeCompanyRole);
    console.log('RoleGuard - Profile role:', profile.role);
    console.log('RoleGuard - Effective role:', effectiveRole);
    console.log('RoleGuard - Allowed roles:', allowedRoles);
    console.log('RoleGuard - Has access:', allowedRoles.includes(effectiveRole));
  }

  // If user role is not in allowed roles, redirect
  if (!effectiveRole || !allowedRoles.includes(effectiveRole)) {
    if (import.meta.env.DEV) {
      console.warn('Access denied - Effective role:', effectiveRole, 'Allowed roles:', allowedRoles);
    }
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
