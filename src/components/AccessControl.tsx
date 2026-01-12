import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useTenant } from '@/contexts/TenantContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

interface AccessControlProps {
  children: React.ReactNode;
}

export function AccessControl({ children }: AccessControlProps) {
  const { user, profile, loading: authLoading } = useAuth();
  const { userCompanies, loading: companyLoading } = useCompany();
  const { hasTenantAccess, hasPendingRequest, isSuperAdmin, loading: tenantLoading } = useTenant();
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(false);
  const [initialized, setInitialized] = useState(false);

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
  }, [user?.id, profile?.profile_completed, profile?.current_company_id, userCompanies.length, authLoading, companyLoading, tenantLoading, hasTenantAccess, hasPendingRequest, isSuperAdmin, location.pathname]);

  if (!initialized && (authLoading || companyLoading || tenantLoading || checking)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}