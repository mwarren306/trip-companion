// Service worker — offline install (spec 07).
//
// App code is cache-first and tied to VERSION (a coherent set that only changes
// on deploy). Itinerary data is stale-while-revalidate so an edit made from a
// hotel is picked up without a VERSION bump: the cached copy renders instantly,
// a fresh copy is fetched in the background, and a changed file surfaces the
// existing "Update available — reload" control. Supabase and the Edge Function
// are network-only. OSM tiles are recognised and left to spec 03.
//
// Pure helpers (cacheName, classifyRequest, activate cleanup) are exported so
// they can be unit-tested in Node; the SW event wiring only runs in a worker.

const VERSION = "v1"; // bump on every deploy (app-code cache key)
const CACHE = `trip-${VERSION}`;

// Precache list (req 1.1). CORE must all cache or install fails; OPTIONAL is
// added by specs 03/04 and is tolerated-if-missing so this SW ships correctly
// before those assets exist (resilient precache — see design).
const CORE = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "app.js",
  "views/days.js",
  "views/tracker.js",
  "views/lock.js",
  "views/icons.js",
  "lib/dates.js",
  "lib/geo.js",
  "lib/store.js",
  "lib/crypto.js",
  "styles/tokens.css",
  "styles/app.css",
  "fonts/InterVariable.woff2",
  "data/itinerary.json",
  "data/secrets.enc.json",
];
const OPTIONAL = [
  "data/trails.geojson", // spec 04
  "data/areas.json", // spec 03
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/maskable-512.png",
  "icons/apple-touch-icon.png",
  // vendor/* (Leaflet, Supabase client) — spec 03/06; added to OPTIONAL as they land.
];

/** Cache name for a version. */
function cacheName(version = VERSION) {
  return `trip-${version}`;
}

/** Cache keys to delete on activate: everything that isn't the current cache. */
function cachesToDelete(keys, keep = CACHE) {
  return keys.filter((k) => k !== keep);
}

// Origins that must never be cached (sync + dynamic status). Matched by substring
// so the exact Supabase project host doesn't need hardcoding here.
const NETWORK_ONLY_HINTS = ["supabase.co", "supabase.in", "/functions/v1/", "trail-status"];
// OSM tile hosts — recognised so tiles are delegated to spec 03, not handled here.
const TILE_HINTS = ["tile.openstreetmap.org", "tile.osm.org"];

/**
 * Classify a request into a fetch strategy (pure; testable).
 * @param {{ url: string, mode?: string, origin: string }} req
 *   url: full request URL; mode: request.mode; origin: the SW's own origin.
 * @returns {"cache-first"|"stale-while-revalidate"|"network-only"|"tile"|"passthrough"}
 */
function classifyRequest({ url, mode, origin }) {
  if (NETWORK_ONLY_HINTS.some((h) => url.includes(h))) return "network-only";
  if (TILE_HINTS.some((h) => url.includes(h))) return "tile";

  const sameOrigin = url.startsWith(origin);
  if (!sameOrigin) return "passthrough"; // unknown cross-origin: don't intercept

  // Navigation → app shell (cache-first on index.html).
  if (mode === "navigate") return "cache-first";

  // Data JSON/GeoJSON → stale-while-revalidate. Matched on the full URL so it
  // works whether origin includes a trailing slash or not.
  if (/\/data\/[^?]*\.(json|geojson)(\?|$)/.test(url)) return "stale-while-revalidate";
  return "cache-first";
}

/* ------------------------------------------------------- worker wiring only */
// Everything below runs only inside a real ServiceWorkerGlobalScope. Guarded so
// importing this module in Node (for the pure helpers above) is a no-op.

// skipWaiting + clients exist only on the ServiceWorker global scope, so this is
// true in a real worker and false when imported in Node for the pure helpers.
const IS_SERVICE_WORKER =
  typeof self !== "undefined" &&
  typeof self.skipWaiting === "function" &&
  typeof self.clients === "object";

if (IS_SERVICE_WORKER) wireServiceWorker();

function wireServiceWorker() {
  self.addEventListener("install", (event) => {
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE);
      // CORE: must all succeed.
      await cache.addAll(CORE);
      // OPTIONAL: cache when present, skip 404s without failing install.
      await Promise.all(OPTIONAL.map(async (url) => {
        try {
          const res = await fetch(url, { cache: "no-cache" });
          if (res.ok) await cache.put(url, res);
        } catch {
          /* not present yet — skip */
        }
      }));
      // Do NOT skipWaiting here — the new worker waits until the user reloads.
    })());
  });

  self.addEventListener("activate", (event) => {
    event.waitUntil((async () => {
      const keys = await caches.keys();
      await Promise.all(cachesToDelete(keys).map((k) => caches.delete(k)));
      await self.clients.claim();
    })());
  });

  self.addEventListener("message", (event) => {
    if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
  });

  self.addEventListener("fetch", (event) => {
    const req = event.request;
    if (req.method !== "GET") return; // only GETs are cacheable
    const strategy = classifyRequest({ url: req.url, mode: req.mode, origin: self.location.origin });
    switch (strategy) {
      case "cache-first":
        event.respondWith(cacheFirst(req));
        break;
      case "stale-while-revalidate":
        event.respondWith(staleWhileRevalidate(req, event));
        break;
      case "network-only":
      case "tile": // spec 03 owns tiles; until then, just pass to network
      case "passthrough":
      default:
        return; // let the browser handle it normally
    }
  });
}

/* --------------------------------------------------------------- strategies */

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req, { ignoreSearch: false });
  if (cached) return cached;
  const res = await fetch(req);
  if (res && res.ok) cache.put(req, res.clone());
  return res;
}

/**
 * Serve cached immediately; fetch fresh in the background; if the fresh bytes
 * differ from what was cached, tell clients so they can show the update prompt.
 * Best-effort: offline, the background fetch just fails and the cached copy stands.
 */
async function staleWhileRevalidate(req, event) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req);

  const revalidate = (async () => {
    try {
      const fresh = await fetch(req, { cache: "no-cache" });
      if (!fresh || !fresh.ok) return;
      const changed = await bytesDiffer(cached, fresh.clone());
      await cache.put(req, fresh.clone());
      if (cached && changed) await postDataUpdated(req.url);
    } catch {
      /* offline or fetch error — keep the cached copy */
    }
  })();

  if (event && typeof event.waitUntil === "function") event.waitUntil(revalidate);
  return cached || revalidate.then(() => cache.match(req)).then((r) => r || fetch(req));
}

/** Cheap change check: compare length then bytes of two response bodies. */
async function bytesDiffer(a, b) {
  if (!a) return false; // nothing cached yet → not an "update", just a first fill
  const [ab, bb] = await Promise.all([a.clone().arrayBuffer(), b.arrayBuffer()]);
  if (ab.byteLength !== bb.byteLength) return true;
  const av = new Uint8Array(ab);
  const bv = new Uint8Array(bb);
  for (let i = 0; i < av.length; i++) if (av[i] !== bv[i]) return true;
  return false;
}

async function postDataUpdated(url) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  for (const client of clients) client.postMessage({ type: "DATA_UPDATED", url });
}

// Expose the pure helpers on the global for unit tests, which evaluate this
// classic-script file in a sandbox with a fake `self`. Harmless in a real
// worker (attaching known functions to the SW global).
if (typeof self !== "undefined") {
  self.__swTest = { VERSION, CACHE, CORE, OPTIONAL, cacheName, cachesToDelete, classifyRequest };
}
