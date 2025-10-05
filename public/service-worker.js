// Minimal service worker to enable PWA install prompt on Android
// Version: 1.0.0

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
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