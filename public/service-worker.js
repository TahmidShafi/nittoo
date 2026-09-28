// ==============================================================================
// Nittoo Service Worker — Static Asset Caching & Offline App Shell
// Version: nittoo-static-v1
//
// POLICIES:
// 1. Static asset and application shell caching ONLY.
// 2. NEVER cache Supabase API, Auth, REST, Database, or Storage responses.
// 3. NEVER cache user consumption data, tokens, account details, or credentials.
// 4. Non-GET requests (POST, PUT, DELETE, PATCH) are NEVER intercepted.
// 5. Navigation uses Network-First with cached /index.html fallback for SPA routing.
// 6. Vite-hashed static chunks (/assets/*) use Cache-First with network fallback.
// ==============================================================================

const CACHE_NAME = 'nittoo-static-v1';

// Safe, publicly accessible core application shell assets
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/site.webmanifest',
  '/favicon.svg',
  '/nittoo-logo.png',
];

// ------------------------------------------------------------------------------
// Service Worker Lifecycle: Install
// ------------------------------------------------------------------------------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => {
        return self.skipWaiting();
      })
      .catch((error) => {
        console.warn('[Nittoo SW] Pre-caching encountered an issue:', error);
      })
  );
});

// ------------------------------------------------------------------------------
// Service Worker Lifecycle: Activate & Version Cleanup
// ------------------------------------------------------------------------------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name.startsWith('nittoo-') && name !== CACHE_NAME)
            .map((obsoleteCache) => {
              console.log('[Nittoo SW] Removing obsolete cache:', obsoleteCache);
              return caches.delete(obsoleteCache);
            })
        );
      })
      .then(() => {
        return self.clients.claim();
      })
  );
});

// ------------------------------------------------------------------------------
// Service Worker Lifecycle: Fetch Interception
// ------------------------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // 1. Ignore non-GET requests (never intercept mutations, auth submissions, API writes)
  if (request.method !== 'GET') {
    return;
  }

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // 2. Ignore non-HTTP/HTTPS protocols (e.g. chrome-extension:, file:)
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // 3. STRICT AUTH & API SECURITY GUARD
  // Under NO circumstances intercept or cache Supabase, auth, REST, or user data
  if (
    url.hostname.includes('supabase.co') ||
    url.pathname.startsWith('/auth/v1') ||
    url.pathname.startsWith('/rest/v1') ||
    url.pathname.includes('/storage/v1') ||
    request.headers.has('authorization') ||
    request.headers.has('apikey')
  ) {
    return; // Pass directly to native browser network stack
  }

  // 4. SPA Navigation Requests (Network-First with offline shell fallback)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          // Device is offline or network failed: Fallback to cached SPA shell
          const cachedMatch = await caches.match(request);
          if (cachedMatch) return cachedMatch;

          const shell = await caches.match('/index.html');
          if (shell) return shell;

          const root = await caches.match('/');
          if (root) return root;

          return new Response('Network offline. Please reconnect to access Nittoo.', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          });
        })
    );
    return;
  }

  // 5. Static Assets (Cache-First with Network Fallback)
  // Covers Vite-hashed chunks in /assets/ and public static images/fonts
  const isSameOrigin = url.origin === self.location.origin;
  const isGoogleFont =
    url.origin === 'https://fonts.googleapis.com' ||
    url.origin === 'https://fonts.gstatic.com';

  const isStaticAsset =
    isSameOrigin &&
    (url.pathname.startsWith('/assets/') ||
      url.pathname.endsWith('.js') ||
      url.pathname.endsWith('.css') ||
      url.pathname.endsWith('.svg') ||
      url.pathname.endsWith('.png') ||
      url.pathname.endsWith('.ico') ||
      url.pathname.endsWith('.woff2') ||
      url.pathname.endsWith('.webmanifest'));

  if (isStaticAsset || isGoogleFont) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request).then((networkResponse) => {
          // Only cache valid, successful responses
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        });
      })
    );
  }
});
