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
    const threshold = Math.max(HEADING_MIN_MOVE_METERS, accuracy);
    console.log(`[heading] movedMeters=${movedMeters.toFixed(1)} threshold=${threshold.toFixed(1)}`);
    if (movedMeters > threshold) {
      const heading = bearingDegrees(lastUserLatLng, newLatLng);
      const delta = lastHeading === null ? null : angularDeltaDeg(heading, lastHeading);
      console.log(
        `[heading] candidate=${heading.toFixed(1)}° lastHeading=${lastHeading === null ? "null" : lastHeading.toFixed(1) + "°"} ` +
          `delta=${delta === null ? "n/a" : delta.toFixed(1) + "°"}`
      );
      if (lastHeading === null || delta > HEADING_MIN_DELTA_DEG) {
        lastHeading = heading;
        console.log(
          `[heading] ACCEPTED heading=${heading.toFixed(1)}° followUser=${followUser} mapRotationEnabled=${mapRotationEnabled}`
        );
        // MapLibre's `bearing` is already "the compass direction shown at
        // the top of the screen," so setting it straight to the heading is
        // what points the user's direction of travel up — no inversion.
        if (followUser && mapRotationEnabled) {
          console.log(`[heading] map.easeTo bearing=${lastHeading.toFixed(1)}° (from onPosition)`);
          map.easeTo({
            bearing: lastHeading,
            duration: 300,
          });
        }
      } else {
        console.log(`[heading] rejected — delta ${delta.toFixed(1)}° <= ${HEADING_MIN_DELTA_DEG}°`);
      }
      // Only advance the anchor once real movement has actually been
      // measured against it — otherwise tiny per-fix jitter keeps resetting
      // the baseline before genuine cumulative movement (across several
      // small, individually-below-threshold fixes) ever gets the chance to
      // cross the threshold.
      lastUserLatLng = newLatLng;
    }
  } else {
    lastUserLatLng = newLatLng;
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

  if (followUser) {
    map.easeTo({
      center: [userLatLng.lng, userLatLng.lat],
      zoom: Math.max(map.getZoom(), DEFAULT_ZOOM),
      duration: 400,
    });
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
if (rotateBtn) {
  rotateBtn.addEventListener("click", () => {
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
