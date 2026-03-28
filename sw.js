// ── BioBalance Service Worker v3.1 ──────────────────────────────
// Updated: March 2026
// Caches core game files for full offline play after first visit.
// Update CACHE_NAME whenever you change assets or sketch.js

const CACHE_NAME = 'biobalance-v3.1';   // ← Bump this when updating (e.g. v3.2)

const ASSETS = [
    './',
    './index.html',
    './sketch.js',
    './sw.js',
    './manifest.json',

    // Icons (use exact filenames)
    './DigestiveAPP_LOGO.png',
    './DigestiveAPP_LOGO-1.png',

    // Your game assets (images, audio, data)
    './data/stomach.png',
    './data/protein.png',
    './data/intestine.png',
    './data/hormone1.png',
    './data/hormone2.png',
    './data/villi.png',
    './data/glucose.png',
    './data/sodium.png',
    './data/lipid.png',
    './data/glucoseZone.png',
    './data/sodiumZone.png',
    './data/head.png',
    './data/deliciousfood.png',
    './data/spoiledfood.png',

    // Audio files
    './data/bgloop.mp3',
    './data/click.wav',
    './data/acid.wav',
    './data/success.wav',
    './data/spray.wav',
    './data/drag.wav',
    './data/warning.wav',
    './data/report.wav',
    './data/denature.wav',
    './data/bounce.wav',
    './data/nhe3.wav',
    './data/wrong.wav',
    './data/correct.wav',
    './data/swallow.wav',
    './data/chew.wav'
];

// Install — Precache all static assets
self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function(cache) {
                console.log('[BioBalance SW] Caching app assets...');
                return cache.addAll(ASSETS);
            })
            .then(() => {
                console.log('[BioBalance SW] All assets cached successfully');
                return self.skipWaiting();   // Activate immediately
            })
            .catch(err => {
                console.error('[BioBalance SW] Cache failed:', err);
            })
    );
});

// Activate — Clean up old caches
self.addEventListener('activate', function(event) {
    event.waitUntil(
        caches.keys().then(function(cacheNames) {
            return Promise.all(
                cacheNames.map(function(cacheName) {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[BioBalance SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    return self.clients.claim();   // Take control of all tabs immediately
});

// Fetch — Cache-first strategy with network fallback
self.addEventListener('fetch', function(event) {
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request)
            .then(function(cachedResponse) {
                // Return cached version if available
                if (cachedResponse) {
                    return cachedResponse;
                }

                // Not in cache → try network
                return fetch(event.request)
                    .then(function(networkResponse) {
                        // Only cache successful same-origin responses
                        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                            const responseClone = networkResponse.clone();
                            caches.open(CACHE_NAME).then(function(cache) {
                                cache.put(event.request, responseClone);
                            });
                        }
                        return networkResponse;
                    })
                    .catch(function() {
                        // Offline and not cached
                        if (event.request.mode === 'navigate') {
                            // Fallback to index.html for navigation (SPA-like behavior)
                            return caches.match('./index.html');
                        }
                        // For other failed requests, return a simple offline message
                        return new Response('Offline - Resource not available', {
                            status: 503,
                            statusText: 'Service Unavailable'
                        });
                    });
            })
    );
});
