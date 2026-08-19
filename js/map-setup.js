"use strict";

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
