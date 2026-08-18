# Calvin Campus Map

A installable PWA for finding your way around Calvin University: shows your
live location on a map and gives walking directions to any building, dorm,
parking lot, or campus store.

## Features

- **Live location** — tracks and follows your GPS position with an accuracy
  circle (`js/app.js`'s `initGeolocation`).
- **Search** — type a building/room name ("Visitor Center", "Admissions",
  "Event Parking", "Campus Store", dorm names, parking lots, etc.) and jump
  straight to it. Data lives in `js/buildings-data.js`, loaded via a plain
  `<script>` tag (rather than `fetch()`) for reliable offline loading.
- **Walking directions** — routes are calculated by a public OSRM "foot"
  routing server using real OpenStreetMap paths/sidewalks; if no route can be
  found (e.g. you're off campus or offline), it falls back to a dashed
  straight-line estimate.
- **Category filters** — Admissions, Academic, Residence Hall, Apartments,
  Shopping & Dining, Athletics, Event Space, Parking.
- **Installable / offline app shell** — a manifest + service worker cache the
  map UI and recently viewed tiles so the app opens even with a weak signal.

## Running it locally

Browsers only grant Geolocation and register a Service Worker on **secure
contexts**: HTTPS, or `http://localhost`. Plain `file://` will not work.

```bash
cd calvin-campus-map
python3 -m http.server 8000
# then open http://localhost:8000 in your browser
```

Or with Node:

```bash
npx serve .
```

On your phone, open the same URL (use your computer's LAN IP over HTTPS, or
deploy it — see below) and use "Add to Home Screen" to install it.

## Deploying

Any static host works (no server code, no API keys, no build step):

- **GitHub Pages**: push this folder to a repo, enable Pages on the
  `main` branch.
- **Netlify / Vercel / Cloudflare Pages**: drag-and-drop deploy this
  directory as-is.

## Data notes

Building coordinates were sourced from OpenStreetMap and Calvin's official
campus map PDF. "Visitor Center" and "Admissions" both point to the welcome
desk inside the Wm. Spoelhof University Center; "Event Parking" points to
Lot 16, the closest visitor lot to the Prince Conference Center. Only
building-level (not room-level) coordinates are available — searching a
room number will not resolve to anything more precise than its building.

To add or correct a building, edit the `CALVIN_BUILDINGS` array directly in
`js/buildings-data.js`.

## Routing service

Walking directions call the free, no-key-required FOSSGIS OSRM instance:
`https://routing.openstreetmap.de/routed-foot/`. It's a shared public
service — fine for personal/demo use, but swap in your own OSRM/Mapbox/
Valhalla instance for production or high-traffic use.
