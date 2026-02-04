import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';

/**
 * Dynamic manifest hook for PWA icons - ONLY runs on Punch Clock and PM Mobile routes.
 * This prevents the main BuilderLynk app favicon from being replaced.
 */
export const useDynamicManifest = () => {
  const { currentCompany } = useCompany();

  useEffect(() => {
    // Only run on Punch Clock and PM Mobile routes
    const pathname = window.location.pathname;
    const isMobileRoute = pathname.startsWith('/punch-clock') || 
                          pathname.startsWith('/pm-mobile') ||
                          pathname.startsWith('/employee-dashboard');
    
    if (!isMobileRoute) {
      console.log('[useDynamicManifest] Skipping - not a mobile route');
      return;
    }

    const updateManifest = async () => {
      if (!currentCompany?.id) return;

      try {
        // Get company-wide punch clock settings for icons
        const { data } = await supabase
          .from('job_punch_clock_settings')
          .select('pwa_icon_192_url, pwa_icon_512_url')
          .eq('company_id', currentCompany.id)
          .is('job_id', null)
          .order('updated_at', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const manifest = {
          name: currentCompany.display_name || currentCompany.name || 'Punch Clock',
          short_name: currentCompany.display_name || currentCompany.name || 'Punch Clock',
          description: 'Employee Time Tracking',
          start_url: '/punch-clock-login',
          display: 'standalone',
          background_color: '#ffffff',
          theme_color: '#000000',
          orientation: 'portrait',
          icons: [
            {
              src: data?.pwa_icon_192_url || '/punch-clock-icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any maskable'
            },
            {
              src: data?.pwa_icon_512_url || '/punch-clock-icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        };

        // Persist for early manifest usage before React mounts
        try {
          localStorage.setItem('pwa_app_name', manifest.name);
          if (data?.pwa_icon_192_url) localStorage.setItem('pwa_icon_192_url', data.pwa_icon_192_url);
          if (data?.pwa_icon_512_url) localStorage.setItem('pwa_icon_512_url', data.pwa_icon_512_url);
        } catch {}

        // Tell the service worker to cache icons at fixed same-origin paths
        const icon192Url = data?.pwa_icon_192_url || '/punch-clock-icon-192.png';
        const icon512Url = data?.pwa_icon_512_url || '/punch-clock-icon-512.png';
        try {
          if ('serviceWorker' in navigator) {
            const reg = await navigator.serviceWorker.ready;
            reg.active?.postMessage({ type: 'SET_ICONS', icon192: icon192Url, icon512: icon512Url });
          }
        } catch (e) {
          console.warn('[useDynamicManifest] SW not ready to receive icons', e);
        }

        // Replace existing icon links to point to same-origin cached assets
        const oldLinks = document.querySelectorAll(
          'link[rel="icon"], link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"], link[rel="shortcut icon"], link[rel="mask-icon"]'
        );
        oldLinks.forEach((el) => el.parentElement?.removeChild(el));

        const addLink = (rel: string, href: string, sizes?: string, type = 'image/png') => {
          const link = document.createElement('link');
          link.rel = rel;
          link.href = href + `?v=${Date.now()}`;
          if (sizes) link.sizes = sizes;
          if (rel === 'icon' || rel === 'shortcut icon') link.type = type;
          document.head.appendChild(link);
        };

        addLink('apple-touch-icon', '/assets/company-icon-192.png', '180x180');
        addLink('shortcut icon', '/assets/company-icon-192.png');
        addLink('icon', '/assets/company-icon-192.png', '192x192');
        addLink('icon', '/assets/company-icon-512.png', '512x512');
        const mask = document.createElement('link');
        mask.rel = 'mask-icon';
        mask.setAttribute('href', '/assets/company-icon-192.png');
        mask.setAttribute('color', '#000000');
        document.head.appendChild(mask);

        console.log('[useDynamicManifest] Requested SW to set icons and updated links');

      } catch (error) {
        console.error('Error updating manifest:', error);
      }
    };

    updateManifest();
  }, [currentCompany]);
};
