
/* MARO AI Service Worker
 * - Caches public static assets only.
 * - Never caches private HTML pages, API calls, authentication,
 *   user data, or Supabase requests.
 * - Displays the custom Maro offline/startup screen if the
 *   server is slow or unavailable.
 */

const VERSION = 'maro-v2';

const PRECACHE = [
  '/offline.html',
  '/icons/maro.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

const STARTUP_TIMEOUT = 12000; // 12 seconds

// --------------------------------------------------
// INSTALL
// --------------------------------------------------

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then(async (cache) => {
      // Cache individually so one missing asset doesn't
      // prevent the entire service worker from installing.
      await Promise.allSettled(
        PRECACHE.map((asset) => cache.add(asset))
      );
    })
  );

  self.skipWaiting();
});

// --------------------------------------------------
// ACTIVATE
// --------------------------------------------------

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== VERSION)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// --------------------------------------------------
// MESSAGE
// --------------------------------------------------

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

async function getOfflinePage() {
  const cache = await caches.open(VERSION);

  const cached = await cache.match('/offline.html');

  if (cached) {
    return cached;
  }

  return new Response(
    'Maro is temporarily unavailable. Please check your internet connection.',
    {
      status: 503,
      headers: {
        'Content-Type': 'text/plain;charset=UTF-8',
      },
    }
  );
}

async function fetchWithTimeout(request, timeout = STARTUP_TIMEOUT) {
  const controller = new AbortController();

  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(request, {
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

// --------------------------------------------------
// FETCH
// --------------------------------------------------

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Never intercept non-GET requests.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // External services always use the network.
  if (url.origin !== self.location.origin) return;

  // Never intercept APIs, authentication or private routes.
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth') ||
    url.pathname.startsWith('/login') ||
    url.pathname.startsWith('/admin-login')
  ) {
    return;
  }

  // ------------------------------------------------
  // PAGE NAVIGATION
  // ------------------------------------------------

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // Give the server up to 12 seconds to respond.
          const response = await fetchWithTimeout(request);

          if (response.ok) {
            return response;
          }

          // Server errors: show Maro's branded fallback.
          if (response.status >= 500) {
            return await getOfflinePage();
          }

          // For normal 404/redirect responses, preserve them.
          return response;
        } catch (error) {
          // Network unavailable or Render taking too long.
          return await getOfflinePage();
        }
      })()
    );

    return;
  }

  // ------------------------------------------------
  // STATIC ASSETS
  // ------------------------------------------------

  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/')
  ) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);

        if (cached) {
          return cached;
        }

        try {
          const response = await fetch(request);

          if (response.ok) {
            const cache = await caches.open(VERSION);
            cache.put(request, response.clone());
          }

          return response;
        } catch {
          return new Response('', {
            status: 503,
            statusText: 'Asset unavailable offline',
          });
        }
      })()
    );
  }
});
