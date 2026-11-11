const CACHE_NAME = 'paylix-cache-v2';
const APP_SHELL = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => Promise.all(
      cacheNames.map((cacheName) => {
        if (cacheName !== CACHE_NAME) {
          return caches.delete(cacheName);
        }
        return null;
      })
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    if (!navigator.onLine) {
      event.respondWith(
        new Response(JSON.stringify({ error: 'Hors connexion — les opérations nécessitent une connexion Internet.' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        })
      );
      return;
    }
    return;
  }

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isStaticAsset = ['script', 'style', 'image', 'font', 'worker'].includes(request.destination);
  const isDocumentRequest = request.mode === 'navigate';
  const isApiRequest = isSameOrigin && url.pathname.startsWith('/api/');
  const isDirectAuthNavigation = isSameOrigin && (
    url.pathname === '/login' ||
    url.pathname.startsWith('/login') ||
    url.pathname === '/forgot-password' ||
    url.pathname.startsWith('/forgot-password') ||
    url.pathname === '/update-password' ||
    url.pathname.startsWith('/update-password') ||
    url.pathname === '/parent/join' ||
    url.pathname.startsWith('/parent/join')
  );

  if (isDocumentRequest) {
    if (isDirectAuthNavigation) {
      event.respondWith(fetch(request));
      return;
    }

    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match('/');
        return cached || Response.error();
      })
    );
    return;
  }

  if (isApiRequest) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => networkResponse)
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || Response.error();
        })
    );
    return;
  }

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        }).catch(() => cachedResponse || Response.error());

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  event.respondWith(fetch(request).catch(() => caches.match(request) || Response.error()));
});

self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: data.url
    };
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  if (event.notification.data) {
    event.waitUntil(
      clients.openWindow(event.notification.data)
    );
  }
});
