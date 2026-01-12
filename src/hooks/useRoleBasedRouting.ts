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
  const { loading: companyLoading } = useCompany();
  const activeCompanyRole = useActiveCompanyRole();
  const { hasAccess } = useMenuPermissions();
  const navigate = useNavigate();
  const location = useLocation();

  // Derive effective role from company-specific role first, fallback to profile.role
  const effectiveRole = activeCompanyRole || profile?.role;

  useEffect(() => {
    // Wait for company context to settle before routing
    if (companyLoading) return;

    // Super admins should land on the super admin dashboard from initial pages
    // BUT only if they don't also have a tenant membership (they're primarily super admins)
    const initialPaths = ['/', '/auth', '/dashboard'];
    if (isSuperAdmin) {
      // Check if this user is ONLY a super admin (no tenant membership)
      // If they have tenant membership, they should go to the regular dashboard
      // The super admin dashboard is for pure platform-level admins
      if (initialPaths.includes(location.pathname)) {
        // Note: The TenantContext already sets hasTenantAccess, so if they have a tenant,
        // they should go to normal dashboard. Only pure super admins go to super-admin page.
        // This routing is handled by AccessControl, so we just let it flow through.
        return;
      }
      return;
    }

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
