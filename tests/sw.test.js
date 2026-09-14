// Service worker + manifest tests (spec 07, task 10).
//
// sw.js is a CLASSIC service-worker script (no import/export — iOS Safari
// support), so it can't be imported as an ES module. Instead we evaluate its
// source in a vm sandbox with a fake `self`, then read the pure helpers it
// attaches to `self.__swTest`. This tests the shipping file, not a copy.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

// Load sw.js into a sandbox whose `self` looks enough like a NON-worker global
// that the worker-wiring branch stays off (no skipWaiting/clients), so only the
// pure helpers run.
const src = await readFile(new URL("../sw.js", import.meta.url), "utf8");
const sandbox = { self: {}, caches: undefined, fetch: undefined };
sandbox.self = sandbox; // self === global, like a worker but without SW methods
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
const sw = sandbox.__swTest;

test("sw.js exposes its pure helpers without wiring the worker", () => {
  assert.ok(sw, "helpers exposed via self.__swTest");
  assert.equal(typeof sw.classifyRequest, "function");
});

test("cache name is keyed on VERSION", () => {
  assert.equal(sw.cacheName("v1"), "trip-v1");
  assert.equal(sw.CACHE, `trip-${sw.VERSION}`);
});

test("activate cleanup deletes every cache except the current one", () => {
  const keys = ["trip-v0", "trip-v1", "other", "trip-v2"];
  const del = sw.cachesToDelete(keys, "trip-v1");
  assert.deepEqual(del.sort(), ["other", "trip-v0", "trip-v2"].sort());
});

const ORIGIN = "https://mwarren306.github.io";
const at = (path, mode) => sw.classifyRequest({ url: `${ORIGIN}/${path}`, mode, origin: ORIGIN + "/" });

test("app assets are cache-first", () => {
  assert.equal(at("app.js"), "cache-first");
  assert.equal(at("views/days.js"), "cache-first");
  assert.equal(at("styles/app.css"), "cache-first");
  assert.equal(at("fonts/InterVariable.woff2"), "cache-first");
});

test("navigation requests are cache-first (app shell)", () => {
  assert.equal(at("", "navigate"), "cache-first");
  assert.equal(at("index.html", "navigate"), "cache-first");
});

test("data/*.json and .geojson are stale-while-revalidate", () => {
  assert.equal(at("data/itinerary.json"), "stale-while-revalidate");
  assert.equal(at("data/secrets.enc.json"), "stale-while-revalidate");
  assert.equal(at("data/trails.geojson"), "stale-while-revalidate");
  assert.equal(at("data/areas.json"), "stale-while-revalidate");
});

test("Supabase and the Edge Function are network-only", () => {
  assert.equal(sw.classifyRequest({ url: "https://abc.supabase.co/rest/v1/trip_progress", origin: ORIGIN + "/" }), "network-only");
  assert.equal(sw.classifyRequest({ url: "https://abc.supabase.co/functions/v1/trail-status", origin: ORIGIN + "/" }), "network-only");
});

test("OSM tiles are recognised (delegated to spec 03), not app-cached", () => {
  assert.equal(sw.classifyRequest({ url: "https://a.tile.openstreetmap.org/13/4/5.png", origin: ORIGIN + "/" }), "tile");
});

test("unknown cross-origin requests are passthrough (not intercepted)", () => {
  assert.equal(sw.classifyRequest({ url: "https://example.com/thing.js", origin: ORIGIN + "/" }), "passthrough");
});

test("core precache is required; optional (spec 03/04 assets) is separate", () => {
  assert.ok(sw.CORE.includes("data/itinerary.json"));
  assert.ok(sw.CORE.includes("data/secrets.enc.json"));
  assert.ok(sw.CORE.includes("index.html"));
  // not-yet-present assets live in OPTIONAL so a missing one can't fail install
  assert.ok(sw.OPTIONAL.includes("data/areas.json"));
  assert.ok(sw.OPTIONAL.includes("data/trails.geojson"));
  assert.ok(sw.OPTIONAL.some((u) => u.startsWith("icons/")));
});

// --- manifest ---------------------------------------------------------------

test("manifest: standalone, relative start_url/scope, token colours, icons", async () => {
  const manifest = JSON.parse(await readFile(new URL("../manifest.webmanifest", import.meta.url), "utf8"));
  const tokens = await readFile(new URL("../styles/tokens.css", import.meta.url), "utf8");
  const tokenVal = (name) => tokens.match(new RegExp(`${name}:\\s*(#[0-9A-Fa-f]{6})`))[1];

  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "./");
  assert.equal(manifest.scope, "./");
  assert.equal(manifest.background_color.toUpperCase(), tokenVal("--page").toUpperCase(), "bg === --page");
  assert.equal(manifest.theme_color.toUpperCase(), tokenVal("--go").toUpperCase(), "theme === --go");

  const sizes = manifest.icons.map((i) => i.sizes);
  assert.ok(sizes.includes("192x192"));
  assert.ok(sizes.includes("512x512"));
  assert.ok(manifest.icons.some((i) => i.purpose === "maskable"), "a maskable icon is declared");
});
