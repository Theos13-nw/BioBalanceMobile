// ── BioBalance Service Worker v3.2 ──────────────────────────────
// Updated: March 2026
// IMPORTANT: Bump CACHE_NAME every time you deploy new files.
// The SW will delete all old caches and install fresh on next load.

const CACHE_NAME = 'biobalance-v3.2';

const ASSETS = [
    './',
    './index.html',
    './sketch.js',
    './sw.js',
    './manifest.json',

    './DigestiveAPP_LOGO.png',
    './DigestiveAPP_LOGO-1.png',

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

// ── INSTALL ───────────────────────────────────────────────
// Cache all assets, then skipWaiting so the new SW activates
// immediately without waiting for old tabs to close.
self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function(cache) {
                console.log('[BioBalance SW] Caching assets for', CACHE_NAME);
                return cache.addAll(ASSETS);
            })
            .then(function() {
                console.log('[BioBalance SW] Cache complete — skipping wait');
                return self.skipWaiting();  // activate this SW immediately
            })
            .catch(function(err) {
                console.error('[BioBalance SW] Cache failed:', err);
            })
    );
});

// ── ACTIVATE ──────────────────────────────────────────────
// Delete every cache that isn't current, claim all clients,
// then notify them to wipe any old-version save data.
self.addEventListener('activate', function(event) {
    event.waitUntil(
        caches.keys()
            .then(function(cacheNames) {
                return Promise.all(
                    cacheNames
                        .filter(function(name) { return name !== CACHE_NAME; })
                        .map(function(name) {
                            console.log('[BioBalance SW] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(function() {
                return self.clients.claim();
            })
            .then(function() {
                // Tell all open clients to clear any save that doesn't match
                // the current version — this is what resets progress on reinstall
                return self.clients.matchAll({ includeUncontrolled: true });
            })
            .then(function(clients) {
                clients.forEach(function(client) {
                    client.postMessage({ type: 'CACHE_UPDATED', cacheName: CACHE_NAME });
                });
            })
    );
});

// ── FETCH ─────────────────────────────────────────────────
// sketch.js and index.html: network-first so updates deploy immediately.
// Everything else: cache-first for fast offline load.
self.addEventListener('fetch', function(event) {
    if (event.request.method !== 'GET') return;

    let url = event.request.url;
    let isCore = url.endsWith('sketch.js') || url.endsWith('index.html');

    if (isCore) {
        // Network-first: always try to get the freshest version
        event.respondWith(
            fetch(event.request)
                .then(function(networkResponse) {
                    if (networkResponse && networkResponse.status === 200) {
                        let clone = networkResponse.clone();
                        caches.open(CACHE_NAME).then(function(cache) {
                            cache.put(event.request, clone);
                        });
                    }
                    return networkResponse;
                })
                .catch(function() {
                    // Offline fallback — serve cached version
                    return caches.match(event.request);
                })
        );
    } else {
        // Cache-first for images, audio, icons
        event.respondWith(
            caches.match(event.request)
                .then(function(cached) {
                    if (cached) return cached;
                    return fetch(event.request)
                        .then(function(networkResponse) {
                            if (networkResponse && networkResponse.status === 200 &&
                                networkResponse.type === 'basic') {
                                let clone = networkResponse.clone();
                                caches.open(CACHE_NAME).then(function(cache) {
                                    cache.put(event.request, clone);
                                });
                            }
                            return networkResponse;
                        })
                        .catch(function() {
                            if (event.request.mode === 'navigate') {
                                return caches.match('./index.html');
                            }
                            return new Response('Offline — resource not available', {
                                status: 503,
                                statusText: 'Service Unavailable'
                            });
                        });
                })
        );
    }
});
