const CACHE_NAME = 'proto-project-v2';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon.png',
  'https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@300;400;500;600;700;800&family=Georgia:wght@400;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js'
];

// Install Event: Cache core files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Caching app shell');
        return cache.addAll(ASSETS_TO_CACHE);
      })
  );
  // Activate immediately - don't wait for old tabs to close
  self.skipWaiting();
});

// Activate Event: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      );
    })
  );
  // Take control of all clients immediately
  self.clients.claim();
});

// Fetch Event: Network first with cache fallback
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip Google Analytics, tracking pixels, etc.
  if (event.request.url.includes('google-analytics') || 
      event.request.url.includes('gtag')) {
    return;
  }
  
  event.respondWith(
    // Try network first
    fetch(event.request)
      .then(response => {
        // Cache successful responses
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              // Don't cache Google Sheets CSV responses for too long
              // They'll be refreshed on next network request
              if (!event.request.url.includes('googleapis.com')) {
                cache.put(event.request, responseClone);
              }
            });
        }
        return response;
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(event.request)
          .then(cachedResponse => {
            if (cachedResponse) {
              return cachedResponse;
            }
            
            // If requesting the main page, return cached index
            if (event.request.mode === 'navigate' || 
                event.request.url.endsWith('/') ||
                event.request.url.includes('index.html')) {
              return caches.match('./index.html');
            }
            
            // If it's an API request, return offline message
            if (event.request.url.includes('googleapis.com')) {
              return new Response(
                JSON.stringify({ offline: true, message: 'Data will refresh when online' }),
                { 
                  status: 503, 
                  statusText: 'Service Unavailable',
                  headers: { 'Content-Type': 'application/json' }
                }
              );
            }
            
            // Return offline page for everything else
            return new Response(
              '<html><body style="background:#0a1625;color:#c9a94b;font-family:sans-serif;text-align:center;padding:2rem;"><h1>📱 Offline</h1><p>Please check your connection</p></body></html>',
              { 
                status: 503, 
                statusText: 'Service Unavailable',
                headers: { 'Content-Type': 'text/html' }
              }
            );
          });
      })
  );
});
