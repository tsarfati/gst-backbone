import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export function useRoleBasedRouting() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const redirectToDefaultPage = async () => {
      // Only redirect if user is on root path, auth page, or dashboard
      const shouldRedirect = location.pathname === '/' || 
                           location.pathname === '/auth' ||
                           location.pathname === '' ||
                           location.pathname === '/dashboard';

      if (!shouldRedirect || !profile?.role) return;

      try {
        const { data, error } = await supabase
          .from('role_default_pages')
          .select('default_page')
          .eq('role', profile.role)
          .maybeSingle();

        if (error) {
          console.error('Error fetching role default page:', error);
          return;
        }

        const defaultPage = data?.default_page;
        if (defaultPage && defaultPage !== location.pathname) {
          console.log(`Redirecting ${profile.role} user to ${defaultPage}`);
          navigate(defaultPage, { replace: true });
        }
      } catch (error) {
        console.error('Error in role-based routing:', error);
      }
    };

    // Add a small delay to ensure profile is fully loaded
    if (profile?.role) {
      setTimeout(redirectToDefaultPage, 100);
    }
  }, [profile?.role, location.pathname, navigate]);
}