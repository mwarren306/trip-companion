// Entry point: load itinerary data, build the shared context, and mount a view.
//
// Task 1 scope: the boot skeleton and the `ctx` seam. Data caching and the
// parse-failure view (task 2), date routing (task 3), and the store/geo
// implementations (later tasks) slot into the seams defined here.

import { mount as mountDays } from "./views/days.js";
import { mount as mountTracker } from "./views/tracker.js";
import { isoDate, daysUntil } from "./lib/dates.js";
import * as geo from "./lib/geo.js";
import { createStore } from "./lib/store.js";
import { createSecrets, installBackgroundRelock } from "./views/lock.js";

const VIEWS = {
  days: mountDays,
  tracker: mountTracker,
};

const LAST_GOOD_KEY = "lastGoodItinerary";

/**
 * Read and parse the itinerary. No network dependency: the file is served from
 * the same origin (and, once the service worker lands in spec 07, from cache).
 * On success, record only the `generated` date string so a later parse failure
 * can name the last good copy. The JSON file itself is cached by the service
 * worker (spec 07); storing the parsed object here too would give one file two
 * caches and serve stale data after a deploy.
 * @returns {Promise<object>} parsed itinerary
 */
async function loadItinerary() {
  // Default cache mode so the <link rel="preload" as="fetch"> in index.html is
  // reused instead of triggering a second network request, and the HTTP/SW
  // cache can serve it on repeat loads. Freshness is owned by the service
  // worker's cache strategy (spec 07), not by forcing a network round-trip here.
  const res = await fetch("data/itinerary.json");
  if (!res.ok) throw new Error(`itinerary fetch failed: ${res.status}`);
  const data = await res.json();
  rememberGenerated(data.generated);
  return data;
}

/** Record the last good `generated` date string. Best-effort; never throws. */
function rememberGenerated(generated) {
  if (!generated) return;
  try {
    localStorage.setItem(LAST_GOOD_KEY, generated);
  } catch {
    // Storage unavailable (private mode, quota). Non-fatal.
  }
}

/** @returns {?string} the `generated` date of the last good copy, if cached. */
function lastGoodGenerated() {
  try {
    return localStorage.getItem(LAST_GOOD_KEY);
  } catch {
    return null;
  }
}

/**
 * Render the parse-failure view: one readable error, plus the last good
 * `generated` date when a cached copy exists. Nothing is logged to the console.
 * @param {HTMLElement} el
 */
function renderParseFailure(el) {
  el.replaceChildren();
  const block = document.createElement("div");
  block.className = "load-error";
  block.setAttribute("role", "alert");

  const h1 = document.createElement("h1");
  h1.textContent = "This trip couldn't be loaded.";
  block.append(h1);

  const p = document.createElement("p");
  p.textContent = "The itinerary file is missing or unreadable.";
  block.append(p);

  const generated = lastGoodGenerated();
  if (generated) {
    const cached = document.createElement("p");
    cached.textContent = `Last good copy generated ${generated}.`;
    block.append(cached);
  }

  el.append(block);
}

/**
 * Decide the opening view and day from the device date, comparing ISO calendar
 * strings only (no timezone math, per tech.md).
 * @param {object} data itinerary
 * @param {Date} today
 * @returns {{ view: string, dayN: ?number, daysUntilStart: ?number }}
 */
export function route(data, today) {
  const t = isoDate(today);
  if (t < data.start) {
    return { view: "tracker", dayN: null, daysUntilStart: daysUntil(data.start, today) };
  }
  if (t > data.end) {
    const last = data.days[data.days.length - 1];
    return { view: "days", dayN: last.n, daysUntilStart: null };
  }
  const onDay = data.days.find((d) => d.iso === t) ?? data.days[0];
  return { view: "days", dayN: onDay.n, daysUntilStart: null };
}

/**
 * Build the single seam every view mounts against. `today` defaults to the
 * device clock but is overridable so date routing can be tested (see design).
 * @param {object} data parsed itinerary
 * @returns {object} ctx
 */
function buildContext(data, today) {
  const ctx = {
    data: Object.freeze(data),
    today,
    selectedDayN: null,
    daysUntilStart: null, // set by routing when today is before the trip
    geo, // lib/geo.js — mapsUrl, coordString, copyCoords
    store: createStore(), // lib/store.js — checkmark persistence (local; Supabase sync is spec 06)
    secrets: createSecrets(), // views/lock.js — encrypted booking references (spec 05)
    navigate(viewName, dayN) {
      render(ctx, viewName, dayN);
    },
  };
  return ctx;
}

/**
 * Mount a view into <main>. Clears the previous view first.
 * @param {object} ctx
 * @param {string} viewName key in VIEWS
 * @param {number} dayN day to render
 */
function render(ctx, viewName, dayN) {
  const el = document.getElementById("view");
  // Let the outgoing view tear down (unsubscribe from the store, etc.) before
  // its DOM is cleared. Views register cleanup via el.addEventListener(
  // "view:unmount", ..., { once: true }); replaceChildren alone fires nothing.
  el.dispatchEvent(new CustomEvent("view:unmount"));
  el.replaceChildren();
  ctx.selectedDayN = dayN ?? ctx.selectedDayN;
  const mount = VIEWS[viewName];
  mount(el, ctx);
}

/**
 * The device date, with a dev-only override: `?today=YYYY-MM-DD` in the URL
 * forces `ctx.today` so date routing can be previewed (e.g. the Days view while
 * the real date is still before the trip). Invalid or absent → real clock.
 * @returns {Date}
 */
function resolveToday() {
  try {
    const raw = new URLSearchParams(location.search).get("today");
    if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const [y, m, d] = raw.split("-").map(Number);
      const forced = new Date(y, m - 1, d);
      if (!Number.isNaN(forced.getTime())) return forced;
    }
  } catch {
    // No location (non-browser) — fall through to the real clock.
  }
  return new Date();
}

async function boot() {
  let data;
  try {
    data = await loadItinerary();
    // A zero-day itinerary is unusable data — treat it as a parse failure.
    if (!Array.isArray(data.days) || data.days.length === 0) {
      throw new Error("itinerary has no days");
    }
  } catch {
    renderParseFailure(document.getElementById("view"));
    return;
  }

  const today = resolveToday();
  const ctx = buildContext(data, today);

  // Secure bookings (spec 05): install the background re-lock and try a
  // remembered key. Both are best-effort and must not block or fail boot — the
  // shell renders whether or not any secret can be unlocked.
  installBackgroundRelock(ctx.secrets);
  ctx.secrets.useRemembered().catch(() => {});

  const { view, dayN, daysUntilStart } = route(data, today);
  ctx.daysUntilStart = daysUntilStart;
  render(ctx, view, dayN);
}

/**
 * Register the service worker and wire the "Update available — reload" control
 * (spec 07). The control appears on either trigger: a new app-code build waiting
 * (a waiting worker) or an edited data file the SW revalidated (a DATA_UPDATED
 * message). Best-effort — a registration failure never blocks or errors the app,
 * and nothing is logged in the production path.
 */
function initServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  let waitingWorker = null;

  navigator.serviceWorker.register("sw.js").then((reg) => {
    // A worker already waiting when the page loads.
    if (reg.waiting && navigator.serviceWorker.controller) {
      waitingWorker = reg.waiting;
      showUpdatePrompt();
    }
    // A new worker found and finished installing while we are controlled.
    reg.addEventListener("updatefound", () => {
      const nw = reg.installing;
      if (!nw) return;
      nw.addEventListener("statechange", () => {
        if (nw.state === "installed" && navigator.serviceWorker.controller) {
          waitingWorker = nw;
          showUpdatePrompt();
        }
      });
    });
  }).catch(() => {
    // SW unsupported or registration blocked — the app runs online as normal.
  });

  // Data revalidation found a changed data/*.json (no waiting worker needed).
  navigator.serviceWorker.addEventListener("message", (e) => {
    if (e.data && e.data.type === "DATA_UPDATED") showUpdatePrompt();
  });

  // Reload once when the new worker takes control.
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });

  function showUpdatePrompt() {
    if (document.getElementById("update-prompt")) return; // already shown
    const bar = document.createElement("button");
    bar.id = "update-prompt";
    bar.type = "button";
    bar.className = "update-prompt";
    bar.textContent = "Update available — reload";
    bar.addEventListener("click", () => {
      if (waitingWorker) {
        waitingWorker.postMessage({ type: "SKIP_WAITING" }); // reload on controllerchange
      } else {
        location.reload(); // data-only update: fresh copy already revalidated into cache
      }
    });
    document.body.append(bar);
  }
}

// Auto-boot in the browser only. Under a test runner (no DOM) the module is
// imported for its exported helpers, so we skip boot to avoid a fetch/DOM call.
if (typeof document !== "undefined") {
  boot();
  initServiceWorker();
}
