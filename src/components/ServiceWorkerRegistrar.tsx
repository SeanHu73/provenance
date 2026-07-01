'use client';

import { useEffect } from 'react';

/** Bump this on each deploy we want to verify is live — it prints to the console
 *  so we can confirm which build the browser is actually running. */
const BUILD_MARKER = 'ctx-journal 2026-06-30 #1';

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    console.log(`[provenance] build: ${BUILD_MARKER}`);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);
  return null;
}
