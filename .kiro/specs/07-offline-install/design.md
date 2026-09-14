# Offline install — design

## Overview

The app has to work in the places the trip actually happens: a Cinque Terre trail with no signal,
the Corniglia staircase, the calli behind San Marco, a FrecciaBianca between tunnels
(`product.md`). After a single online load it must survive airplane mode, a force-quit, and a
cold reopen with every day, every transport leg, and every cached map tile intact — and it must
install to the iPhone Home Screen as a standalone app. This spec delivers the service worker that
precaches the app shell and data, the fetch strategy that makes reads cache-first and sync
network-only, the versioned cache with a non-disruptive update prompt, and the Web App Manifest
that makes it installable.

It builds on a public, HTTPS GitHub Pages origin (`tech.md`), which is what lets a service worker
register at all. The two heavy assets already preload (spec 01); the service worker makes them —
and everything else — available offline on the second load onward.

This design honours the always-on steering: no framework or build step, plain ES-module service
worker (`tech.md`); nothing sensitive in caches beyond the already-encrypted `secrets.enc.json`
(`security.md`); colours (manifest theme/background) only from `tokens.css`; and the update control
is a single readable line, no unprompted reloads (`design-system.md`, req 1.4).

### Scope

In scope: `sw.js` (install/activate/fetch lifecycle, versioned cache, cleanup); the precache set of
req 1.1; cache-first for app assets and data, network-only for Supabase and the Edge Function (req
1.2); the `VERSION`-keyed cache with old-cache deletion on activate (req 1.3); the
`Update available — reload` control (req 1.4); `manifest.webmanifest` with `display: standalone`,
`start_url: ./`, token colours, and the icon set (req 1.5); and full render at
`navigator.onLine === false` with no console errors (req 1.6). Registration wiring in `app.js`.

Out of scope: the OSM tile precache and its runtime strategy (spec 03 — this SW leaves the tile
seam and does not itself fetch tiles); the map and trail views themselves (03/04); Supabase sync
internals (06). Assets those specs will add (`vendor/` Leaflet, `data/areas.json`,
`data/trails.geojson`, real `icons/`) are listed in the precache but treated as optional until they
exist — see "Resilient precache" below.

## Architecture

### Module layout

Follows `structure.md`:

```
sw.js                  the service worker: VERSION, precache list, install/activate/fetch
app.js                 registers the SW and wires the update prompt
manifest.webmanifest   install metadata: name, display, start_url, colours, icons
icons/                 192, 512, maskable, apple-touch (added here or by an icon step)
index.html             already links the manifest and an apple-touch-icon
styles/app.css         the one-line update control styling
data/…                 itinerary.json, secrets.enc.json (ciphertext), and later geojson/areas
```

`sw.js` is a classic service worker (not an ES module import graph) served from the origin root so
its scope covers the whole app. It is plain JS, no build step.

### Service worker lifecycle

- **install:** open the versioned cache, `addAll` the precache set (resiliently — see below), and
  `skipWaiting()` is NOT called automatically; the new worker waits so the update is user-driven
  (req 1.4).
- **activate:** delete every cache whose key isn't the current `VERSION` (req 1.3), then
  `clients.claim()` so the active worker controls open pages.
- **fetch:** route by request (strategy table below).
- **message:** a `{ type: "SKIP_WAITING" }` message from the page (sent when the user taps the
  update control) triggers `skipWaiting()`, after which the page reloads.

### The `VERSION` constant and cache keying (req 1.3)

`sw.js` begins with `const VERSION = "v1";` (bumped every deploy). The cache name is
`` `trip-${VERSION}` ``. On activate, any cache not named `trip-${VERSION}` is deleted, so a deploy
that bumps `VERSION` leaves exactly one live cache and evicts the previous build's assets.

### Precache set (req 1.1) and resilient precache

On install the worker caches: `index.html`; every file under `views/`, `lib/`, `styles/`, `fonts/`,
`vendor/`, `icons/`; `data/itinerary.json`, `data/secrets.enc.json`, `data/trails.geojson`,
`data/areas.json`; and `manifest.webmanifest`. Because there is no build step to enumerate
directories, the list is an explicit array of URLs in `sw.js` (a `PRECACHE` constant), kept in sync
by hand — the same discipline as the rest of this no-bundler app.

**Resilient precache.** Several listed assets are added by later specs and do not exist when this
spec ships: `vendor/` (Leaflet, spec 03), `data/areas.json` (03), `data/trails.geojson` (04), and
the real `icons/` set. A plain `cache.addAll(PRECACHE)` rejects the whole install if any single URL
404s, which would break the SW today. So install caches each URL individually and tolerates a
missing optional asset: the **core** set (app shell, all present `views/`/`lib/`/`styles/`/`fonts/`,
`index.html`, `manifest.webmanifest`, `data/itinerary.json`, `data/secrets.enc.json`) must all
succeed or install fails; the **optional** set (the not-yet-present assets) is cached when present
and skipped when it 404s, without failing install. As specs 03/04 land and those files exist, they
move from skipped to cached with no `sw.js` change beyond the natural `VERSION` bump. This keeps the
requirement's full list intact while letting the SW ship correctly now.

### Fetch strategy (req 1.2)

Routed by request URL:

| Request | Strategy |
|---|---|
| Same-origin **app assets** (`views/`, `lib/`, `styles/`, `fonts/`, `icons/`, `vendor/`, `index.html`, `manifest.webmanifest`) | **cache-first**: serve from cache; on miss, fetch, cache a copy, return it |
| Same-origin **`data/*.json`** (`itinerary.json`, `secrets.enc.json`, `trails.geojson`, `areas.json`) | **stale-while-revalidate**: serve the cached copy immediately, fetch fresh in the background, cache it, and if the bytes changed surface the update prompt (see below) |
| Supabase REST/realtime + the `trail-status` Edge Function | **network-only**: never cached (`security.md` — only booleans/timestamps sync, and stale status must not be served as fresh) |
| OSM map tiles | **spec 03's tile strategy** — this SW recognises the tile origin and delegates; it does not define or precache tiles here |
| Navigation requests (`mode: "navigate"`) | cache-first on `index.html` (the app shell) so a cold offline open always boots |

**Why app code is cache-first but data is stale-while-revalidate.** App code (JS/CSS/HTML) must
change as a coherent set — a half-updated mix of old and new modules is a broken app — so it stays
tied to a `VERSION` bump and only changes on deploy. Itinerary data is different: the plan is
edited from hotels between deploys, and requiring a `VERSION` bump to pick up an `itinerary.json`
edit is a trap (easy to forget on the road). So `data/*.json` is served stale-while-revalidate: the
cached copy renders instantly (offline-first, no wait), a fresh copy is fetched in the background,
and if it differs from the cached bytes the app is told an update is available. Freshness of the
plan is decoupled from deploys; the offline-first guarantee is preserved because the cached copy is
always served first and the revalidation is best-effort (it simply no-ops offline).

### Data revalidation and the update signal

The stale-while-revalidate handler, after caching a fresh `data/*.json` whose bytes differ from what
was cached, posts a message to all clients: `{ type: "DATA_UPDATED", url }`. `app.js` listens for
this and surfaces the **same** `Update available — reload` control used for app-code updates (req
1.4) — one consistent affordance, whether the change is a new deploy or an edited plan. Nothing
reloads unprompted; the user taps to reload and pick up the fresh data. Byte comparison is by a
cheap response hash/length check on the two cached bodies; `secrets.enc.json` changes trigger the
same prompt (a re-encrypt is effectively a plan change to surface).

### Update flow (req 1.4)

Unprompted reloads are forbidden. The same control is triggered by two events — an app-code update
(a new waiting worker) and a data update (revalidation found changed `data/*.json`):

1. **App code:** a deploy bumps `VERSION`; the browser fetches the byte-changed `sw.js` and installs
   the new worker, which then **waits** (the old worker still controls the page). `app.js` detects
   the waiting worker via `registration.onupdatefound` → `installed` while
   `navigator.serviceWorker.controller` exists.
2. **Data:** the stale-while-revalidate handler posts `{ type: "DATA_UPDATED" }` when a background
   fetch of `data/*.json` differs from the cached bytes; `app.js` receives it via
   `navigator.serviceWorker` `message`.
3. Either event shows the single line `Update available — reload` (a button styled per
   `design-system.md`, colours from tokens). Nothing reloads on its own.
4. Tapping it: for an app-code update, `postMessage({ type: "SKIP_WAITING" })` to the waiting worker
   then reload on `controllerchange`; for a data-only update (no waiting worker), just reload —
   which re-reads the already-revalidated `data/*.json` from cache. A single reload covers both.

### Manifest and install (req 1.5)

`manifest.webmanifest`:

```jsonc
{
  "name": "Rome to Venice",
  "short_name": "Rome→Venice",
  "display": "standalone",
  "start_url": "./",
  "scope": "./",
  "background_color": "#F5F7F9",   // --page
  "theme_color": "#0B7A75",         // --go
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

The colour literals in the manifest are the token values (a manifest can't read CSS variables); the
design note is that they must equal `--page`/`--go` in `tokens.css`, and a test asserts that. `index.html`
already carries `<link rel="manifest">` and a `theme-color` meta; this spec adds
`<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">` (iOS ignores manifest icons for
the Home Screen). `start_url: "./"` (relative) is required because the site is served from a project
subpath (`/trip-companion/`), not a domain root — an absolute `/` would break install there.

### Registration (app.js)

After boot, if `"serviceWorker" in navigator`, register `sw.js` at the app scope. Registration is
best-effort and must never block or fail the app (`req 1.6`): wrapped so a registration error is
swallowed (no console output in the production path, `tech.md`). The update-prompt wiring lives here.

## Data model

No new itinerary data. The SW caches `data/*` as opaque cached responses. `secrets.enc.json` is
ciphertext (`security.md`), so caching it offline exposes nothing the public repo doesn't already.

## Error handling

- **Missing optional precache asset:** skipped at install without failing (resilient precache);
  a later `VERSION` picks it up once it exists.
- **Core precache asset fails:** install rejects; the old worker (if any) keeps serving; the app
  still runs from network. No half-installed cache is activated (activate only runs after a clean
  install).
- **Offline navigation:** served the cached `index.html`; boot then reads cached `data/*`. The app
  renders fully with `navigator.onLine === false` and logs nothing (req 1.6).
- **Network-only request offline (Supabase/Edge Function):** fails as a normal fetch error, handled
  by the caller (spec 06's offline queue; spec 04's trail fallback). The SW does not fabricate a
  response.
- **SW unsupported / registration blocked:** the app runs online exactly as before; no error
  surfaced.

## Testing strategy

Written when implemented. A service worker can't fully run under the Node test runner, so coverage
splits:

- **Unit (Node, DOM/SW shims):** the precache classifier (which URLs are core vs optional), the
  cache-name/`VERSION` derivation, the activate cleanup (given a set of cache keys, only
  `trip-${VERSION}` survives), and the fetch router (given a request URL, which strategy) — pure
  functions extracted from `sw.js` so they are testable without a live SW.
- **Manifest test (Node):** parse `manifest.webmanifest`; assert `display: standalone`,
  `start_url: "./"`, `background_color === --page` and `theme_color === --go` read from
  `tokens.css`, and that all four icon entries are declared.
- **Acceptance, on device (the one that matters, per `product.md`):** iPhone Add to Home Screen →
  airplane mode → force-quit → reopen; assert every day renders, cached tiles show, the trail panel
  shows last status + fallback, and there are no console errors. Lighthouse PWA installability
  passes. Bump `VERSION`, deploy, reopen: the `Update available — reload` line appears and reload
  gets the new build.

## Design decisions and rationale

- **App code cache-first (deploy-driven), data stale-while-revalidate (edit-driven).** App modules
  change as a coherent set tied to a `VERSION` bump — no partially-updated app on a flaky trail
  connection. The itinerary, though, gets edited from hotels between deploys, so `data/*.json` is
  served cached-first for instant offline render but revalidated in the background; a changed plan
  surfaces the existing update prompt instead of silently requiring a deploy. Offline-first is
  intact because the cached copy is always served first and revalidation no-ops without a network.
- **Resilient precache over `addAll`.** The requirement lists the finished app's full asset set, but
  spec 07 ships before 03/04. Caching each URL individually — core required, optional tolerated —
  keeps the requirement intact and the SW shippable now, and needs no edit as later assets appear.
- **User-driven updates.** The new worker waits and the app shows one line; nothing reloads under
  the user's feet (req 1.4). Critical for a trip app someone is mid-tap on at a ticket machine.
- **Network-only for Supabase and the Edge Function.** Caching sync traffic or trail status could
  serve stale booleans or a stale "trail open" as if fresh — a correctness and safety problem
  (`security.md`, `product.md`). They stay off the cache entirely.
- **Relative `start_url`/`scope`.** GitHub Pages serves from `/trip-companion/`; relative paths make
  install and offline boot work on a project subpath without hardcoding it.
- **Tiles delegated to spec 03.** This SW defines the seam (recognise the tile origin) but doesn't
  own the bounded tile precache; that belongs with the map that uses it, keeping the offline concern
  and the map concern in their own specs.
