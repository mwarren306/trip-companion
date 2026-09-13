// Encrypt secrets.json -> data/secrets.enc.json. Local only. Never run in CI.
// Usage: set SECRETS_PATH to secrets.json, export the passphrase in the TRIP_PASSPHRASE environment variable, then run node tools/encrypt.mjs
import { readFile, writeFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import { webcrypto as crypto } from "node:crypto";
import path from "node:path";

const src = process.env.SECRETS_PATH;
const pass = process.env.TRIP_PASSPHRASE;
if (!src || !pass) { console.error("Set SECRETS_PATH and TRIP_PASSPHRASE."); process.exit(1); }
if (pass.length < 16) { console.error("Passphrase too short — use 16+ characters."); process.exit(1); }

// Refuse if the plaintext lives inside the repo and is tracked or not ignored.
const abs = path.resolve(src);
const repo = execSync("git rev-parse --show-toplevel").toString().trim();
if (abs.startsWith(repo)) {
  const ignored = (() => { try { execSync(`git check-ignore -q "${abs}"`); return true; } catch { return false; } })();
  if (!ignored) { console.error("secrets.json is inside the repo and not gitignored. Fix that first."); process.exit(1); }
}

const enc = new TextEncoder();
const plaintext = enc.encode(await readFile(abs, "utf8"));
const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));
const baseKey = await crypto.subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveKey"]);
const key = await crypto.subtle.deriveKey(
  { name: "PBKDF2", salt, iterations: 300000, hash: "SHA-256" },
  baseKey, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext));
const b64 = (u8) => Buffer.from(u8).toString("base64");
const out = JSON.stringify({ v: 1, kdf: "PBKDF2-SHA256", iter: 300000, salt: b64(salt), iv: b64(iv), ct: b64(ct) });
await writeFile("data/secrets.enc.json", out);
console.log(`data/secrets.enc.json ${out.length} bytes`);
