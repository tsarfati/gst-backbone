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

        // Remove existing icons to avoid browser choosing stale ones
        const oldLinks = document.querySelectorAll(
          'link[rel="icon"], link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"], link[rel="shortcut icon"], link[rel="mask-icon"]'
        );
        oldLinks.forEach((el) => el.parentElement?.removeChild(el));

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
        const appleTouchIcon = document.createElement('link');
        appleTouchIcon.rel = 'apple-touch-icon';
        appleTouchIcon.href = icon192;
        appleTouchIcon.sizes = '180x180';
        document.head.appendChild(appleTouchIcon);

        // Precomposed variant for older iOS
        const applePrecomposed = document.createElement('link');
        applePrecomposed.rel = 'apple-touch-icon-precomposed';
        applePrecomposed.href = icon192;
        applePrecomposed.sizes = '180x180';
        document.head.appendChild(applePrecomposed);

        // Generic favicon (most browsers) - PNG no sizes so browsers pick best
        const genericFavicon = document.createElement('link');
        genericFavicon.rel = 'icon';
        genericFavicon.type = 'image/png';
        genericFavicon.href = icon192;
        document.head.appendChild(genericFavicon);

        // Shortcut icon fallback for legacy
        const shortcutIcon = document.createElement('link');
        shortcutIcon.rel = 'shortcut icon';
        shortcutIcon.type = 'image/png';
        shortcutIcon.href = icon192;
        document.head.appendChild(shortcutIcon);

        // Sized favicons
        const fav192 = document.createElement('link');
        fav192.rel = 'icon';
        fav192.type = 'image/png';
        fav192.sizes = '192x192';
        fav192.href = icon192;
        document.head.appendChild(fav192);

        const fav512 = document.createElement('link');
        fav512.rel = 'icon';
        fav512.type = 'image/png';
        fav512.sizes = '512x512';
        fav512.href = icon512;
        document.head.appendChild(fav512);

        // Pinned tab (desktop Safari)
        const maskIcon = document.createElement('link');
        maskIcon.rel = 'mask-icon';
        maskIcon.setAttribute('href', icon192);
        maskIcon.setAttribute('color', '#000000');
        document.head.appendChild(maskIcon);

        console.log('[useDynamicManifest] Icons updated', { icon192, icon512 });

      } catch (error) {
        console.error('Error updating manifest:', error);
      }
    };

    updateManifest();
  }, [currentCompany]);
};
