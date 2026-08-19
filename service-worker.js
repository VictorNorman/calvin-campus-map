"use strict";

const CACHE_VERSION = "v28";
const SHELL_CACHE = `calvin-map-shell-${CACHE_VERSION}`;
const TILE_CACHE = `calvin-map-tiles-${CACHE_VERSION}`;

const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/style.css",
  "./js/core.js",
  "./js/map-setup.js",
  "./js/geolocation.js",
  "./js/search-and-routing.js",
  "./js/edit-mode.js",
  "./js/sw-client.js",
  "./js/init.js",
  "./js/buildings-data.js",
  "./vendor/maplibre/maplibre-gl.js",
  "./vendor/maplibre/maplibre-gl.css",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/calvin-crest.png",
];

self.addEventListener("install", (event) => {
  // No self.skipWaiting() here on purpose — a newly-installed worker now
  // stays "waiting" until the page explicitly tells it to take over (see
  // the "skip-waiting" message below), which only happens once the user
  // has confirmed the update prompt in js/sw-client.js's registerServiceWorker.
  //
  // { cache: "reload" } on each request is not optional here: plain
  // cache.addAll(SHELL_ASSETS) fetches through the browser's normal HTTP
  // cache, and Firebase Hosting serves these files with `Cache-Control:
  // max-age=3600`. Without this, a new service worker installing within an
  // hour of the previous visit would silently precache the STALE HTTP-
  // cached copy instead of the actually-new deploy — the version label
  // would report the new version correctly (service-worker.js itself is
  // `no-cache`), while the real page content stayed old. Confirmed this
  // exact failure mode by reproducing it against a local server with
  // matching cache headers before writing this fix.
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS.map((url) => new Request(url, { cache: "reload" }))))
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

self.addEventListener("message", (event) => {
  // Lets the page ask which cache version this worker is actually running,
  // for the dev label in the top bar (see js/sw-client.js's requestServiceWorkerVersion).
  if (event.data && event.data.type === "get-version") {
    event.source.postMessage({
      type: "sw-version",
      version: CACHE_VERSION,
    });
  }

  // Sent only after the user agrees to the "update available" prompt — see
  // js/sw-client.js's registerServiceWorker. Lets this waiting worker
  // finally activate and take over.
  if (event.data && event.data.type === "skip-waiting") {
    self.skipWaiting();
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
