// ── BioBalance Service Worker ──────────────────────────────
// Caches all game assets on first load so the game works
// fully offline after that. Update CACHE_NAME when you
// deploy new files (old cache is deleted automatically).
// ───────────────────────────────────────────────────────────

const CACHE_NAME = 'biobalance-v1';

const ASSETS = [
  './',
  './index.html',
  './sketch.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',

  // ── Images ──────────────────────────────────────────────
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

  // ── Audio ───────────────────────────────────────────────
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

// ── Install: cache everything ────────────────────────────
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      console.log('[BioBalance SW] Caching all assets');
      return cache.addAll(ASSETS);
    })
  );
  // Activate immediately — don't wait for old tabs to close
  self.skipWaiting();
});

// ── Activate: delete old caches ─────────────────────────
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys
          .filter(function(key) { return key !== CACHE_NAME; })
          .map(function(key) {
            console.log('[BioBalance SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      );
    })
  );
  // Take control of all open pages immediately
  self.clients.claim();
});

// ── Fetch: cache-first, then network ────────────────────
self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;
      // Not in cache — fetch from network and cache it
      return fetch(event.request).then(function(response) {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        let responseClone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, responseClone);
        });
        return response;
      });
    })
  );
});