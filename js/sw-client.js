"use strict";

// ---------------------------------------------------------------------------
// Update prompt: on startup (and whenever the app is reopened/resumed), ask
// the service worker to check for a new version. If one's found, it
// downloads in the background as usual, but — unlike before, when it would
// activate automatically — it now waits for the user to confirm via the
// banner before taking over and reloading. See service-worker.js's install
// handler (no more automatic self.skipWaiting()) for the other half of this.
// ---------------------------------------------------------------------------

// Only true once the user has actually clicked "Update" — guards against
// reloading on some other controllerchange we didn't ask for (e.g. the very
// first activation on a brand-new install has no previous controller to
// replace, and isn't something we want to reload for).
let awaitingUpdateReload = false;

function showUpdateBanner(waitingWorker) {
  const banner = document.getElementById("update-banner");
  const updateBtn = document.getElementById("update-banner-update");
  const dismissBtn = document.getElementById("update-banner-dismiss");
  if (!banner || banner.hidden === false) {
    return; // already showing (or no banner element at all)
  }

  banner.hidden = false;
  updateBtn.onclick = () => {
    awaitingUpdateReload = true;
    waitingWorker.postMessage({ type: "skip-waiting" });
    updateBtn.disabled = true;
    updateBtn.textContent = "Updating…";
  };
  dismissBtn.onclick = () => {
    banner.hidden = true;
  };
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  // Once the newly-activated worker actually takes control, the page is
  // now serving stale-relative-to-itself HTML/JS from before the update —
  // reload to pick up the fresh version for real.
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (awaitingUpdateReload) {
      window.location.reload();
    }
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("service-worker.js")
      .then((registration) => {
        // A previous visit may have already downloaded an update the user
        // never responded to (dismissed it, or closed the app first).
        if (registration.waiting && navigator.serviceWorker.controller) {
          showUpdateBanner(registration.waiting);
        }

        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) {
            return;
          }
          newWorker.addEventListener("statechange", () => {
            // A controller already existing is what distinguishes a real
            // update from the very first install on a fresh visit — a
            // first install has nothing to prompt about, it just starts
            // controlling the page once ready.
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              showUpdateBanner(newWorker);
            }
          });
        });

        // Check for a newer version now, and again whenever the app is
        // reopened/resumed — browsers do check periodically on their own,
        // but far less often than "every time this PWA is opened," which is
        // what was actually asked for.
        registration.update().catch(() => {});
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") {
            registration.update().catch(() => {});
          }
        });
      })
      .catch((err) => {
        console.warn("Service worker registration failed:", err);
      });
  });
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
