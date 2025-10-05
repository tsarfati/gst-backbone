// Minimal service worker to enable PWA install prompt on Android
// Version: 1.1.0

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Warm icon cache if posted before activation
    const cache = await caches.open('pwa-icons-v1');
    // No-op; entries are populated via message handler
  })());
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data && data.type === 'SET_ICONS' && (data.icon192 || data.icon512)) {
    event.waitUntil((async () => {
      const cache = await caches.open('pwa-icons-v1');
      // Helper to fetch and put PNG into cache under a fixed same-origin path
      const putIcon = async (remoteUrl, path) => {
        try {
          const resp = await fetch(remoteUrl, { mode: 'no-cors', cache: 'reload' });
          const blob = await resp.blob();
          const response = new Response(blob, { headers: { 'Content-Type': 'image/png' } });
          await cache.put(new Request(path), response);
        } catch (e) {
          // Ignore fetch errors
        }
      };
      if (data.icon192) await putIcon(data.icon192, '/assets/company-icon-192.png');
      if (data.icon512) await putIcon(data.icon512, '/assets/company-icon-512.png');
      // Notify all clients to refresh icons
      const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
      clients.forEach(c => c.postMessage({ type: 'ICONS_READY' }));
    })());
  }
});


self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Serve cached company icons at fixed paths (fallback to bundled defaults)
  if (url.pathname === '/assets/company-icon-192.png' || url.pathname === '/assets/company-icon-512.png') {
    event.respondWith((async () => {
      const cache = await caches.open('pwa-icons-v1');
      const cached = await cache.match(event.request, { ignoreSearch: true });
      if (cached) return cached;
      try {
        const resp = await fetch(event.request, { cache: 'reload' });
        await cache.put(event.request, resp.clone());
        return resp;
      } catch {
        const fallback = url.pathname.endsWith('192.png') ? '/punch-clock-icon-192.png' : '/punch-clock-icon-512.png';
        return fetch(fallback, { cache: 'reload' });
      }
    })());
    return;
  }

  // Same-origin icon proxy to work around Android Chrome manifest icon restrictions
  if (url.pathname === '/icon-proxy') {
    const remote = url.searchParams.get('u');
    if (remote) {
      event.respondWith(
        fetch(remote, { mode: 'no-cors', cache: 'reload' }).catch(() => fetch(event.request))
      );
      return;
    }
  }
  // Default: network-pass-through
  event.respondWith(fetch(event.request));
});