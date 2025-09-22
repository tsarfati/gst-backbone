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
      if (!profile?.role) return;

      // Only redirect if user is on root path or auth page after login
      const shouldRedirect = location.pathname === '/' || 
                           location.pathname === '/auth' ||
                           location.pathname === '';

      if (!shouldRedirect) return;

      try {
        const { data, error } = await supabase
          .from('role_default_pages')
          .select('default_page')
          .eq('role', profile.role)
          .maybeSingle();

        if (error) {
          console.error('Error fetching role default page:', error);
          // Fallback to dashboard
          navigate('/dashboard', { replace: true });
          return;
        }

        const defaultPage = data?.default_page || '/dashboard';
        navigate(defaultPage, { replace: true });
      } catch (error) {
        console.error('Error in role-based routing:', error);
        navigate('/dashboard', { replace: true });
      }
    };

    redirectToDefaultPage();
  }, [profile?.role, location.pathname, navigate]);
}