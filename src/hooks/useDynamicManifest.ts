import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';

export const useDynamicManifest = () => {
  const { currentCompany } = useCompany();

  useEffect(() => {
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

        // Update manifest link
        const manifestBlob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
        const manifestURL = URL.createObjectURL(manifestBlob);
        
        let manifestLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
        if (manifestLink) {
          manifestLink.href = manifestURL;
        } else {
          manifestLink = document.createElement('link');
          manifestLink.rel = 'manifest';
          manifestLink.href = manifestURL;
          document.head.appendChild(manifestLink);
        }

        // Update apple-touch-icon
        let appleTouchIcon = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
        const iconUrl = data?.pwa_icon_192_url || '/punch-clock-icon-192.png';
        
        if (appleTouchIcon) {
          appleTouchIcon.href = iconUrl;
        } else {
          appleTouchIcon = document.createElement('link');
          appleTouchIcon.rel = 'apple-touch-icon';
          appleTouchIcon.href = iconUrl;
          document.head.appendChild(appleTouchIcon);
        }

        // Update favicon
        let favicon192 = document.querySelector<HTMLLinkElement>('link[rel="icon"][sizes="192x192"]');
        if (favicon192) {
          favicon192.href = iconUrl;
        }

        let favicon512 = document.querySelector<HTMLLinkElement>('link[rel="icon"][sizes="512x512"]');
        if (favicon512 && data?.pwa_icon_512_url) {
          favicon512.href = data.pwa_icon_512_url;
        }

      } catch (error) {
        console.error('Error updating manifest:', error);
      }
    };

    updateManifest();
  }, [currentCompany]);
};
