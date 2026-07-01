// Self-destructing service worker.
//
// This app no longer uses a service worker — the previous one (cache-first-ish)
// had a bug: when a request wasn't cached and the network hiccuped it called
// respondWith(undefined) → "Failed to convert value to 'Response'", which broke
// page loads and made deploys look like they "didn't take". Any client that
// still has an old worker will update to THIS one, which clears all caches,
// unregisters itself, and reloads onto the plain network. There is deliberately
// no fetch handler, so requests are never intercepted.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch {
      /* ignore */
    }
    try {
      await self.registration.unregister();
    } catch {
      /* ignore */
    }
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const client of clients) {
      try { client.navigate(client.url); } catch { /* ignore */ }
    }
  })());
});
