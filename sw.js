// ── BioBalance Service Worker ──────────────────────────────
// Caches all game assets on first load so the game works
// fully offline after that. Update CACHE_NAME when you
// deploy new files (old cache is deleted automatically).
// ───────────────────────────────────────────────────────────
const CACHE_NAME = 'biobalance-v3';   // MUST match version used in sketch.js

const ASSETS = [
  './',
  './index.html',
  './sketch.js',
  './sw.js',
  './manifest.json',
  // ── Icons — use EXACT filenames from your repo ──────────
  './DigestiveAPP_LOGO.png',
  './DigestiveAPP_LOGO-1.png',
  // ── p5.js libraries (CRITICAL for offline play) ─────────
  // These MUST exist in a /lib/ folder in your repo.
  // Without them the game cannot run offline at all.
  './lib/p5.min.js',
  './lib/p5.sound.min.js',
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
// IMPORTANT: cache.addAll() is all-or-nothing.
// If ANY file above returns a 404, the entire install fails
// and nothing gets cached. Make sure every path is correct.
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

// ── Fetch: cache-first, network fallback, offline shell ─
self.addEventListener('fetch', function(event) {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;

      // Not in cache — try the network
      return fetch(event.request).then(function(response) {
        // Only cache valid, same-origin responses
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        let responseClone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, responseClone);
        });
        return response;
      }).catch(function() {
        // Network failed and asset not in cache.
        // For page navigation, serve the cached index.html as offline shell.
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        // For other assets, return a simple offline response
        return new Response('', { status: 408, statusText: 'Offline' });
      });
    })
  );
});
