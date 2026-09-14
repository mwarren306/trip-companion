# Offline install — tasks

- [ ] 1. Service worker skeleton and `VERSION` cache
  - Create `sw.js` at the repo root with `const VERSION = "v1"` and cache name `trip-${VERSION}`.
  - Implement `install` (open the cache, precache — see task 2) and `activate` (delete every cache
    whose key isn't `trip-${VERSION}`, then `clients.claim()`).
  - _Requirements: 1.3_

- [ ] 2. Resilient precache set
  - Define `PRECACHE` as an explicit URL array covering req 1.1: `index.html`, all `views/`, `lib/`,
    `styles/`, `fonts/`, `vendor/`, `icons/`, `data/itinerary.json`, `data/secrets.enc.json`,
    `data/trails.geojson`, `data/areas.json`, `manifest.webmanifest`.
  - Split into CORE (must all cache or install fails) and OPTIONAL (assets added by specs 03/04 —
    `vendor/*`, `data/areas.json`, `data/trails.geojson`, real `icons/*`); cache each URL
    individually so a missing optional asset is skipped, not fatal.
  - _Requirements: 1.1_

- [ ] 3. Fetch strategy
  - Cache-first for same-origin **app assets** (`views/`, `lib/`, `styles/`, `fonts/`, `icons/`,
    `vendor/`, `index.html`, `manifest.webmanifest`): serve cache; on miss fetch, cache a copy,
    return. Navigation requests → cache-first on `index.html`.
  - Stale-while-revalidate for same-origin **`data/*.json`**: serve the cached copy immediately,
    fetch fresh in the background, cache it; when the fresh bytes differ from the cached bytes, post
    `{ type: "DATA_UPDATED", url }` to clients. Revalidation is best-effort (no-ops offline).
  - Network-only for Supabase REST/realtime and the `trail-status` Edge Function (never cached).
  - Recognise the OSM tile origin and leave the tile handling seam for spec 03 (do not precache or
    define the tile strategy here).
  - _Requirements: 1.2, 1.6_

- [ ] 4. Register the service worker (`app.js`)
  - After boot, if `"serviceWorker" in navigator`, register `sw.js` at the app scope. Best-effort:
    a registration failure must never block or error the app, and nothing is logged in production.
  - _Requirements: 1.6_

- [ ] 5. Update prompt (no unprompted reload) — two triggers, one control
  - New worker waits (no automatic `skipWaiting`). In `app.js`, show a one-line
    `Update available — reload` control (button, colours from tokens) when EITHER: a waiting worker
    is detected (`registration.onupdatefound` + `controller` present) OR a `{ type: "DATA_UPDATED" }`
    message arrives from the SW.
  - On tap: if a worker is waiting, `postMessage({ type: "SKIP_WAITING" })` then reload on
    `controllerchange`; for a data-only update, reload directly. One reload covers both.
  - _Requirements: 1.4_

- [ ] 6. Web App Manifest
  - Write `manifest.webmanifest`: `name`, `short_name`, `display: standalone`, `start_url: "./"`,
    `scope: "./"`, `background_color` = `--page` (#F5F7F9), `theme_color` = `--go` (#0B7A75), and
    icon entries for 192, 512, and maskable-512.
  - Add `<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">` to `index.html`.
  - _Requirements: 1.5_

- [ ] 7. Icons — self-generated mark
  - Generate `icons/icon-192.png`, `icons/icon-512.png`, `icons/maskable-512.png`, and
    `icons/apple-touch-icon.png` locally: a jade (`--go`) rounded square with a white numbered pin,
    matching the design system's numbered-pin motif. Maskable variant has safe-zone padding. No
    third-party assets; generate deterministically (e.g. an SVG rasterised with a local tool).
  - _Requirements: 1.5_

- [ ] 8. Offline render verification
  - Confirm the app renders fully with `navigator.onLine === false` and throws/logs nothing: cold
    offline open serves cached `index.html`, boot reads cached `data/*`, all days render.
  - _Requirements: 1.6_

- [ ] 9. Styles
  - Style the `Update available — reload` control in `styles/app.css` (unobtrusive, tokens only,
    ≥44px target, respects `prefers-reduced-motion`).
  - _Requirements: 1.4_

- [ ] 10. Tests
  - Unit (Node, shims): precache classifier (core vs optional URL sets); cache-name/`VERSION`
    derivation; activate cleanup keeps only `trip-${VERSION}`; fetch router picks the right strategy
    per URL — app asset → cache-first, `data/*.json` → stale-while-revalidate, Supabase/Edge →
    network-only.
  - Manifest (Node): `display: standalone`, `start_url: "./"`, `background_color` === `--page` and
    `theme_color` === `--go` (read from `tokens.css`), all icon entries present.
  - _Requirements: 1.1, 1.2, 1.3, 1.5_

- [ ] 11. Acceptance verification
  - iPhone: Add to Home Screen, airplane mode, force-quit, reopen — every day renders, maps show
    cached tiles, trail panel shows last status and fallback, no console errors.
  - Lighthouse PWA installability passes.
  - Bump `VERSION`, deploy, reopen: `Update available — reload` appears; reload gets the new build.
  - _Requirements: 1.3, 1.4, 1.5, 1.6_
