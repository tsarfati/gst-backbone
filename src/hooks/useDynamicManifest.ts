import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useDynamicManifest() {
  useEffect(() => {
    const updateManifest = async () => {
      try {
        // Resolve company context (fallback to first active company)
        const { data: company } = await supabase
          .from('companies')
          .select('id')
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();

        // Load PWA settings (company-wide: job_id is null)
        const { data } = await supabase
          .from('job_punch_clock_settings')
          .select('pwa_icon_192_url, pwa_icon_512_url')
          .eq('company_id', company?.id)
          .is('job_id', null)
          .maybeSingle();

        if (data && (data.pwa_icon_192_url || data.pwa_icon_512_url)) {
          const manifest = {
            name: 'Punch Clock',
            short_name: 'Punch Clock',
            description: 'Employee Time Tracking',
            start_url: '/punch-clock-login',
            display: 'standalone',
            background_color: '#ffffff',
            theme_color: '#000000',
            orientation: 'portrait',
            icons: [
              ...(data.pwa_icon_192_url ? [{
                src: data.pwa_icon_192_url,
                sizes: '192x192',
                type: 'image/png',
                purpose: 'any maskable'
              }] : []),
              ...(data.pwa_icon_512_url ? [{
                src: data.pwa_icon_512_url,
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any maskable'
              }] : [])
            ]
          } as const;

          const manifestBlob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' });
          const manifestURL = URL.createObjectURL(manifestBlob);
          
          // Update or create manifest link
          let link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement;
          if (!link) {
            link = document.createElement('link');
            link.rel = 'manifest';
            document.head.appendChild(link);
          }
          link.href = manifestURL;
        }
      } catch (error) {
        console.error('Error updating manifest:', error);
      }
    };

    updateManifest();
  }, []);
}
