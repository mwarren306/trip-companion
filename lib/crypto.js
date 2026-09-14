// WebCrypto helpers for the encrypted booking blob (spec 05).
//
// Decrypt side of tools/encrypt.mjs. Parameters (salt, iterations, iv) are read
// from data/secrets.enc.json at call time, never hard-coded, so re-encrypting at
// a higher cost never desyncs this module (security.md). Browser WebCrypto only;
// this module touches no DOM, no localStorage, and logs nothing. Decrypted bytes
// are returned to the caller (views/lock.js) and never held here.
//
// File shape produced by the tool and consumed here:
//   { v:1, kdf:"PBKDF2-SHA256", iter:300000, salt:"<b64>", iv:"<b64>", ct:"<b64>" }

const subtle = globalThis.crypto?.subtle;

/* --------------------------------------------------------------- base64 */

/** Decode a base64 string to a Uint8Array (no dependency). */
export function fromBase64(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Encode a Uint8Array (or ArrayBuffer) to a base64 string. */
export function toBase64(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
  return btoa(bin);
}

/* ------------------------------------------------------------- key derive */

/**
 * Derive an AES-GCM-256 key from a passphrase using the file's KDF params.
 * The key is non-extractable by default so it cannot be read back out; the
 * Remember path derives a separate extractable key (see deriveKeyExtractable).
 *
 * @param {string} passphrase the user-typed passphrase (not retained here)
 * @param {{ salt: string, iter: number }} params base64 salt + iteration count
 * @returns {Promise<CryptoKey>}
 */
export function deriveKey(passphrase, { salt, iter }) {
  return derive(passphrase, salt, iter, false);
}

/**
 * Same derivation, but the key is extractable so it can be exported to JWK and
 * stored for "Remember on this phone" (req 2.4). Only used on that opt-in path.
 * @returns {Promise<CryptoKey>}
 */
export function deriveKeyExtractable(passphrase, { salt, iter }) {
  return derive(passphrase, salt, iter, true);
}

async function derive(passphrase, saltB64, iter, extractable) {
  if (!subtle) throw new Error("secure-context-required");
  const enc = new TextEncoder();
  const baseKey = await subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return subtle.deriveKey(
    { name: "PBKDF2", salt: fromBase64(saltB64), iterations: iter, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    extractable,
    ["decrypt"],
  );
}

/* --------------------------------------------------------------- decrypt */

/**
 * Decrypt the blob's ciphertext with a derived key and return the parsed
 * plaintext object `{ id: reference }`. Rejects on AES-GCM authentication
 * failure — the wrong-passphrase path (req 2.3). Never logs the reason.
 *
 * @param {CryptoKey} key
 * @param {{ iv: string, ct: string }} blob base64 iv + ciphertext
 * @returns {Promise<object>}
 */
export async function decryptBlob(key, { iv, ct }) {
  if (!subtle) throw new Error("secure-context-required");
  const plainBuf = await subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(iv) },
    key,
    fromBase64(ct),
  );
  return JSON.parse(new TextDecoder().decode(plainBuf));
}

/* ----------------------------------------------- export / import (Remember) */

/**
 * Export a derived key to JWK for storage (req 2.4). The key must have been
 * created extractable (deriveKeyExtractable).
 * @param {CryptoKey} key
 * @returns {Promise<JsonWebKey>}
 */
export function exportKey(key) {
  if (!subtle) throw new Error("secure-context-required");
  return subtle.exportKey("jwk", key);
}

/**
 * Import a stored JWK back into a decrypt-only AES-GCM key. Imported as
 * non-extractable so a remembered key can't be re-exported from the page.
 * @param {JsonWebKey} jwk
 * @returns {Promise<CryptoKey>}
 */
export function importKey(jwk) {
  if (!subtle) throw new Error("secure-context-required");
  return subtle.importKey("jwk", jwk, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
}
