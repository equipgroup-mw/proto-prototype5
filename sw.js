const CACHE_NAME = 'proto-project-v4'; // Updated version to v4
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './overview.html',
  './directory.html', // Added directory page
  './user.html',
  './manifest.json',
  './icon.png',
  './EquipLogo.png', // Added for offline directory page
  './Proto.png',     // Added for offline directory page
  'https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@300;400;500;600;700;800&family=Georgia:wght@400;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js'
];

// Install Event: Cache core files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Caching app shell (v4)');
        return cache.addAll(ASSETS_TO_CACHE);
      })
  );
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
  self.clients.claim();
});

// Fetch Event: Network first with cache fallback
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  
  // Skip analytics
  if (event.request.url.includes('google-analytics') || 
      event.request.url.includes('gtag')) {
    return;
  }
  
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              // Don't cache Google Sheets CSV responses
              if (!event.request.url.includes('googleapis.com')) {
                cache.put(event.request, responseClone);
              }
            });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request)
          .then(cachedResponse => {
            if (cachedResponse) {
              return cachedResponse;
            }
            
            // If navigating, try to return the cached page or index
            if (event.request.mode === 'navigate') {
              // Try to match the exact URL first
              return caches.match(event.request)
                .then(exactMatch => {
                  if (exactMatch) return exactMatch;
                  // Fall back to index.html
                  return caches.match('./index.html');
                });
            }
            
            // For API requests, return offline message
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
            
            // Return offline page
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