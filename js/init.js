"use strict";

// ---------------------------------------------------------------------------
// Init — must load last: every call here depends on a function defined in
// one of the other files (map-setup.js, search-and-routing.js,
// geolocation.js, sw-client.js).
// ---------------------------------------------------------------------------

initMap();
initCategoryChips();
initGeolocation();
registerServiceWorker();
requestServiceWorkerVersion();
