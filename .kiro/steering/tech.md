---
inclusion: always
---

# Tech

## Stack — deliberately minimal

- Plain HTML, CSS, and JavaScript. **No framework, no bundler, no build step for the app.**
- ES modules loaded directly by the browser (`<script type="module">`).
- One local Node script (`tools/encrypt.mjs`) for encrypting booking references. Run by hand,
  never in CI.
- Leaflet for the map, self-hosted in `vendor/` (not from a CDN — the app must work offline).
- Inter as the UI typeface, self-hosted woff2 in `fonts/`, weights 400/500/600.
- Supabase (JS client from `vendor/`) for checkmark sync and for the trail-status Edge Function.
- Service worker for offline; Web App Manifest for Home Screen install.
- WebCrypto (PBKDF2 + AES-GCM) for the encrypted booking blob.

## Why no framework

Two users, one trip, ten days of use. The cost of a framework is a build pipeline, a dependency
tree, and a larger offline cache. The benefit is nothing this app needs. Keep it boring.

## Hosting

GitHub Pages from the `main` branch, repository root. The repository is **public** — GitHub Pages
on a free account requires it — so everything committed is world-readable. See `security.md`.

## Map tiles

OpenStreetMap standard tiles via Leaflet. Precache a bounded tile set for the four areas the trip
visits (Rome centre, Cinque Terre coast Levanto–Riomaggiore, Florence centre, Venice) at zoom
levels 13–16 on first load over Wi‑Fi. Keep the total under ~2,000 tiles and respect the OSM tile
usage policy: set a real `User-Agent`/`Referer` via the app origin, never bulk-download beyond
the trip bounds, and show OSM attribution on the map.

Trail geometry for 591, 592-3, 592-4 and Via dell'Amore comes from OpenStreetMap via Overpass,
saved once as GeoJSON in `data/trails.geojson`, attributed as ODbL. Not fetched at runtime.

## Browser targets

Safari on iOS 17+, Chrome on Android 12+. Nothing else matters. Test on the actual phones.

## Conventions

- Dates and times in the data are local Italian time, ISO-8601 strings, no timezone math in the UI.
- Money is a string with the currency symbol as it should display: `"€9.50"`, never a float.
- Coordinates are `{ "la": 41.89, "lo": 12.49 }` — lat then lon, the same order everywhere.
- No `localStorage` for anything sensitive. Checkmarks only.
- Log nothing to the console in production paths. Decrypted values never touch `console`.
