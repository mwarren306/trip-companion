# Offline install — requirements

## Introduction
The app must survive airplane mode after one load, and install to the Home Screen as a standalone
app. Map tiles are handled in spec 03; this covers the app shell and data.

## Requirements
1.1 THE SERVICE WORKER SHALL precache on install: `index.html`, all `views/`, `lib/`, `styles/`,
`fonts/`, `vendor/`, `icons/`, `data/itinerary.json`, `data/secrets.enc.json`, `data/trails.geojson`,
`data/areas.json`, and `manifest.webmanifest`.
1.2 THE SERVICE WORKER SHALL use cache-first for everything above, network-only for Supabase and the
Edge Function, and the tile strategy from spec 03 for OSM tiles.
1.3 THE SERVICE WORKER SHALL key its cache on a `VERSION` constant that is bumped on every deploy,
and delete old caches on activate.
1.4 WHEN a new version is available THE SYSTEM SHALL show a one-line `Update available — reload`
control rather than reloading unprompted.
1.5 THE MANIFEST SHALL set `display: standalone`, `start_url: ./`, theme and background colours from
tokens, and provide 192, 512, and maskable icons plus an Apple touch icon.
1.6 THE SYSTEM SHALL render fully with `navigator.onLine === false` and no console errors.

## Acceptance
- iPhone: Add to Home Screen, airplane mode, force-quit, reopen — every day renders, maps show
  cached tiles, trail panel shows last status and fallback.
- Lighthouse PWA installability passes.
- Bump `VERSION`, deploy, reopen: update prompt appears; reload gets the new build.
