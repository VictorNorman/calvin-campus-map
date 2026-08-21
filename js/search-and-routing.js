"use strict";

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

const searchInput = document.getElementById("search-input");
const searchResultsEl = document.getElementById("search-results");
const searchClearBtn = document.getElementById("search-clear");
const searchForm = document.getElementById("search-form");

function normalize(s) {
  return s.toLowerCase().trim();
}

function searchBuildings(query) {
  const q = normalize(query);
  if (!q) {
    return [];
  }
  const scored = [];
  for (const b of CALVIN_BUILDINGS) {
    const name = normalize(b.name);
    const haystacks = [name, ...(b.aliases || []).map(normalize), normalize(b.category)];
    let best = -1;
    for (const h of haystacks) {
      if (h === q) {
        best = Math.max(best, 100);
      } else if (h.startsWith(q)) {
        best = Math.max(best, 80);
      } else if (h.includes(q)) {
        best = Math.max(best, 50);
      }
    }
    if (best > 0) {
      scored.push({
        b,
        score: best,
      });
    }
  }
  scored.sort((a, c) => c.score - a.score || a.b.name.localeCompare(c.b.name));
  return scored.map((s) => s.b).slice(0, 8);
}

function renderResults(results) {
  searchResultsEl.innerHTML = "";
  if (results.length === 0) {
    searchResultsEl.hidden = true;
    return;
  }
  results.forEach((b) => {
    const li = document.createElement("li");
    li.setAttribute("role", "option");
    li.className = "search-result";
    li.innerHTML = `
      <span class="result-dot" style="background:${CATEGORY_COLORS[b.category] || "#7a1e29"}"></span>
      <span class="result-text">
        <span class="result-name">${escapeHtml(b.name)}</span>
        <span class="result-meta">${escapeHtml(b.category)}${b.note ? " · " + escapeHtml(b.note) : ""}</span>
      </span>
    `;
    li.addEventListener("click", () => {
      // Blur before selecting — setSearchInputStatus (called from
      // selectBuilding) skips updating the field while it's focused, so
      // focus has to be gone first or the destination status never shows.
      searchResultsEl.hidden = true;
      searchInput.blur();
      selectBuilding(b);
    });
    searchResultsEl.appendChild(li);
  });
  searchResultsEl.hidden = false;
}

searchInput.addEventListener("input", () => {
  const val = searchInput.value;
  searchClearBtn.hidden = val.length === 0;
  updateClearButtonLabel();
  renderResults(searchBuildings(val));
});

searchInput.addEventListener("focus", () => {
  // The field is showing "{destination} — {status}" rather than something
  // the user typed — select it all so the next keystroke replaces it
  // outright, instead of trying to search for that whole string.
  if (activeBuilding) {
    searchInput.select();
    return;
  }
  if (searchInput.value) {
    renderResults(searchBuildings(searchInput.value));
  }
});

searchForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const results = searchBuildings(searchInput.value);
  if (results.length > 0) {
    searchResultsEl.hidden = true;
    searchInput.blur();
    selectBuilding(results[0]);
  }
});

searchClearBtn.addEventListener("click", () => {
  if (activeBuilding) {
    cancelActiveRoute();
  }
  searchInput.value = "";
  searchClearBtn.hidden = true;
  searchResultsEl.hidden = true;
  searchInput.focus();
});

document.addEventListener("click", (e) => {
  if (!e.target.closest("#search-form") && !e.target.closest("#search-results")) {
    searchResultsEl.hidden = true;
  }
});

// ---------------------------------------------------------------------------
// Category filter chips
// ---------------------------------------------------------------------------

function initCategoryChips() {
  const container = document.getElementById("category-chips");
  const present = new Set(CALVIN_BUILDINGS.map((b) => b.category));
  const cats = CATEGORY_ORDER.filter((c) => present.has(c));

  const allChip = document.createElement("button");
  allChip.className = "chip active";
  allChip.textContent = "All";
  allChip.addEventListener("click", () => setCategoryFilter(null));
  container.appendChild(allChip);

  cats.forEach((cat) => {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.textContent = cat;
    chip.style.setProperty("--chip-color", CATEGORY_COLORS[cat] || "#7a1e29");
    chip.addEventListener("click", () => setCategoryFilter(cat));
    container.appendChild(chip);
  });
}

function setCategoryFilter(category) {
  activeCategory = category;
  document.querySelectorAll("#category-chips .chip").forEach((chip) => {
    const isAll = chip.textContent === "All";
    chip.classList.toggle("active", isAll ? category === null : chip.textContent === category);
  });
  buildingMarkers.forEach((marker) => {
    const show = category === null || marker._category === category;
    marker.getElement().style.display = show ? "" : "none";
  });
}

// ---------------------------------------------------------------------------
// Building selection & routing
// ---------------------------------------------------------------------------

function destinationMarkerEl() {
  const el = document.createElement("div");
  el.style.width = "24px";
  el.style.height = "32px";
  el.innerHTML = '<span class="destination-pin-dot"></span>';
  return el;
}

// Picks the entrance closest to `from` (falling back to the building's own
// point if it has no entrances listed yet, or to the first entrance if
// `from` isn't known yet).
function nearestEntrance(building, from) {
  const all =
    building.entrances && building.entrances.length > 0
      ? building.entrances
      : [
        {
          lat: building.lat,
          lon: building.lon,
        },
      ];
  // If any entrances are flagged preferred (e.g. the only one that's
  // actually unlocked, or the accessible one), route to the nearest of
  // those instead of the nearest of all of them — a slightly-closer
  // non-preferred door never wins.
  const preferred = all.filter((e) => e.preferred);
  const points = preferred.length > 0 ? preferred : all;

  if (!from) {
    return points[0];
  }
  let best = points[0];
  let bestDist = distanceMeters(from, {
    lat: best.lat,
    lng: best.lon,
  });
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    const dist = distanceMeters(from, {
      lat: p.lat,
      lng: p.lon,
    });
    if (dist < bestDist) {
      best = p;
      bestDist = dist;
    }
  }
  return best;
}

function placeDestinationMarker(entrance) {
  if (destinationMarker) {
    destinationMarker.setLngLat([entrance.lon, entrance.lat]);
    return;
  }
  destinationMarker = new maplibregl.Marker({
    element: destinationMarkerEl(),
    anchor: "bottom",
    rotationAlignment: "viewport",
    pitchAlignment: "viewport",
    zIndexOffset: 900,
  })
    .setLngLat([entrance.lon, entrance.lat])
    .addTo(map);
}

function selectBuilding(building) {
  activeBuilding = building;
  setSearchInputStatus(building, "Calculating…");
  requestRoute(building);
}

// The search box already shows the chosen destination's name, so it also
// carries the route status instead of a separate panel — "{name} —
// {suffix}". Skipped while the box is focused so an async update (e.g. a
// route response arriving late) can't clobber text the user is mid-typing
// to search for something else.
function setSearchInputStatus(building, suffix) {
  if (document.activeElement === searchInput) {
    return;
  }
  searchInput.value = suffix ? `${building.name} — ${suffix}` : building.name;
  searchClearBtn.hidden = false;
  updateClearButtonLabel();
}

// While a destination is active, the × button cancels its route (in
// addition to clearing the text) — reflect that in its accessible name
// rather than leaving it stuck on the plain "Clear search" label.
function updateClearButtonLabel() {
  searchClearBtn.setAttribute("aria-label", activeBuilding ? `Cancel route to ${activeBuilding.name}` : "Clear search");
}

function cancelActiveRoute() {
  if (destinationMarker) {
    destinationMarker.remove();
    destinationMarker = null;
  }
  clearRouteLine();
  activeBuilding = null;
}

// routing.openstreetmap.de is a free, shared public instance — like the
// Overpass API this app also uses, it can have brief slow/busy patches
// under completely normal use. One retry after a short pause rides out a
// transient blip instead of immediately giving up and showing the
// straight-line fallback.
const OSRM_TIMEOUT_MS = 12000;
const OSRM_RETRY_DELAY_MS = 1200;

// AbortSignal.any() would do this in one line, but it's a newer API
// (Safari 17.4+) — combining manually avoids gambling on exactly which iOS
// version this runs on.
function combineAbortSignals(signals) {
  const controller = new AbortController();
  signals.forEach((s) => {
    if (s.aborted) {
      controller.abort();
    } else {
      s.addEventListener("abort", () => controller.abort(), { once: true });
    }
  });
  return controller.signal;
}

async function fetchOsrmRoute(url, signal) {
  const res = await fetch(url, { signal });
  if (!res.ok) {
    // Include the response body in the error — if this is a rate limit,
    // OSRM's own explanation (e.g. "Too Many Requests") will be in here,
    // which is otherwise invisible since we never see the raw response.
    const bodyText = await res.text().catch(() => "");
    throw new Error(`Routing service returned ${res.status}${bodyText ? `: ${bodyText.slice(0, 200)}` : ""}`);
  }
  const data = await res.json();
  if (data.code !== "Ok" || !data.routes || data.routes.length === 0) {
    throw new Error(`No walking route found (code: ${data.code || "unknown"})`);
  }
  return data.routes[0];
}

// The routing request currently "owned" by the latest requestRoute() call.
// Starting a new one aborts whatever the previous one was still doing —
// GPS updates can arrive faster than OSRM responds, and without this,
// overlapping requests pile up unbounded instead of the newest one simply
// replacing the last (see ROUTE_REFRESH_MIN_INTERVAL_MS in core.js for the
// complementary fix that stops so many from starting in the first place).
let currentRouteController = null;

async function requestRoute(building) {
  const entrance = nearestEntrance(building, userLatLng);
  placeDestinationMarker(entrance);

  if (!userLatLng) {
    setSearchInputStatus(building, "waiting for your location…");
    clearRouteLine();
    map.easeTo({
      center: [entrance.lon, entrance.lat],
      zoom: DEFAULT_ZOOM,
      duration: 400,
    });
    return;
  }

  lastRouteRequestAt = Date.now();
  lastRouteRequestLatLng = userLatLng;

  if (currentRouteController) {
    currentRouteController.abort();
  }
  const controller = new AbortController();
  currentRouteController = controller;
  const superseded = () => controller.signal.aborted;

  const url =
    `${OSRM_FOOT_URL}${userLatLng.lng},${userLatLng.lat};${entrance.lon},${entrance.lat}` +
    `?overview=full&geometries=geojson`;

  let route;
  try {
    route = await fetchOsrmRoute(url, combineAbortSignals([controller.signal, AbortSignal.timeout(OSRM_TIMEOUT_MS)]));
  } catch (firstErr) {
    if (superseded()) {
      return; // a newer request replaced this one — not a real failure
    }
    console.warn("Routing failed, retrying once:", firstErr);
    await new Promise((resolve) => setTimeout(resolve, OSRM_RETRY_DELAY_MS));
    if (superseded()) {
      return;
    }
    try {
      route = await fetchOsrmRoute(url, combineAbortSignals([controller.signal, AbortSignal.timeout(OSRM_TIMEOUT_MS)]));
    } catch (secondErr) {
      if (superseded()) {
        return;
      }
      console.warn("Routing failed again, falling back to straight line:", secondErr);
      const straight = [
        [userLatLng.lng, userLatLng.lat],
        [entrance.lon, entrance.lat],
      ];
      drawRoute(straight, true);
      const meters = distanceMeters(userLatLng, {
        lat: entrance.lat,
        lng: entrance.lon,
      });
      const estSeconds = meters / 1.3; // ~1.3 m/s average walking speed
      updateRouteStats(building, meters, estSeconds, true);
      fitRouteBounds(straight);
      return;
    }
  }

  const coords = route.geometry.coordinates; // already [lng, lat] pairs
  drawRoute(coords, false);
  updateRouteStats(building, route.distance, route.duration, false);
  fitRouteBounds(coords);
}

// GeoJSON source + layers backing the route line. Two line layers share one
// source so we can toggle solid-vs-dashed without rebuilding anything.
function addRouteLayers() {
  map.addSource("route", {
    type: "geojson",
    data: {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [],
      },
    },
  });
  map.addLayer({
    id: "route-outline",
    type: "line",
    source: "route",
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
    paint: {
      "line-color": "#ffffff",
      "line-width": 8,
      "line-opacity": 0.9,
    },
  });
  map.addLayer({
    id: "route-line-solid",
    type: "line",
    source: "route",
    layout: {
      "line-cap": "round",
      "line-join": "round",
      visibility: "visible",
    },
    paint: {
      "line-color": "#2a7de1",
      "line-width": 5,
      "line-opacity": 0.95,
    },
  });
  map.addLayer({
    id: "route-line-dashed",
    type: "line",
    source: "route",
    layout: {
      "line-cap": "round",
      "line-join": "round",
      visibility: "none",
    },
    paint: {
      "line-color": "#c0392b",
      "line-width": 5,
      "line-opacity": 0.95,
      "line-dasharray": [2, 3],
    },
  });
}

function drawRoute(coords, isFallback) {
  if (!mapReady) {
    return;
  }
  map.getSource("route").setData({
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates: coords,
    },
  });
  map.setLayoutProperty("route-line-solid", "visibility", isFallback ? "none" : "visible");
  map.setLayoutProperty("route-line-dashed", "visibility", isFallback ? "visible" : "none");
}

function clearRouteLine() {
  if (!mapReady) {
    return;
  }
  map.getSource("route").setData({
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates: [],
    },
  });
}

function fitRouteBounds(coords) {
  // MapLibre's fitBounds() defaults bearing to 0 (north-up) when it's not
  // explicitly given — it does NOT preserve the map's current bearing. This
  // runs on every route (re)request, including the periodic ones triggered
  // by ROUTE_REFRESH_MIN_INTERVAL_MS/METERS in onPosition while walking an
  // active route, so passing the current bearing back in here is what keeps
  // rotation mode from getting silently reset every time the route refreshes.
  map.fitBounds(boundsOf(coords), {
    padding: 60,
    maxZoom: 18,
    bearing: map.getBearing(),
  });
  followUser = false;
}

function formatDistance(meters) {
  const yards = meters * 1.09361;
  if (yards < 1760) {
    return `${Math.round(yards)} yd`;
  }
  return `${(yards / 1760).toFixed(2)} mi`;
}

function formatDuration(seconds) {
  const mins = Math.round(seconds / 60);
  if (mins < 1) {
    return "< 1 min";
  }
  return `${mins} min`;
}

function updateRouteStats(building, meters, seconds, isFallback) {
  const suffix = isFallback
    ? `${formatDistance(meters)} · about ${formatDuration(seconds)} (straight line)`
    : `${formatDistance(meters)} · about ${formatDuration(seconds)} walking`;
  setSearchInputStatus(building, suffix);
}
