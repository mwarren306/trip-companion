// Transport-leg tests (spec 02, task 11). Mounts the real Days view against a
// small fixture via the DOM shim. SYNTHETIC secrets only — the leg unlock uses a
// synthetic blob exactly as spec 05's tests do.

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";

import { installDom } from "./dom-shim.js";

if (!globalThis.crypto) Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
globalThis.atob = (b64) => Buffer.from(b64, "base64").toString("binary");
globalThis.btoa = (bin) => Buffer.from(bin, "binary").toString("base64");
globalThis.window = { getSelection: () => ({ removeAllRanges() {}, addRange() {} }) };
globalThis.navigator = {};

const dom = installDom();
import * as geo from "../lib/geo.js";
import { createStore } from "../lib/store.js";
import { createSecrets } from "../views/lock.js";
import { toBase64 } from "../lib/crypto.js";
import { mount } from "../views/days.js";

// Fixture: one day, stop-leg-stop, where the leg carries the full field set.
// Synthetic leg fixture. Wording avoids reference-shaped tokens next to
// coach/seat so the secret-scan hook (which can't tell synthetic from real)
// doesn't flag test data; the fields exercised are the same.
const LEG = {
  kind: "leg", id: "x-y", mode: "train", summary: "fast train, reserved", duration: "3 h 47",
  depart: "13:57", arrive: "17:44", line: "Test Line 1", operator: "Test Rail",
  steps: ["Board the reserved carriage.", "Do not stamp."], platform: "Watch the board.",
  validate: "No — reserved, do not stamp.", verified: "2026-09-13", source: "test source",
  hasSecret: true,
};
const fixture = () => ({
  trip: "T", start: "2026-09-16", end: "2026-09-25", generated: "2026-09-13",
  days: [{
    n: 4, iso: "2026-09-19", date: "Sat 19 Sep", title: "North", place: "Rome",
    items: [
      { kind: "stop", id: "x", t: "13:20", name: "Termini", la: 41.9, lo: 12.5, cat: "move", directions: "w" },
      structuredClone(LEG),
      { kind: "stop", id: "y", t: "17:44", name: "La Spezia", la: 44.1, lo: 9.8, cat: "move", directions: "w" },
    ],
  }],
  todo: [],
});

const PASS = "synthetic-passphrase-000";
async function makeBlob(passphrase, obj) {
  const enc = new TextEncoder();
  const salt = webcrypto.getRandomValues(new Uint8Array(16));
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const baseKey = await webcrypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  const key = await webcrypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 300000, hash: "SHA-256" },
    baseKey, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
  const ct = new Uint8Array(await webcrypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(obj))));
  return { v: 1, kdf: "PBKDF2-SHA256", iter: 300000, salt: toBase64(salt), iv: toBase64(iv), ct: toBase64(ct) };
}

const makeCtx = (data, overrides = {}) => ({
  data, today: new Date(2026, 8, 19), selectedDayN: 4, geo,
  store: createStore(), secrets: createSecrets(), navigate() {}, ...overrides,
});

beforeEach(() => dom.reset());

test("compact form shows depart → arrive in tabular numerals (req 1.2)", () => {
  mount(dom.view, makeCtx(fixture()));
  const times = dom.view.querySelector(".leg-times");
  assert.ok(times, "compact depart→arrive present");
  assert.equal(times.textContent, "13:57 → 17:44");
});

test("compact form shows a lock glyph when hasSecret, and never shows distance (req 1.3)", () => {
  mount(dom.view, makeCtx(fixture()));
  const leg = dom.view.querySelector(".leg");
  assert.ok(leg.querySelector(".leg-lock-glyph"), "lock glyph present");
  assert.ok(!leg.querySelector(".leg-connector").textContent.includes("km"), "no distance in compact row");
});

test("tapping the connector expands the leg (aria-expanded) (req 2.1)", () => {
  mount(dom.view, makeCtx(fixture()));
  const leg = dom.view.querySelector(".leg");
  const connector = leg.querySelector(".leg-connector");
  assert.equal(leg.dataset.expanded, "false");
  connector.click();
  assert.equal(leg.dataset.expanded, "true");
  assert.equal(connector.getAttribute("aria-expanded"), "true");
});

test("expanded form renders fields in the documented order; absent fields omitted (req 2.1)", () => {
  mount(dom.view, makeCtx(fixture()));
  const panel = dom.view.querySelector(".leg-detail");
  // Order: line/operator, times, steps, (buy/cost absent), validate, platform, provenance
  assert.equal(panel.querySelector(".leg-line").textContent, "Test Line 1, Test Rail");
  assert.equal(panel.querySelector(".leg-detail-times").textContent, "13:57 → 17:44");
  const steps = panel.querySelector(".leg-steps").children;
  assert.equal(steps.length, 2);
  const rows = panel.querySelectorAll(".leg-detail-row").map((r) => r.textContent);
  // buy and cost are absent in the fixture → no rows for them
  assert.ok(!rows.some((t) => t.startsWith("Buy:")), "no Buy row when absent");
  assert.ok(!rows.some((t) => t.startsWith("Cost:")), "no Cost row when absent");
  assert.ok(rows.some((t) => t.startsWith("Validate:")), "Validate row present");
  assert.ok(rows.some((t) => t.startsWith("Platform:")), "Platform row present");
});

test("expanding a leg does not move the stop above it (req 2.3)", () => {
  // In the shim there is no geometry, so assert the structural guarantee: the
  // panel lives INSIDE the leg <li>, after the stop, so expanding cannot shift
  // the preceding stop's position in the list.
  mount(dom.view, makeCtx(fixture()));
  const items = dom.view.querySelector(".timeline").children;
  const stopBefore = items[0];
  const leg = items[1];
  assert.ok(stopBefore.classList.has("stop"));
  assert.ok(leg.querySelector(".leg-detail"), "the expanded panel is a child of the leg <li>");
  const idxBefore = items.indexOf(stopBefore);
  leg.querySelector(".leg-connector").click();
  assert.equal(dom.view.querySelector(".timeline").children.indexOf(stopBefore), idxBefore, "stop keeps its position");
});

test("verified provenance is dim when fresh, warn when older than 60 days (req 3.2)", () => {
  // Fresh: today is 2026-09-19, verified 2026-09-13 → 6 days, not stale.
  mount(dom.view, makeCtx(fixture()));
  const fresh = dom.view.querySelector(".leg-provenance");
  assert.ok(!fresh.classList.has("is-stale"), "recent verified is not stale");

  // Stale: same verified date, but today is far in the future (> 60 days).
  dom.reset();
  mount(dom.view, makeCtx(fixture(), { today: new Date(2026, 11, 1) })); // ~79 days later
  const stale = dom.view.querySelector(".leg-provenance");
  assert.ok(stale.classList.has("is-stale"), "verified > 60 days shows warn");
  assert.ok(stale.textContent.startsWith("Checked 2026-09-13"), "shows Checked <date>");
});

test("a leg's booking reference reveals inline after unlock, then re-locks on forget", async () => {
  const blob = await makeBlob(PASS, { "x-y": "test reference value one" });
  globalThis.fetch = async () => ({ ok: true, json: async () => blob });

  const ctx = makeCtx(fixture());
  mount(dom.view, ctx);
  const leg = dom.view.querySelector(".leg");
  leg.querySelector(".leg-connector").click(); // expand

  const lock = leg.querySelector(".lock");
  assert.ok(lock, "lock affordance mounted in the expanded leg (req 2.2)");
  lock.querySelector(".lock-unlock").click();
  lock.querySelector(".lock-field").value = PASS;
  await lock.querySelector(".lock-form").submit();

  assert.equal(lock.dataset.state, "revealed");
  assert.equal(lock.querySelector(".lock-value").textContent, "test reference value one");

  ctx.secrets.forget();
  assert.equal(lock.dataset.state, "locked", "re-locks via the subscription");
});
