"use strict";

// ---------------------------------------------------------------------------
// Debug log capture (edit-mode tool). Mirrors console.log/warn/error into an
// in-memory buffer so it can be viewed and copied directly on a phone, no
// cable needed — see setShowingDebugConsole in edit-mode.js. Wrapped as early
// as possible in the file so nothing logged before the panel is ever opened
// gets missed; the real console methods still run as normal.
// ---------------------------------------------------------------------------

const DEBUG_LOG_MAX_ENTRIES = 300;
const debugLog = [];

function captureConsole(level, args) {
  const text = args
    .map((a) => {
      if (a instanceof Error) {
        // Chrome's Error.stack repeats "Name: message" as its first line;
        // Safari's doesn't include the message at all, just stack frames —
        // so preferring .stack alone silently drops the actual error text
        // on iOS. Always lead with .message, append .stack as detail.
        const stack = a.stack && a.stack !== a.message ? `\n${a.stack}` : "";
        return `${a.message || String(a)}${stack}`;
      }
      if (a !== null && typeof a === "object") {
        try {
          return JSON.stringify(a);
        } catch (err) {
          return String(a);
        }
      }
      return String(a);
    })
    .join(" ");

  const entry = {
    level,
    text,
    time: new Date(),
  };
  debugLog.push(entry);
  if (debugLog.length > DEBUG_LOG_MAX_ENTRIES) {
    debugLog.shift();
  }
  if (typeof renderDebugLogEntry === "function") {
    renderDebugLogEntry(entry);
  }
}

["log", "warn", "error"].forEach((level) => {
  const original = console[level].bind(console);
  console[level] = (...args) => {
    original(...args);
    captureConsole(level, args);
  };
});

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

// How often onPosition is allowed to re-request a route just because a new
// GPS fix arrived (not because the user did something). watchPosition can
// fire far faster than this — sometimes multiple times a second — and
// without a limit, every single fix fired its own routing request with no
// regard for whether the previous one had even finished, flooding the
// browser's per-origin connection limit and making requests abort each
// other out. A route is re-fetched once at least this much time OR this
// much movement has happened since the last fetch, whichever comes first.
const ROUTE_REFRESH_MIN_INTERVAL_MS = 4000;
const ROUTE_REFRESH_MIN_MOVE_METERS = 15;

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
let lastPositionTimestamp = null;
let lastRouteRequestAt = 0;
let lastRouteRequestLatLng = null;
let mapRotationEnabled = false;
let mapReady = false;
// Edit mode: gates map-building/testing tools (entrance pins, simulated
// location, and more to come) behind the button in the map's top-right.
let editMode = false;
let simulatingLocation = false;
let addingEntrance = false;
let showingOsmPaths = false;
let showingDebugConsole = false;

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
// Small shared DOM/UI utilities
// ---------------------------------------------------------------------------

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

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
