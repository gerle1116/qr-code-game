// Represents an already installed pre-Stage-11 worker and cache in the isolated browser profile.
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    await (await caches.open('qr-city-quest-v40')).put('/old-shell-marker', new Response('previous shell'));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => { event.waitUntil(self.clients.claim()); });
