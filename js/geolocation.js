"use strict";

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

// Shared by both heading sources in onPosition (device-reported and our own
// movement-derived fallback): only actually rotates the map if the candidate
// differs enough from the last accepted heading, so ordinary jitter doesn't
// make the map twitch. Returns the accepted heading, or null if rejected —
// the caller folds this into a single map.easeTo() call alongside any
// followUser recenter (see onPosition below).
//
// MapLibre's `bearing` is already "the compass direction shown at the top of
// the screen," so setting it straight to the heading is what points the
// user's direction of travel up — no inversion.
function acceptHeadingCandidate(candidate) {
  const delta = lastHeading === null ? null : angularDeltaDeg(candidate, lastHeading);
  if (lastHeading === null || delta > HEADING_MIN_DELTA_DEG) {
    lastHeading = candidate;
    return lastHeading;
  }
  return null;
}

function onPosition(pos) {
  const { latitude, longitude, accuracy } = pos.coords;
  const newLatLng = {
    lat: latitude,
    lng: longitude,
  };

  // navigator.geolocation.getCurrentPosition() and watchPosition() (both
  // wired to this same callback, in initGeolocation) aren't guaranteed to
  // deliver fixes in chronological order — a slower/cached fix can arrive
  // after a newer one. An out-of-order fix processed as if it were the
  // latest would compute a heading pointing backward along the true path of
  // travel. Discard anything not strictly newer than what we've already
  // processed.
  if (lastPositionTimestamp !== null && pos.timestamp <= lastPositionTimestamp) {
    return;
  }
  lastPositionTimestamp = pos.timestamp;

  const rotateBtn = document.getElementById("rotate-btn");
  if (rotateBtn) {
    rotateBtn.hidden = false;
  }

  // Heading is only tracked at all while rotation mode is actually on —
  // turning it off forgets lastHeading/lastUserLatLng entirely (see the
  // rotate button handler below) so there's nothing stale to resume from.
  // Any accepted heading is collected here rather than applied immediately —
  // see the single merged map.easeTo() call below for why.
  let newBearing = null;

  if (mapRotationEnabled) {
    const deviceHeading = pos.coords.heading;
    const hasDeviceHeading = typeof deviceHeading === "number" && !Number.isNaN(deviceHeading);

    if (hasDeviceHeading) {
      // Modern phones report this from sensor fusion (GPS + compass +
      // motion), refreshed far more often internally than our once-a-second
      // fixes, and is much less noisy than deriving a bearing ourselves out
      // of two GPS fixes only a few meters apart.
      newBearing = acceptHeadingCandidate(deviceHeading);
      // Keep the fallback anchor fresh in case device heading disappears later.
      lastUserLatLng = newLatLng;
    } else if (lastUserLatLng) {
      const movedMeters = distanceMeters(lastUserLatLng, newLatLng);
      const threshold = Math.max(HEADING_MIN_MOVE_METERS, accuracy);
      if (movedMeters > threshold) {
        newBearing = acceptHeadingCandidate(bearingDegrees(lastUserLatLng, newLatLng));
        // Only advance the anchor once real movement has actually been
        // measured against it — otherwise tiny per-fix jitter keeps
        // resetting the baseline before genuine cumulative movement (across
        // several small, individually-below-threshold fixes) ever gets the
        // chance to cross the threshold.
        lastUserLatLng = newLatLng;
      }
    } else {
      lastUserLatLng = newLatLng;
    }
  }

  userLatLng = newLatLng;

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

  // Recenter on every fix whenever followUser is on, AND whenever rotation
  // mode is on regardless of followUser. Rotation mode is a "heading-up
  // navigation" mode — the map is meant to pivot around you — but followUser
  // gets set false the moment a route is selected (see fitRouteBounds) and
  // otherwise only stays on until your first manual drag. Without this,
  // once a route was active, the camera only recentered when the route
  // periodically refetched/refit (ROUTE_REFRESH_MIN_INTERVAL_MS/METERS in
  // the block below) — bearing kept updating every fix in between, but the
  // geographic center didn't move, so the map rotated around a point that
  // was no longer where you actually were. That's what pushed the user
  // marker off-screen while walking an active route with rotation on.
  const shouldRecenter = followUser || mapRotationEnabled;

  // Deliberately ONE map.easeTo() call per fix, not two (recenter and
  // rotate separately). easeTo() options you don't mention default to the
  // map's *current* value at call time — issuing two calls back to back in
  // the same tick means the second one's "current bearing" is still the OLD
  // pre-fix value (no animation frame has rendered yet), so it would
  // silently cancel a rotation the first call had just requested. Folding
  // both into one call removes that collision entirely.
  if (shouldRecenter || newBearing !== null) {
    const easeOptions = {
      duration: shouldRecenter ? 400 : 300,
    };
    if (shouldRecenter) {
      easeOptions.center = [userLatLng.lng, userLatLng.lat];
      easeOptions.zoom = Math.max(map.getZoom(), DEFAULT_ZOOM);
    }
    if (newBearing !== null) {
      easeOptions.bearing = newBearing;
    }
    map.easeTo(easeOptions);
  }

  // If a destination is already selected, keep the route in sync with
  // movement — but only as often as ROUTE_REFRESH_MIN_INTERVAL_MS/METERS
  // allow, since GPS fixes can arrive far faster than that. Explicit user
  // actions (selectBuilding, simulate-location) call requestRoute directly
  // and skip this throttle entirely — it only paces the passive "you moved"
  // trigger.
  if (activeBuilding) {
    const sinceLastMs = Date.now() - lastRouteRequestAt;
    const movedSinceLastRoute = lastRouteRequestLatLng
      ? distanceMeters(lastRouteRequestLatLng, userLatLng)
      : Infinity;
    if (sinceLastMs > ROUTE_REFRESH_MIN_INTERVAL_MS || movedSinceLastRoute > ROUTE_REFRESH_MIN_MOVE_METERS) {
      requestRoute(activeBuilding);
    }
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
// Guards against duplicate/"ghost" click events some mobile browsers can
// fire for a single tap (a real, documented touch-event quirk) — a second
// click arriving implausibly soon after one we already processed is
// discarded rather than toggling the state right back.
let lastRotateClickProcessedAt = 0;
const ROTATE_CLICK_DEBOUNCE_MS = 400;
if (rotateBtn) {
  rotateBtn.addEventListener("click", () => {
    const now = performance.now();
    if (now - lastRotateClickProcessedAt < ROTATE_CLICK_DEBOUNCE_MS) {
      return;
    }
    lastRotateClickProcessedAt = now;

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
      // Forget the old heading entirely rather than freezing it — turning
      // rotation back on later should wait for a fresh, current reading
      // instead of resuming with whatever direction you happened to be
      // facing last time it was on.
      lastHeading = null;
      lastUserLatLng = null;
    }
  });
}

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
