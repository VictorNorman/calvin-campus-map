"use strict";

const CACHE_VERSION = "v20";
const SHELL_CACHE = `calvin-map-shell-${CACHE_VERSION}`;
const TILE_CACHE = `calvin-map-tiles-${CACHE_VERSION}`;

const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/style.css",
  "./js/app.js",
  "./js/buildings-data.js",
  "./vendor/maplibre/maplibre-gl.js",
  "./vendor/maplibre/maplibre-gl.css",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/calvin-crest.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== TILE_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Lets the page ask which cache version this worker is actually running,
// for the dev label in the top bar (see app.js's requestServiceWorkerVersion).
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "get-version") {
    event.source.postMessage({
      type: "sw-version",
      version: CACHE_VERSION,
    });
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  // Map tiles: cache-first with a background refresh, so recently viewed
  // areas of campus still render when offline.
  if (url.hostname.endsWith("tile.openstreetmap.org")) {
    event.respondWith(cacheFirstWithRefresh(request, TILE_CACHE));
    return;
  }

  // Routing API calls always need a live network round-trip.
  if (url.hostname.includes("routing.openstreetmap.de")) {
    return;
  }

  // App shell: cache-first, falling back to network.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request))
    );
  }
});

async function cacheFirstWithRefresh(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkFetch = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  return cached || (await networkFetch) || Response.error();
}
