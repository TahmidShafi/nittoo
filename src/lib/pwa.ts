/**
 * Nittoo PWA & Service Worker Registration
 *
 * Rules:
 * 1. Register only in production builds (import.meta.env.PROD === true).
 * 2. Never register during local development to avoid stale asset interference.
 * 3. Scope registration to root ('/').
 * 4. Quiet, non-intrusive logging without disrupting user workflows.
 */

export function registerServiceWorker(): void {
  if (typeof window === 'undefined') {
    return;
  }

  // Register strictly in production environments
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/service-worker.js', { scope: '/' })
        .then((registration) => {
          registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === 'installed') {
                  if (navigator.serviceWorker.controller) {
                    console.log('[Nittoo PWA] New update available.');
                  } else {
                    console.log('[Nittoo PWA] App shell and assets cached for offline use.');
                  }
                }
              };
            }
          };
        })
        .catch((error) => {
          console.warn('[Nittoo PWA] Service worker registration failed:', error);
        });
    });
  }
}
