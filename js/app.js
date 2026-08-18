"use strict";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CAMPUS_CENTER = {
  lat: 42.9310,
  lng: -85.5865,
};
const CAMPUS_BOUNDS = {
  west: -85.5945,
  south: 42.9255,
  east: -85.5720,
  north: 42.9385,
};
const DEFAULT_ZOOM = 16;

// Public FOSSGIS OSRM instance — no API key required, foot profile for walking routes.
const OSRM_FOOT_URL = "https://routing.openstreetmap.de/routed-foot/route/v1/foot/";

const CATEGORY_ORDER = [
  "Admissions",
  "Academic",
  "Residence Hall",
  "Apartments",
  "Shopping & Dining",
  "Athletics",
  "Event Space",
  "Parking",
];

const CATEGORY_COLORS = {
  "Admissions": "#c0392b",
  "Academic": "#2a5db0",
  "Residence Hall": "#7a1e29",
  "Apartments": "#a15c1e",
  "Shopping & Dining": "#1f8a5f",
  "Athletics": "#8e44ad",
  "Event Space": "#c77c11",
  "Parking": "#555555",
};

// How far the map's bearing may drift from the user's heading before we
// re-center it, and how far the user must move before a heading reading is
// trusted at all. Both guard against GPS jitter making the map twitch.
const HEADING_MIN_DELTA_DEG = 8;
const HEADING_MIN_MOVE_METERS = 5;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let map;
let userMarker = null;
let destinationMarker = null;
let userLatLng = null;
let watchId = null;
let activeBuilding = null;
let activeCategory = null;
let followUser = true;
let buildingMarkers = [];
let lastUserLatLng = null;
let lastHeading = null;
let mapRotationEnabled = false;
let mapReady = false;
// Edit mode: gates map-building/testing tools (entrance pins, simulated
// location, and more to come) behind the button in the map's top-right.
let editMode = false;
let simulatingLocation = false;
let addingEntrance = false;
let showingOsmPaths = false;

// ---------------------------------------------------------------------------
// Geo helpers (replace Leaflet's LatLng utilities now that we're on MapLibre)
// ---------------------------------------------------------------------------

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function toDeg(rad) {
  return (rad * 180) / Math.PI;
}

function distanceMeters(a, b) {
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Initial great-circle bearing from a to b, in compass degrees (0 = north,
// clockwise). This is what MapLibre's `bearing` camera property expects, so
// no sign-flipping or CSS trickery is needed to make it point "up".
function bearingDegrees(a, b) {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function angularDeltaDeg(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function padBounds(bounds, ratio) {
  const lngPad = (bounds.east - bounds.west) * ratio;
  const latPad = (bounds.north - bounds.south) * ratio;
  return [
    [bounds.west - lngPad, bounds.south - latPad],
    [bounds.east + lngPad, bounds.north + latPad],
  ];
}

function boundsOf(coords) {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  coords.forEach(([lng, lat]) => {
    west = Math.min(west, lng);
    east = Math.max(east, lng);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  });
  return [[west, south], [east, north]];
}

// ---------------------------------------------------------------------------
// Map setup
// ---------------------------------------------------------------------------

function initMap() {
  map = new maplibregl.Map({
    container: "map",
    style: {
      version: 8,
      sources: {
        osm: {
          type: "raster",
          tiles: [
            "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
            "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
            "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
          ],
          tileSize: 256,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        },
      },
      layers: [
        {
          id: "osm-tiles",
          type: "raster",
          source: "osm",
          minzoom: 0,
          maxzoom: 19,
        },
      ],
    },
    center: [CAMPUS_CENTER.lng, CAMPUS_CENTER.lat],
    zoom: DEFAULT_ZOOM,
    maxZoom: 19,
    maxBounds: padBounds(CAMPUS_BOUNDS, 0.25),
    dragRotate: true,
    touchPitch: false,
    pitchWithRotate: false,
    attributionControl: {
      compact: true,
    },
  });

  map.addControl(
    new maplibregl.NavigationControl({
      showCompass: true,
      showZoom: true,
      visualizePitch: false,
    }),
    "bottom-right"
  );

  map.fitBounds(
    [
      [CAMPUS_BOUNDS.west, CAMPUS_BOUNDS.south],
      [CAMPUS_BOUNDS.east, CAMPUS_BOUNDS.north],
    ],
    {
      animate: false,
    }
  );

  // Any manual drag by the user should stop auto-recentering on GPS updates.
  map.on("dragstart", () => {
    followUser = false;
  });

  // Edit-mode tools: click-to-set a pretend location, or click-to-add an
  // entrance. See setSimulatingLocation / setAddingEntrance.
  map.on("click", (e) => {
    if (simulatingLocation) {
      setSimulatedLocation(e.lngLat);
    } else if (addingEntrance) {
      addEntranceAtClick(e.lngLat);
    }
  });

  map.on("load", () => {
    mapReady = true;
    addRouteLayers();
    addAccuracyLayer();
    addOsmPathsLayer();
    addBuildingMarkers();
    buildEntranceMarkers();
  });
}

function buildingMarkerEl(category) {
  const el = document.createElement("span");
  el.className = "building-pin-dot";
  el.style.background = CATEGORY_COLORS[category] || "#7a1e29";
  return el;
}

function addBuildingMarkers() {
  CALVIN_BUILDINGS.forEach((b) => {
    const marker = new maplibregl.Marker({
      element: buildingMarkerEl(b.category),
      anchor: "center",
      rotationAlignment: "viewport",
      pitchAlignment: "viewport",
    })
      .setLngLat([b.lon, b.lat])
      .addTo(map);
    attachHoverPopup(marker, b.name, [0, -12]);
    marker.getElement().addEventListener("click", () => selectBuilding(b));
    marker._buildingId = b.id;
    marker._category = b.category;
    buildingMarkers.push(marker);
  });
}

// Edit-mode tool: a small green dot at every known building entrance, so
// entrance data (js/buildings-data.js's `entrances` arrays) can be eyeballed
// against the map. Built once at load, but only shown while edit mode is on.
let entranceMarkers = [];

// Creates (and tracks) the marker for one entrance. Only actually placed on
// the map right away if edit mode is already on — see setEntranceMarkersVisible.
function addEntranceMarker(building, entrance) {
  const el = document.createElement("span");
  el.className = "entrance-pin-dot";
  const marker = new maplibregl.Marker({
    element: el,
    anchor: "center",
    rotationAlignment: "viewport",
    pitchAlignment: "viewport",
  }).setLngLat([entrance.lon, entrance.lat]);
  attachHoverPopup(marker, `${building.name} — ${entrance.label}`, [0, -10]);
  entranceMarkers.push(marker);
  if (editMode) {
    marker.addTo(map);
  }
  return marker;
}

function buildEntranceMarkers() {
  CALVIN_BUILDINGS.forEach((b) => {
    (b.entrances || []).forEach((entrance) => {
      addEntranceMarker(b, entrance);
    });
  });
}

function setEntranceMarkersVisible(visible) {
  entranceMarkers.forEach((marker) => {
    if (visible) {
      marker.addTo(map);
    } else {
      marker.remove();
    }
  });
}

// Small hover tooltip standing in for Leaflet's bindTooltip.
function attachHoverPopup(marker, text, offset) {
  const popup = new maplibregl.Popup({
    closeButton: false,
    closeOnClick: false,
    offset: offset || [0, -10],
    className: "map-tooltip",
  }).setText(text);
  const el = marker.getElement();
  el.addEventListener("mouseenter", () => popup.setLngLat(marker.getLngLat()).addTo(map));
  el.addEventListener("mouseleave", () => popup.remove());
}

// ---------------------------------------------------------------------------
// Geolocation
// ---------------------------------------------------------------------------

function initGeolocation() {
  if (!("geolocation" in navigator)) {
    showToast("Geolocation isn't supported on this device/browser.");
    return;
  }

  navigator.geolocation.getCurrentPosition(onPosition, onPositionError, {
    enableHighAccuracy: true,
    timeout: 10000,
  });

  watchId = navigator.geolocation.watchPosition(onPosition, onPositionError, {
    enableHighAccuracy: true,
    maximumAge: 5000,
    timeout: 15000,
  });
}

function userMarkerEl() {
  const el = document.createElement("div");
  el.style.width = "18px";
  el.style.height = "18px";
  el.innerHTML = '<span class="user-pin-dot"></span><span class="user-pin-pulse"></span>';
  return el;
}

function onPosition(pos) {
  const { latitude, longitude, accuracy } = pos.coords;
  const newLatLng = {
    lat: latitude,
    lng: longitude,
  };

  const rotateBtn = document.getElementById("rotate-btn");
  if (rotateBtn) {
    rotateBtn.hidden = false;
  }

  // Calculate heading from the last fix, ignoring tiny jitters that GPS
  // noise would otherwise turn into a twitchy map. Real GPS accuracy is
  // often 5-15m (worse near buildings), so two consecutive fixes can drift
  // that far apart from pure noise even while standing still — trusting a
  // fixed small distance regardless of the fix's own reported accuracy is
  // what let single noisy fixes snap the map to a bogus heading. Requiring
  // the move to exceed the fix's own `accuracy` makes the threshold adapt:
  // a sloppy fix needs a correspondingly bigger move before it's believed.
  if (lastUserLatLng) {
    const movedMeters = distanceMeters(lastUserLatLng, newLatLng);
    if (movedMeters > Math.max(HEADING_MIN_MOVE_METERS, accuracy)) {
      const heading = bearingDegrees(lastUserLatLng, newLatLng);
      if (lastHeading === null || angularDeltaDeg(heading, lastHeading) > HEADING_MIN_DELTA_DEG) {
        lastHeading = heading;
        // MapLibre's `bearing` is already "the compass direction shown at
        // the top of the screen," so setting it straight to the heading is
        // what points the user's direction of travel up — no inversion.
        if (followUser && mapRotationEnabled) {
          map.easeTo({
            bearing: lastHeading,
            duration: 300,
          });
        }
      }
    }
  }

  userLatLng = newLatLng;
  lastUserLatLng = newLatLng;

  if (!userMarker) {
    userMarker = new maplibregl.Marker({
      element: userMarkerEl(),
      anchor: "center",
      rotationAlignment: "viewport",
      pitchAlignment: "viewport",
      zIndexOffset: 1000,
    })
      .setLngLat([userLatLng.lng, userLatLng.lat])
      .addTo(map);
    attachHoverPopup(userMarker, "You are here", [0, -14]);
  } else {
    userMarker.setLngLat([userLatLng.lng, userLatLng.lat]);
  }

  updateAccuracyCircle(userLatLng, accuracy);

  if (followUser) {
    map.easeTo({
      center: [userLatLng.lng, userLatLng.lat],
      zoom: Math.max(map.getZoom(), DEFAULT_ZOOM),
      duration: 400,
    });
  }

  // If a destination is already selected, keep the route in sync with movement.
  if (activeBuilding) {
    requestRoute(activeBuilding);
  }
}

function onPositionError(err) {
  console.warn("Geolocation error:", err.message);
  if (err.code === err.PERMISSION_DENIED) {
    showToast("Location access denied. Tap the map to set a starting point.");
    map.once("click", (e) => {
      userLatLng = {
        lat: e.lngLat.lat,
        lng: e.lngLat.lng,
      };
      if (!userMarker) {
        userMarker = new maplibregl.Marker({
          element: userMarkerEl(),
          anchor: "center",
        })
          .setLngLat([userLatLng.lng, userLatLng.lat])
          .addTo(map);
      } else {
        userMarker.setLngLat([userLatLng.lng, userLatLng.lat]);
      }
      if (activeBuilding) {
        requestRoute(activeBuilding);
      }
    });
  } else {
    showToast("Couldn't get your location. You can still browse the map.");
  }
}

document.getElementById("locate-btn").addEventListener("click", () => {
  followUser = true;
  if (userLatLng) {
    map.easeTo({
      center: [userLatLng.lng, userLatLng.lat],
      zoom: DEFAULT_ZOOM,
      duration: 400,
    });
  } else {
    initGeolocation();
  }
});

// ---------------------------------------------------------------------------
// Map rotation toggle (heading-up mode)
// ---------------------------------------------------------------------------

const rotateBtn = document.getElementById("rotate-btn");
if (rotateBtn) {
  rotateBtn.addEventListener("click", () => {
    mapRotationEnabled = !mapRotationEnabled;
    rotateBtn.classList.toggle("active", mapRotationEnabled);

    if (mapRotationEnabled) {
      // Only rotate if we actually have a heading yet — otherwise leave the
      // bearing alone rather than snapping it to 0. (onPosition will rotate
      // to the real heading once one is computed.)
      if (lastHeading !== null) {
        map.easeTo({
          bearing: lastHeading,
          duration: 300,
        });
      }
    } else {
      map.easeTo({
        bearing: 0,
        duration: 300,
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Simulated location (edit-mode tool). Lets you test routing/entrance-
// picking from a computer without real GPS: arm it, then click anywhere on
// the map to pretend you're there.
// ---------------------------------------------------------------------------

const SIMULATED_ACCURACY_METERS = 15;

function setSimulatedLocation(lngLat) {
  userLatLng = {
    lat: lngLat.lat,
    lng: lngLat.lng,
  };

  if (!userMarker) {
    userMarker = new maplibregl.Marker({
      element: userMarkerEl(),
      anchor: "center",
      rotationAlignment: "viewport",
      pitchAlignment: "viewport",
      zIndexOffset: 1000,
    })
      .setLngLat([userLatLng.lng, userLatLng.lat])
      .addTo(map);
    attachHoverPopup(userMarker, "You are here (simulated)", [0, -14]);
  } else {
    userMarker.setLngLat([userLatLng.lng, userLatLng.lat]);
  }

  updateAccuracyCircle(userLatLng, SIMULATED_ACCURACY_METERS);

  if (activeBuilding) {
    requestRoute(activeBuilding);
  }
}

const simulateLocationBtn = document.getElementById("simulate-location-btn");

function setSimulatingLocation(enabled) {
  simulatingLocation = enabled;
  simulateLocationBtn.classList.toggle("active", simulatingLocation);
  map.getCanvas().style.cursor = simulatingLocation ? "crosshair" : "";

  if (simulatingLocation) {
    if (addingEntrance) {
      setAddingEntrance(false);
    }
    followUser = false;
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
    showToast("Click anywhere on the map to set your pretend location.");
  } else {
    showToast("Back to using your real location.");
    initGeolocation();
  }
}

if (simulateLocationBtn) {
  simulateLocationBtn.addEventListener("click", () => {
    setSimulatingLocation(!simulatingLocation);
  });
}

// ---------------------------------------------------------------------------
// Add entrance (edit-mode tool). Arm it, pick the target building from the
// dropdown that appears, then click the map to append a new entrance to it.
// No auto-guessing which building a click belongs to — you always pick.
// Entrances only exist in the browser's copy of CALVIN_BUILDINGS until
// exported — see the "Download buildings-data.js" tool below.
// ---------------------------------------------------------------------------

const entranceBuildingSelect = document.getElementById("entrance-building-select");
if (entranceBuildingSelect) {
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Choose a building…";
  entranceBuildingSelect.appendChild(placeholder);

  CALVIN_BUILDINGS.slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((b) => {
      const option = document.createElement("option");
      option.value = b.id;
      option.textContent = b.name;
      entranceBuildingSelect.appendChild(option);
    });
}

// Picks "Entrance N" for the next auto-numbered entrance on a building,
// continuing past whatever entrance-N ids it already has (e.g. skips past
// any OSM-sourced ones) rather than always starting back at 1.
function nextAutoEntranceNumber(building) {
  const nums = (building.entrances || []).map((e) => {
    const m = /^entrance-(\d+)$/.exec(e.id);
    return m ? parseInt(m[1], 10) : 0;
  });
  return nums.length > 0 ? Math.max(...nums) + 1 : 1;
}

function addEntranceAtClick(lngLat) {
  const buildingId = entranceBuildingSelect.value;
  if (!buildingId) {
    showToast("Choose a building from the dropdown first.");
    return;
  }
  const building = CALVIN_BUILDINGS.find((b) => b.id === buildingId);
  if (!building) {
    return;
  }

  const n = nextAutoEntranceNumber(building);
  const entrance = {
    id: `entrance-${n}`,
    label: `Entrance ${n}`,
    lat: lngLat.lat,
    lon: lngLat.lng,
  };

  if (!building.entrances) {
    building.entrances = [];
  }
  building.entrances.push(entrance);
  addEntranceMarker(building, entrance);

  showToast(`Added "${entrance.label}" to ${building.name}. Download buildings-data.js when you're done.`);
}

const addEntranceBtn = document.getElementById("add-entrance-btn");

function setAddingEntrance(enabled) {
  addingEntrance = enabled;
  addEntranceBtn.classList.toggle("active", addingEntrance);
  entranceBuildingSelect.hidden = !addingEntrance;
  map.getCanvas().style.cursor = addingEntrance ? "crosshair" : "";

  if (addingEntrance) {
    if (simulatingLocation) {
      setSimulatingLocation(false);
    }
    entranceBuildingSelect.value = "";
    showToast("Pick a building, then click the map to add its entrance.");
  }
}

if (addEntranceBtn) {
  addEntranceBtn.addEventListener("click", () => {
    setAddingEntrance(!addingEntrance);
  });
}

// ---------------------------------------------------------------------------
// Download buildings-data.js (edit-mode tool). Regenerates js/buildings-
// data.js's exact file format from the live, in-browser CALVIN_BUILDINGS —
// including anything added above — as a file ready to replace the one on
// disk.
// ---------------------------------------------------------------------------

function formatEntranceRecord(e) {
  const preferred = e.preferred ? `, "preferred": true` : "";
  return `      { "id": ${JSON.stringify(e.id)}, "label": ${JSON.stringify(e.label)}, "lat": ${e.lat}, "lon": ${e.lon}${preferred} }`;
}

function formatBuildingRecord(b) {
  const lines = [];
  lines.push("  {");
  lines.push(`    "id": ${JSON.stringify(b.id)},`);
  lines.push(`    "name": ${JSON.stringify(b.name)},`);
  lines.push(`    "aliases": [${(b.aliases || []).map((a) => JSON.stringify(a)).join(", ")}],`);
  lines.push(`    "category": ${JSON.stringify(b.category)},`);
  lines.push(`    "lat": ${b.lat},`);
  const hasNote = Object.prototype.hasOwnProperty.call(b, "note");
  lines.push(`    "lon": ${b.lon},`);
  if (!b.entrances || b.entrances.length === 0) {
    lines.push(`    "entrances": []${hasNote ? "," : ""}`);
  } else {
    lines.push(`    "entrances": [`);
    lines.push(b.entrances.map(formatEntranceRecord).join(",\n"));
    lines.push(`    ]${hasNote ? "," : ""}`);
  }
  if (hasNote) {
    lines.push(`    "note": ${JSON.stringify(b.note)}`);
  }
  lines.push("  }");
  return lines.join("\n");
}

function serializeBuildingsData() {
  return "const CALVIN_BUILDINGS = [\n" + CALVIN_BUILDINGS.map(formatBuildingRecord).join(",\n") + "\n]\n;\n";
}

const downloadDataBtn = document.getElementById("download-data-btn");
if (downloadDataBtn) {
  downloadDataBtn.addEventListener("click", () => {
    const blob = new Blob([serializeBuildingsData()], {
      type: "text/javascript",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "buildings-data.js";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast("Downloaded buildings-data.js — replace js/buildings-data.js with it.");
  });
}

// ---------------------------------------------------------------------------
// Edit mode toggle
// ---------------------------------------------------------------------------

const editModeBtn = document.getElementById("edit-mode-btn");

function setEditMode(enabled) {
  editMode = enabled;
  editModeBtn.classList.toggle("active", editMode);

  setEntranceMarkersVisible(editMode);

  simulateLocationBtn.hidden = !editMode;
  addEntranceBtn.hidden = !editMode;
  downloadDataBtn.hidden = !editMode;
  showOsmPathsBtn.hidden = !editMode;

  if (!editMode) {
    if (simulatingLocation) {
      setSimulatingLocation(false);
    }
    if (addingEntrance) {
      setAddingEntrance(false);
    }
    if (showingOsmPaths) {
      setShowingOsmPaths(false);
    }
  }
}

if (editModeBtn) {
  editModeBtn.addEventListener("click", () => {
    setEditMode(!editMode);
  });
}

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
      selectBuilding(b);
      searchInput.value = b.name;
      searchResultsEl.hidden = true;
      searchInput.blur();
    });
    searchResultsEl.appendChild(li);
  });
  searchResultsEl.hidden = false;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

searchInput.addEventListener("input", () => {
  const val = searchInput.value;
  searchClearBtn.hidden = val.length === 0;
  renderResults(searchBuildings(val));
});

searchInput.addEventListener("focus", () => {
  if (searchInput.value) {
    renderResults(searchBuildings(searchInput.value));
  }
});

searchForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const results = searchBuildings(searchInput.value);
  if (results.length > 0) {
    selectBuilding(results[0]);
    searchInput.value = results[0].name;
    searchResultsEl.hidden = true;
    searchInput.blur();
  }
});

searchClearBtn.addEventListener("click", () => {
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
  showRoutePanel(building);
  requestRoute(building);
}

async function requestRoute(building) {
  const entrance = nearestEntrance(building, userLatLng);
  placeDestinationMarker(entrance);

  if (!userLatLng) {
    setRouteWarning("Waiting for your location… showing destination only.");
    clearRouteLine();
    map.easeTo({
      center: [entrance.lon, entrance.lat],
      zoom: DEFAULT_ZOOM,
      duration: 400,
    });
    return;
  }

  const url =
    `${OSRM_FOOT_URL}${userLatLng.lng},${userLatLng.lat};${entrance.lon},${entrance.lat}` +
    `?overview=full&geometries=geojson`;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      throw new Error(`Routing service returned ${res.status}`);
    }
    const data = await res.json();
    if (data.code !== "Ok" || !data.routes || data.routes.length === 0) {
      throw new Error("No walking route found");
    }
    const route = data.routes[0];
    const coords = route.geometry.coordinates; // already [lng, lat] pairs
    drawRoute(coords, false);
    updateRouteStats(route.distance, route.duration, false);
    fitRouteBounds(coords);
  } catch (err) {
    console.warn("Routing failed, falling back to straight line:", err);
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
    updateRouteStats(meters, estSeconds, true);
    fitRouteBounds(straight);
  }
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
  map.fitBounds(boundsOf(coords), {
    padding: 60,
    maxZoom: 18,
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

function updateRouteStats(meters, seconds, isFallback) {
  const statsEl = document.getElementById("route-stats");
  statsEl.textContent = `${formatDistance(meters)} · about ${formatDuration(seconds)} walking`;
  setRouteWarning(
    isFallback
      ? "No mapped walking path found — showing a straight-line estimate."
      : null
  );
}

function setRouteWarning(message) {
  const warnEl = document.getElementById("route-warning");
  if (message) {
    warnEl.textContent = message;
    warnEl.hidden = false;
  } else {
    warnEl.hidden = true;
  }
}

function showRoutePanel(building) {
  const panel = document.getElementById("route-panel");
  document.getElementById("route-destination").textContent = building.name;
  document.getElementById("route-stats").textContent = "Calculating route…";
  setRouteWarning(null);
  panel.hidden = false;
}

document.getElementById("route-close").addEventListener("click", () => {
  document.getElementById("route-panel").hidden = true;
  if (destinationMarker) {
    destinationMarker.remove();
    destinationMarker = null;
  }
  clearRouteLine();
  activeBuilding = null;
  searchInput.value = "";
});

// ---------------------------------------------------------------------------
// User accuracy circle
// ---------------------------------------------------------------------------

function addAccuracyLayer() {
  map.addSource("user-accuracy", {
    type: "geojson",
    data: {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [0, 0],
      },
    },
  });
  map.addLayer({
    id: "user-accuracy-circle",
    type: "circle",
    source: "user-accuracy",
    paint: {
      "circle-radius": 0,
      "circle-color": "#2a7de1",
      "circle-opacity": 0.12,
      "circle-stroke-color": "#2a7de1",
      "circle-stroke-width": 1,
      "circle-stroke-opacity": 0.9,
    },
  });
}

// Web Mercator meters-per-pixel at a given zoom/latitude, used to size the
// accuracy circle in real-world meters rather than fixed screen pixels.
function metersPerPixel(zoom, latitude) {
  return (156543.03392 * Math.cos(toRad(latitude))) / Math.pow(2, zoom);
}

// ---------------------------------------------------------------------------
// OSM paths overlay (edit-mode tool). Draws OpenStreetMap's current
// footway/path network for campus, fetched live from the Overpass API, so
// gaps — paths that exist on the ground but aren't mapped (and so aren't
// routable) — are visible without leaving the app. Read-only: this app has
// no path data of its own to edit. Fixing a gap means adding the path in
// OpenStreetMap itself, e.g. via the iD editor at openstreetmap.org/edit;
// routing.openstreetmap.de then needs its own time to pick up that edit.
// ---------------------------------------------------------------------------

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const OSM_PATH_HIGHWAY_TYPES = ["footway", "path", "pedestrian", "steps", "cycleway"];

let osmPathsGeoJSON = null; // cached after first successful fetch
let osmPathsLoading = false;

function addOsmPathsLayer() {
  map.addSource("osm-paths", {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: [],
    },
  });
  map.addLayer({
    id: "osm-paths-line",
    type: "line",
    source: "osm-paths",
    layout: {
      "line-cap": "round",
      "line-join": "round",
      visibility: "none",
    },
    paint: {
      "line-color": "#00b8d9",
      "line-width": 3,
      "line-opacity": 0.9,
      "line-dasharray": [1, 1.5],
    },
  });
}

async function fetchOsmPaths() {
  const highwayPattern = OSM_PATH_HIGHWAY_TYPES.join("|");
  const query =
    `[out:json][timeout:25];` +
    `way["highway"~"^(${highwayPattern})$"]` +
    `(${CAMPUS_BOUNDS.south},${CAMPUS_BOUNDS.west},${CAMPUS_BOUNDS.north},${CAMPUS_BOUNDS.east});` +
    `out geom;`;

  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `data=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    throw new Error(`Overpass returned ${res.status}`);
  }
  const data = await res.json();

  return {
    type: "FeatureCollection",
    features: (data.elements || [])
      .filter((el) => el.type === "way" && el.geometry)
      .map((el) => ({
        type: "Feature",
        properties: {
          highway: el.tags && el.tags.highway,
        },
        geometry: {
          type: "LineString",
          coordinates: el.geometry.map((p) => [p.lon, p.lat]),
        },
      })),
  };
}

const showOsmPathsBtn = document.getElementById("show-osm-paths-btn");

async function setShowingOsmPaths(enabled) {
  showingOsmPaths = enabled;
  showOsmPathsBtn.classList.toggle("active", showingOsmPaths);
  map.setLayoutProperty("osm-paths-line", "visibility", showingOsmPaths ? "visible" : "none");

  if (!showingOsmPaths || osmPathsGeoJSON || osmPathsLoading) {
    return;
  }

  osmPathsLoading = true;
  showToast("Loading OpenStreetMap's paths…");
  try {
    osmPathsGeoJSON = await fetchOsmPaths();
    map.getSource("osm-paths").setData(osmPathsGeoJSON);
    showToast(`Loaded ${osmPathsGeoJSON.features.length} mapped path(s) from OpenStreetMap.`);
  } catch (err) {
    console.warn("Failed to load OSM paths:", err);
    showToast("Couldn't load OSM paths — Overpass may be busy. Try again in a bit.");
    showingOsmPaths = false;
    showOsmPathsBtn.classList.remove("active");
    map.setLayoutProperty("osm-paths-line", "visibility", "none");
  } finally {
    osmPathsLoading = false;
  }
}

if (showOsmPathsBtn) {
  showOsmPathsBtn.addEventListener("click", () => {
    setShowingOsmPaths(!showingOsmPaths);
  });
}

function updateAccuracyCircle(latLng, accuracyMeters) {
  if (!mapReady) {
    return;
  }
  map.getSource("user-accuracy").setData({
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [latLng.lng, latLng.lat],
    },
  });
  const pixelsAtZoom20 = accuracyMeters / metersPerPixel(20, latLng.lat);
  map.setPaintProperty("user-accuracy-circle", "circle-radius", [
    "interpolate", ["exponential", 2], ["zoom"],
    0, 0,
    20, pixelsAtZoom20,
  ]);
}

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------

let toastTimer = null;
function showToast(message, duration = 4000) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, duration);
}

// ---------------------------------------------------------------------------
// Service worker registration
// ---------------------------------------------------------------------------

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("service-worker.js").catch((err) => {
        console.warn("Service worker registration failed:", err);
      });
    });
  }
}

// Dev label (top bar, right of search): shows the cache version the
// currently-controlling service worker reports, so stale-cache issues are
// visible at a glance instead of only discovered by a feature not working.
function requestServiceWorkerVersion() {
  const label = document.getElementById("sw-version");
  if (!label || !("serviceWorker" in navigator)) {
    return;
  }

  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data && event.data.type === "sw-version") {
      label.textContent = `${event.data.version}`;
      label.hidden = false;
    }
  });

  function ask() {
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: "get-version" });
    }
  }

  navigator.serviceWorker.addEventListener("controllerchange", ask);
  navigator.serviceWorker.ready.then(ask);
  ask();
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

initMap();
initCategoryChips();
initGeolocation();
registerServiceWorker();
requestServiceWorkerVersion();
