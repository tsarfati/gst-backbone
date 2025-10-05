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

        // Update manifest link(s)
        const manifestBlob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
        const manifestURL = URL.createObjectURL(manifestBlob);

        const manifestLinks = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="manifest"]'));
        if (manifestLinks.length > 0) {
          manifestLinks.forEach((link) => (link.href = manifestURL));
        } else {
          const manifestLink = document.createElement('link');
          manifestLink.rel = 'manifest';
          manifestLink.href = manifestURL;
          document.head.appendChild(manifestLink);
        }
        console.log('[useDynamicManifest] Manifest updated', { name: manifest.name, icons: manifest.icons });

        // Update apple-touch-icon and favicons with cache-busting
        const addCacheBust = (url: string) => {
          if (!url) return url;
          const sep = url.includes('?') ? '&' : '?';
          return `${url}${sep}v=${Date.now()}`;
        };

        const icon192Raw = data?.pwa_icon_192_url || '/punch-clock-icon-192.png';
        const icon512Raw = data?.pwa_icon_512_url || '/punch-clock-icon-512.png';
        const icon192 = addCacheBust(icon192Raw);
        const icon512 = addCacheBust(icon512Raw);

        // Apple Touch Icon (iOS uses 180x180 commonly)
        let appleTouchIcon = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
        if (!appleTouchIcon) {
          appleTouchIcon = document.createElement('link');
          appleTouchIcon.rel = 'apple-touch-icon';
          document.head.appendChild(appleTouchIcon);
        }
        appleTouchIcon.href = icon192;
        appleTouchIcon.sizes = '180x180';
        // Precomposed variant for older iOS
        let applePrecomposed = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon-precomposed"]');
        if (!applePrecomposed) {
          applePrecomposed = document.createElement('link');
          applePrecomposed.rel = 'apple-touch-icon-precomposed';
          document.head.appendChild(applePrecomposed);
        }
        applePrecomposed.href = icon192;
        applePrecomposed.sizes = '180x180';

        // Generic favicon (most browsers)
        let genericFavicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]:not([sizes])');
        if (!genericFavicon) {
          genericFavicon = document.createElement('link');
          genericFavicon.rel = 'icon';
          genericFavicon.type = 'image/png';
          document.head.appendChild(genericFavicon);
        }
        genericFavicon.href = icon192;

        // Shortcut icon fallback
        let shortcutIcon = document.querySelector<HTMLLinkElement>('link[rel="shortcut icon"]');
        if (!shortcutIcon) {
          shortcutIcon = document.createElement('link');
          shortcutIcon.rel = 'shortcut icon';
          shortcutIcon.type = 'image/png';
          document.head.appendChild(shortcutIcon);
        }
        shortcutIcon.href = icon192;

        // Sized favicons if present in template
        let favicon192 = document.querySelector<HTMLLinkElement>('link[rel="icon"][sizes="192x192"]');
        if (!favicon192) {
          favicon192 = document.createElement('link');
          favicon192.rel = 'icon';
          favicon192.type = 'image/png';
          favicon192.sizes = '192x192';
          document.head.appendChild(favicon192);
        }
        favicon192.href = icon192;

        let favicon512 = document.querySelector<HTMLLinkElement>('link[rel="icon"][sizes="512x512"]');
        if (!favicon512) {
          favicon512 = document.createElement('link');
          favicon512.rel = 'icon';
          favicon512.type = 'image/png';
          favicon512.sizes = '512x512';
          document.head.appendChild(favicon512);
        }
        favicon512.href = icon512;

        // Optional: Safari pinned tab mask icon if needed
        let maskIcon = document.querySelector<HTMLLinkElement>('link[rel="mask-icon"]');
        if (!maskIcon) {
          maskIcon = document.createElement('link');
          maskIcon.rel = 'mask-icon';
          document.head.appendChild(maskIcon);
        }
        maskIcon.setAttribute('href', icon192);
        maskIcon.setAttribute('color', '#000000');

      } catch (error) {
        console.error('Error updating manifest:', error);
      }
    };

    updateManifest();
  }, [currentCompany]);
};
