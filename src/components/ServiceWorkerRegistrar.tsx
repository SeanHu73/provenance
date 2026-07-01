'use client';

import { useEffect } from 'react';

/**
 * The service worker is retired (it had a bug that broke page loads and served
 * stale content). Instead of registering, we now actively unregister any worker
 * that's still installed and wipe its caches, so every device drops back to the
 * plain network and receives fresh deploys.
 */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations()
        .then((regs) => regs.forEach((r) => r.unregister()))
        .catch(() => {});
    }
    if (typeof caches !== 'undefined') {
      caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
    }
  }, []);
  return null;
}
