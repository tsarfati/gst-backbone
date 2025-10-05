// Minimal service worker to enable PWA install prompt on Android
// Version: 1.0.0

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Basic pass-through to satisfy the "has fetch handler" requirement
  event.respondWith(fetch(event.request));
});