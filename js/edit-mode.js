"use strict";

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
// Debug console (edit-mode tool). See the capture setup in core.js for how
// entries get into `debugLog` in the first place.
// ---------------------------------------------------------------------------

const debugConsolePanel = document.getElementById("debug-console-panel");
const debugConsoleLogEl = document.getElementById("debug-console-log");
const debugConsoleBtn = document.getElementById("debug-console-btn");

function formatDebugTime(date) {
  return date.toTimeString().slice(0, 8);
}

// Appends one entry to the on-screen panel (only does DOM work while the
// panel is actually open — captureConsole still buffers every entry
// regardless, so opening the panel later shows history via renderDebugLog).
function renderDebugLogEntry(entry) {
  if (!debugConsoleLogEl || debugConsolePanel.hidden) {
    return;
  }
  const line = document.createElement("div");
  line.className = `debug-log-entry ${entry.level}`;
  line.innerHTML =
    `<span class="debug-log-time">${formatDebugTime(entry.time)}</span>` + escapeHtml(entry.text);
  debugConsoleLogEl.appendChild(line);
  debugConsoleLogEl.scrollTop = debugConsoleLogEl.scrollHeight;
}

function renderDebugLog() {
  if (!debugConsoleLogEl) {
    return;
  }
  debugConsoleLogEl.innerHTML = "";
  debugLog.forEach((entry) => {
    const line = document.createElement("div");
    line.className = `debug-log-entry ${entry.level}`;
    line.innerHTML =
      `<span class="debug-log-time">${formatDebugTime(entry.time)}</span>` + escapeHtml(entry.text);
    debugConsoleLogEl.appendChild(line);
  });
  debugConsoleLogEl.scrollTop = debugConsoleLogEl.scrollHeight;
}

function setShowingDebugConsole(enabled) {
  showingDebugConsole = enabled;
  debugConsoleBtn.classList.toggle("active", showingDebugConsole);
  debugConsolePanel.hidden = !showingDebugConsole;
  if (showingDebugConsole) {
    renderDebugLog();
  }
}

if (debugConsoleBtn) {
  debugConsoleBtn.addEventListener("click", () => {
    setShowingDebugConsole(!showingDebugConsole);
  });
}

const debugConsoleCloseBtn = document.getElementById("debug-console-close");
if (debugConsoleCloseBtn) {
  debugConsoleCloseBtn.addEventListener("click", () => setShowingDebugConsole(false));
}

const debugConsoleClearBtn = document.getElementById("debug-console-clear");
if (debugConsoleClearBtn) {
  debugConsoleClearBtn.addEventListener("click", () => {
    debugLog.length = 0;
    renderDebugLog();
  });
}

const debugConsoleCopyBtn = document.getElementById("debug-console-copy");
if (debugConsoleCopyBtn) {
  debugConsoleCopyBtn.addEventListener("click", async () => {
    const text = debugLog
      .map((entry) => `[${formatDebugTime(entry.time)}] ${entry.level.toUpperCase()}: ${entry.text}`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text || "(no log entries yet)");
      showToast("Logs copied to clipboard.");
    } catch (err) {
      showToast("Couldn't copy — clipboard access may be blocked.");
    }
  });
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
  debugConsoleBtn.hidden = !editMode;

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
    if (showingDebugConsole) {
      setShowingDebugConsole(false);
    }
  }
}

if (editModeBtn) {
  editModeBtn.addEventListener("click", () => {
    setEditMode(!editMode);
  });
}
