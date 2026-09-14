// Unlock-flow tests for the stop-card lock affordance (spec 05, task 12).
// SYNTHETIC secrets only. Uses the shared DOM shim plus a fetch shim that serves
// a synthetic encrypted blob, so views/lock.js runs headless end to end.

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";

import { installDom } from "./dom-shim.js";

// Browser globals crypto + base64 the modules need.
if (!globalThis.crypto) Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
globalThis.atob = (b64) => Buffer.from(b64, "base64").toString("binary");
globalThis.btoa = (bin) => Buffer.from(bin, "binary").toString("base64");

const dom = installDom();
const { toBase64 } = await import("../lib/crypto.js");
const { createSecrets, renderLockAffordance } = await import("../views/lock.js");

const PASS = "synthetic-passphrase-000";
const PLAIN = { "4b": "SYNTHETIC-ORDER-0001" };

async function makeBlob(passphrase, obj, iter = 300000) {
  const enc = new TextEncoder();
  const salt = webcrypto.getRandomValues(new Uint8Array(16));
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const baseKey = await webcrypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  const key = await webcrypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: iter, hash: "SHA-256" },
    baseKey, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
  const ct = new Uint8Array(await webcrypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(obj))));
  return { v: 1, kdf: "PBKDF2-SHA256", iter, salt: toBase64(salt), iv: toBase64(iv), ct: toBase64(ct) };
}

// Track network calls so we can assert the wrong-passphrase path makes none
// beyond the single cached blob fetch.
let fetchCount = 0;
let blob = null;
function installFetch() {
  fetchCount = 0;
  globalThis.fetch = async (url) => {
    fetchCount++;
    if (String(url).endsWith("secrets.enc.json")) {
      return { ok: true, json: async () => blob };
    }
    return { ok: false, json: async () => ({}) };
  };
}

// window.prompt must never be called; make it throw if it is.
globalThis.window = {
  prompt() { throw new Error("window.prompt must not be used"); },
  getSelection: () => ({ removeAllRanges() {}, addRange() {} }),
};
globalThis.navigator = {}; // no clipboard → reveal uses the select-text fallback

// A stop card stand-in: renderLockAffordance appends into it, and the view
// element is where view:unmount fires.
function mountAffordance(ctx, item = { id: "4b" }) {
  const el = dom.view.querySelector ? dom.view : null; // view is an El
  const affordance = renderLockAffordance(item, ctx);
  dom.view.append(affordance);
  return affordance;
}

beforeEach(async () => {
  dom.reset();
  installFetch();
  blob = await makeBlob(PASS, PLAIN);
});

test("locked state shows an Unlock control, not window.prompt", () => {
  const ctx = { secrets: createSecrets() };
  const box = mountAffordance(ctx);
  assert.equal(box.dataset.state, "locked");
  assert.ok(box.querySelector(".lock-unlock"), "has an Unlock button");
});

test("tapping Unlock shows an inline passphrase field (not window.prompt)", () => {
  const ctx = { secrets: createSecrets() };
  const box = mountAffordance(ctx);
  box.querySelector(".lock-unlock").click();
  assert.equal(box.dataset.state, "prompting");
  const field = box.querySelector(".lock-field");
  assert.ok(field, "inline field present");
  assert.equal(field.type, "password");
  assert.ok(box.querySelector(".lock-remember"), "Remember checkbox present");
});

test("correct passphrase reveals the reference as selectable text with Copy", async () => {
  const ctx = { secrets: createSecrets() };
  const box = mountAffordance(ctx);
  box.querySelector(".lock-unlock").click();
  const form = box.querySelector(".lock-form");
  box.querySelector(".lock-field").value = PASS;
  await form.submit(); // resolves when the async unlock handler finishes

  assert.equal(box.dataset.state, "revealed");
  assert.equal(box.querySelector(".lock-value").textContent, "SYNTHETIC-ORDER-0001");
  assert.ok(box.querySelector(".lock-copy"), "Copy action present");
});

test("once unlocked, other locked items reveal one-tap (no prompt)", async () => {
  const ctx = { secrets: createSecrets() };
  // First item unlocks the session.
  const first = mountAffordance(ctx, { id: "4b" });
  first.querySelector(".lock-unlock").click();
  first.querySelector(".lock-field").value = PASS;
  await first.querySelector(".lock-form").submit();

  // A second affordance mounted now should render revealed immediately.
  const second = renderLockAffordance({ id: "4b" }, ctx);
  assert.equal(second.dataset.state, "revealed");
});

test("wrong passphrase shows the readable error, clears the field, no extra fetch", async () => {
  const ctx = { secrets: createSecrets() };
  const box = mountAffordance(ctx);
  box.querySelector(".lock-unlock").click();
  const field = box.querySelector(".lock-field");
  field.value = "synthetic-wrong-pass-999";
  await box.querySelector(".lock-form").submit();

  assert.equal(box.dataset.state, "prompting", "stays on the prompt");
  const err = box.querySelector(".lock-error");
  assert.equal(err.hidden, false);
  assert.equal(err.textContent, "That passphrase didn't work");
  assert.equal(field.value, "", "field is cleared");
  assert.equal(fetchCount, 1, "only the single cached blob fetch — no retry request");
});

test("Remember stores the derived key (JWK), never the passphrase or a plaintext value", async () => {
  const ctx = { secrets: createSecrets() };
  const box = mountAffordance(ctx);
  box.querySelector(".lock-unlock").click();
  box.querySelector(".lock-field").value = PASS;
  const cb = box.querySelector(".lock-remember").children.find((c) => c.type === "checkbox");
  cb.checked = true;
  await box.querySelector(".lock-form").submit();

  assert.equal(ctx.secrets.isRemembered(), true);
  const stored = globalThis.localStorage.getItem("secrets.key");
  assert.ok(stored, "a key blob is stored");
  assert.ok(!stored.includes(PASS), "passphrase is NOT stored");
  assert.ok(!stored.includes("SYNTHETIC-ORDER-0001"), "no decrypted value is stored");
  const jwk = JSON.parse(stored);
  assert.equal(jwk.kty, "oct", "stored value is a symmetric-key JWK, not a secret string");
});

test("forget() re-locks and clears the remembered key", async () => {
  const ctx = { secrets: createSecrets() };
  const box = mountAffordance(ctx);
  box.querySelector(".lock-unlock").click();
  box.querySelector(".lock-field").value = PASS;
  const cb = box.querySelector(".lock-remember").children.find((c) => c.type === "checkbox");
  cb.checked = true;
  await box.querySelector(".lock-form").submit();
  assert.equal(box.dataset.state, "revealed");

  ctx.secrets.forget();
  assert.equal(ctx.secrets.isRemembered(), false);
  assert.equal(box.dataset.state, "locked", "affordance re-locked via the subscription");
});
