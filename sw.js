// ZeroDay ZFM Studio Service Worker
const CACHE_NAME = 'zfm-studio-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pass-through network first, fallback to cache
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('/api/')) return; // Never cache API calls

  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
