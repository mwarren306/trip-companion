// lib/crypto.js tests (spec 05, task 12). SYNTHETIC secrets only — every test
// generates its own throwaway passphrase and plaintext; no real reference or
// passphrase appears here. Encryption uses the SAME WebCrypto path as
// tools/encrypt.mjs so the tests exercise the real decrypt contract.

import { test } from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";

// Browser globals the module expects.
if (!globalThis.crypto) Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
globalThis.atob = (b64) => Buffer.from(b64, "base64").toString("binary");
globalThis.btoa = (bin) => Buffer.from(bin, "binary").toString("base64");

const { deriveKey, deriveKeyExtractable, decryptBlob, exportKey, importKey, toBase64, fromBase64 } =
  await import("../lib/crypto.js");

// Encrypt exactly as tools/encrypt.mjs does, into the { v,kdf,iter,salt,iv,ct } shape.
async function encryptBlob(passphrase, obj, iter = 300000) {
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

const PASS = "synthetic-passphrase-000";
const PLAIN = { "4b": "SYNTHETIC-ORDER-0001", "1a": "wifi: test / test-pw" };

test("base64 round-trips bytes", () => {
  const bytes = new Uint8Array([0, 1, 2, 254, 255]);
  assert.deepEqual([...fromBase64(toBase64(bytes))], [...bytes]);
});

test("decryptBlob returns the plaintext object for the right passphrase", async () => {
  const blob = await encryptBlob(PASS, PLAIN);
  const got = await decryptBlob(await deriveKey(PASS, blob), blob);
  assert.deepEqual(got, PLAIN);
});

test("a wrong passphrase rejects (GCM auth failure), does not resolve", async () => {
  const blob = await encryptBlob(PASS, PLAIN);
  const wrongKey = await deriveKey("synthetic-wrong-pass-999", blob);
  await assert.rejects(() => decryptBlob(wrongKey, blob));
});

test("params are read from the blob: a different iteration count still decrypts", async () => {
  const blob = await encryptBlob(PASS, PLAIN, 250000);
  const got = await decryptBlob(await deriveKey(PASS, blob), blob);
  assert.deepEqual(got, PLAIN, "deriveKey must use the blob's iter, not a constant");
});

test("export/import round-trips the derived key (Remember path)", async () => {
  const blob = await encryptBlob(PASS, PLAIN);
  const jwk = await exportKey(await deriveKeyExtractable(PASS, blob));
  const got = await decryptBlob(await importKey(jwk), blob);
  assert.deepEqual(got, PLAIN);
});

test("the session key is non-extractable (cannot be exported)", async () => {
  const blob = await encryptBlob(PASS, PLAIN);
  const sessionKey = await deriveKey(PASS, blob); // non-extractable
  await assert.rejects(() => exportKey(sessionKey), "a non-extractable key must not export");
});
// (exportKey/importKey are async and already return promises, so the thunk form
//  above is only needed where a key must be derived first.)
