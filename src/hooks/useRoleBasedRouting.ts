import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useMenuPermissions } from '@/hooks/useMenuPermissions';
import { supabase } from '@/integrations/supabase/client';

export function useRoleBasedRouting() {
  const { profile } = useAuth();
  const { hasAccess } = useMenuPermissions();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!profile?.role) return;

    const fetchDefaultPage = async () => {
      try {
        const { data, error } = await supabase
          .from('role_default_pages')
          .select('default_page')
          .eq('role', profile.role)
          .maybeSingle();

        if (error) {
          console.error('Error fetching default page:', error);
          return;
        }

        // For employees, redirect to punch clock app only
        if (profile.role === 'employee') {
          if (location.pathname === '/auth' || location.pathname === '/' || location.pathname === '/dashboard') {
            navigate('/punch-clock-app', { replace: true });
          }
          return;
        }

        // Only redirect if we're on one of the initial/generic pages
        const initialPaths = ['/', '/auth', '/dashboard'];
        
        if (initialPaths.includes(location.pathname)) {
          if (data?.default_page && hasAccess(data.default_page.replace('/', ''))) {
            navigate(data.default_page, { replace: true });
          } else {
            // Find a fallback page the user has access to
            const fallbackPages = [
              { path: '/time-tracking', menu: 'time-tracking' },
              { path: '/punch-clock-dashboard', menu: 'punch-clock-dashboard' },
              { path: '/jobs', menu: 'jobs' },
              { path: '/timesheets', menu: 'timesheets' }
            ];
            
            const accessiblePage = fallbackPages.find(page => hasAccess(page.menu));
            
            if (accessiblePage) {
              navigate(accessiblePage.path, { replace: true });
            } else {
              // If no specific access, go to a safe default
              navigate('/profile-settings', { replace: true });
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
  }, [profile?.role, hasAccess, navigate, location.pathname]);
}