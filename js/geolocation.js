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
// followUser recenter (see the big comment on that in onPosition below);
// this function deliberately does NOT call easeTo itself anymore.
//
// MapLibre's `bearing` is already "the compass direction shown at the top of
// the screen," so setting it straight to the heading is what points the
// user's direction of travel up — no inversion. Rotation is controlled by
// the rotate button alone (mapRotationEnabled, already gating the caller) —
// it used to also require followUser, a separate "auto-recenter on me" flag
// that turns false the moment you drag the map or select a route. That meant
// heading was tracking correctly in the background the whole time, but the
// map would just silently never rotate to show it whenever followUser
// happened to be off, with no indication why. ON means rotated, full stop,
// regardless of followUser.
function acceptHeadingCandidate(candidate) {
  const delta = lastHeading === null ? null : angularDeltaDeg(candidate, lastHeading);
  console.log(
    `[heading] candidate=${candidate.toFixed(1)}° lastHeading=${lastHeading === null ? "null" : lastHeading.toFixed(1) + "°"} ` +
      `delta=${delta === null ? "n/a" : delta.toFixed(1) + "°"}`
  );
  if (lastHeading === null || delta > HEADING_MIN_DELTA_DEG) {
    lastHeading = candidate;
    console.log(`[heading] ACCEPTED heading=${candidate.toFixed(1)}°`);
    return lastHeading;
  }
  console.log(`[heading] rejected — delta ${delta.toFixed(1)}° <= ${HEADING_MIN_DELTA_DEG}°`);
  return null;
}

function onPosition(pos) {
  const { latitude, longitude, accuracy } = pos.coords;
  const newLatLng = {
    lat: latitude,
    lng: longitude,
  };

  console.log(
    `[heading] fix: lat=${latitude.toFixed(6)} lng=${longitude.toFixed(6)} ` +
      `accuracy=${accuracy.toFixed(1)}m ts=${pos.timestamp}`
  );

  // navigator.geolocation.getCurrentPosition() and watchPosition() (both
  // wired to this same callback, in initGeolocation) aren't guaranteed to
  // deliver fixes in chronological order — a slower/cached fix can arrive
  // after a newer one. An out-of-order fix processed as if it were the
  // latest would compute a heading pointing backward along the true path
  // of travel, which is exactly what "the map rotates back after a step or
  // two" looks like. Discard anything not strictly newer than what we've
  // already processed.
  if (lastPositionTimestamp !== null && pos.timestamp <= lastPositionTimestamp) {
    console.log(`[heading] IGNORED — out of order (ts ${pos.timestamp} <= last processed ${lastPositionTimestamp})`);
    return;
  }
  lastPositionTimestamp = pos.timestamp;

  const rotateBtn = document.getElementById("rotate-btn");
  if (rotateBtn) {
    rotateBtn.hidden = false;
  }

  // Heading is only tracked at all while rotation mode is actually on. It
  // used to keep recalculating in the background even while off — invisibly,
  // since nothing was displaying it — using noisy GPS course-over-ground at
  // walking pace, so by the time you turned rotation back on it could snap
  // straight to a stale value you never saw it drift to. That looked exactly
  // like "the map rotates back" even though, technically, nothing was
  // rotating while off. Simple rule now: off means off, full stop — no
  // computation, no drift, nothing to snap to later.
  // Any accepted heading is collected here rather than applied immediately —
  // see the single merged map.easeTo() call below for why.
  let newBearing = null;

  if (mapRotationEnabled) {
    const deviceHeading = pos.coords.heading;
    const hasDeviceHeading = typeof deviceHeading === "number" && !Number.isNaN(deviceHeading);

    if (hasDeviceHeading) {
      // Modern phones report this from sensor fusion (GPS + compass +
      // motion), refreshed far more often internally than our once-a-second
      // fixes. Preferring it avoids the wide swings that came from deriving
      // a bearing ourselves out of two GPS fixes only a few meters apart,
      // where ordinary GPS accuracy (several meters here) can throw a
      // short-baseline angle off by tens of degrees — that's what made the
      // map visibly wobble/spin while "on" even though the button itself
      // never toggled.
      console.log(`[heading] using device-reported heading=${deviceHeading.toFixed(1)}°`);
      newBearing = acceptHeadingCandidate(deviceHeading);
      // Keep the fallback anchor fresh in case device heading disappears later.
      lastUserLatLng = newLatLng;
    } else if (lastUserLatLng) {
      const movedMeters = distanceMeters(lastUserLatLng, newLatLng);
      const threshold = Math.max(HEADING_MIN_MOVE_METERS, accuracy);
      console.log(`[heading] no device heading; movedMeters=${movedMeters.toFixed(1)} threshold=${threshold.toFixed(1)}`);
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

  // Deliberately ONE map.easeTo() call per fix, not two. This used to be two
  // separate calls — one here for center/zoom recenter, one above for the
  // rotation bearing — issued back to back in the same synchronous tick.
  // Since easeTo() options you don't mention default to the map's *current*
  // value at call time, and this second call ran before the first one had
  // ever rendered a single animation frame, "current bearing" here always
  // meant the OLD pre-fix bearing — so this recenter call silently
  // overwrote/cancelled the rotation that had just been requested a few
  // lines earlier, on every single fix, unconditionally. That's a much
  // better fit for "it rotates and then snaps back" than anything fixed so
  // far: confirmed by directly driving onPosition() with synthetic fixes a
  // realistic ~1s apart and watching the map's bearing stay pinned at its
  // starting value indefinitely despite lastHeading advancing correctly
  // fix after fix. Folding both into one call removes the collision.
  if (followUser || newBearing !== null) {
    const easeOptions = {
      duration: followUser ? 400 : 300,
    };
    if (followUser) {
      easeOptions.center = [userLatLng.lng, userLatLng.lat];
      easeOptions.zoom = Math.max(map.getZoom(), DEFAULT_ZOOM);
    }
    if (newBearing !== null) {
      easeOptions.bearing = newBearing;
      console.log(`[heading] map.easeTo bearing=${newBearing.toFixed(1)}° (from onPosition${followUser ? ", merged with recenter" : ""})`);
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
// fire for a single tap (a real, documented touch-event quirk, not user
// error) — a second click arriving implausibly soon after one we already
// processed is discarded rather than toggling the state right back.
let lastRotateClickProcessedAt = 0;
const ROTATE_CLICK_DEBOUNCE_MS = 400;
// Click events don't carry pointer info themselves; capture it separately so
// a future "I didn't click that" report can distinguish a real finger/stylus
// tap (pointerType "touch"/"pen", plausible on-button coordinates) from
// something else entirely (e.g. a keyboard-triggered activation has no
// preceding pointerdown at all).
let lastRotatePointerInfo = "none (no preceding pointerdown — keyboard/synthetic?)";
if (rotateBtn) {
  rotateBtn.addEventListener("pointerdown", (event) => {
    lastRotatePointerInfo = `pointerType=${event.pointerType} x=${event.clientX.toFixed(0)} y=${event.clientY.toFixed(0)}`;
  });
  rotateBtn.addEventListener("click", (event) => {
    const now = performance.now();
    console.log(
      `[heading] rotate button click event: isTrusted=${event.isTrusted} detail=${event.detail} ` +
        `timeStamp=${event.timeStamp.toFixed(0)} msSinceLastProcessed=${(now - lastRotateClickProcessedAt).toFixed(0)} ` +
        `pointer=[${lastRotatePointerInfo}]`
    );
    // Reset so a later click's diagnostic can't be misread as touch-backed
    // just because an earlier, already-explained click happened to be.
    lastRotatePointerInfo = "none (no preceding pointerdown — keyboard/synthetic?)";
    if (now - lastRotateClickProcessedAt < ROTATE_CLICK_DEBOUNCE_MS) {
      console.log(`[heading] IGNORED — arrived within ${ROTATE_CLICK_DEBOUNCE_MS}ms of the last processed click`);
      return;
    }
    lastRotateClickProcessedAt = now;

    mapRotationEnabled = !mapRotationEnabled;
    rotateBtn.classList.toggle("active", mapRotationEnabled);
    console.log(`[heading] rotate button clicked -> mapRotationEnabled=${mapRotationEnabled}, lastHeading=${lastHeading === null ? "null" : lastHeading.toFixed(1) + "°"}`);

    if (mapRotationEnabled) {
      // Only rotate if we actually have a heading yet — otherwise leave the
      // bearing alone rather than snapping it to 0. (onPosition will rotate
      // to the real heading once one is computed.)
      if (lastHeading !== null) {
        console.log(`[heading] map.easeTo bearing=${lastHeading.toFixed(1)}° (from rotate button)`);
        map.easeTo({
          bearing: lastHeading,
          duration: 300,
        });
      } else {
        console.log("[heading] rotate button: no heading yet, leaving bearing as-is");
      }
    } else {
      console.log("[heading] map.easeTo bearing=0° (from rotate button, turning off)");
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
      console.log("[heading] cleared lastHeading/lastUserLatLng — next enable starts fresh");
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
