import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useMenuPermissions } from '@/hooks/useMenuPermissions';
import { useActiveCompanyRole } from '@/hooks/useActiveCompanyRole';
import { supabase } from '@/integrations/supabase/client';

export function useRoleBasedRouting() {
  const { profile } = useAuth();
  const { isSuperAdmin } = useTenant();
  const { loading: companyLoading, userCompanies, currentCompany } = useCompany();
  const activeCompanyRole = useActiveCompanyRole();
  const { hasAccess } = useMenuPermissions();
  const navigate = useNavigate();
  const location = useLocation();

  // Prefer active-company role, then profile role, then any company role we can infer.
  const effectiveRole =
    activeCompanyRole ||
    profile?.role ||
    (userCompanies.length > 0 ? userCompanies[0].role : null);

  // Company access signal (used to prevent super-admin default routing when the user also has legacy/company access)
  const hasCompanyAccess =
    !!currentCompany || userCompanies.length > 0 || !!profile?.current_company_id;

  useEffect(() => {
    // Wait for company context to settle before routing
    if (companyLoading) return;

    // Super admins should land on the super admin dashboard from initial pages
    // BUT only if they don't also have any company access (legacy/company member).
    const initialPaths = ['/', '/auth', '/dashboard'];

    if (isSuperAdmin && !hasCompanyAccess) {
      // Pure super admin without company membership - go to super admin dashboard
      if (initialPaths.includes(location.pathname)) {
        navigate('/super-admin', { replace: true });
        return;
      }
      return;
    }

    // If super admin but also has company access, treat as regular user
    // and continue with normal routing below

    if (!effectiveRole) return;

    const fetchDefaultPage = async () => {
      try {
        const { data, error } = await supabase
          .from('role_default_pages')
          .select('default_page')
          .eq('role', effectiveRole)
          .maybeSingle();

        if (error) {
          console.error('Error fetching default page:', error);
          return;
        }

        // For employees, redirect to punch clock app only
        if (effectiveRole === 'employee') {
          if (location.pathname === '/auth' || location.pathname === '/') {
            navigate('/punch-clock-app', { replace: true });
          }
          return;
        }

        // For vendors, redirect to vendor dashboard
        if (effectiveRole === 'vendor') {
          if (location.pathname === '/auth' || location.pathname === '/') {
            navigate('/vendor/dashboard', { replace: true });
          }
          return;
        }

        // Only redirect if we're on one of the initial/generic pages
        if (initialPaths.includes(location.pathname)) {
          if (data?.default_page && hasAccess(data.default_page.replace('/', ''))) {
            const target = data.default_page === '/dashboard' ? '/' : data.default_page;
            navigate(target, { replace: true });
          } else {
            // Find a fallback page the user has access to
            const fallbackPages = [
              { path: '/time-tracking', menu: 'time-tracking' },
              { path: '/punch-clock/dashboard', menu: 'punch-clock-dashboard' },
              { path: '/jobs', menu: 'jobs' },
              { path: '/time-sheets', menu: 'timesheets' }
            ];

            const accessiblePage = fallbackPages.find(page => hasAccess(page.menu));

            if (accessiblePage) {
              navigate(accessiblePage.path, { replace: true });
            } else {
              // If no specific access, go to root dashboard
              navigate('/', { replace: true });
            }
          }
        }
      } catch (error) {
        console.error('Error in useRoleBasedRouting:', error);
        // Safe fallback
        navigate('/profile-settings', { replace: true });
      }
    };

    fetchDefaultPage();
  }, [effectiveRole, isSuperAdmin, companyLoading, hasAccess, navigate, location.pathname]);
}
