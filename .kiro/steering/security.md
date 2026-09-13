---
inclusion: always
---

# Security

The repository is public and the published site is publicly reachable. Every file in `main` is
world-readable, forever, including history. Design for that.

## Never commit

- `secrets.json` — plaintext booking references. Gitignored **before the first commit**.
- The encryption passphrase, in any file, commit message, README, issue, or comment.
- The Supabase **service role** key. Only the anon key ships, and only in `app.js`.
- Any `.env*` file.
- Personal identifiers beyond first names. No passport numbers, no record locators in plaintext.

If any of these is ever committed: rewriting history is not enough on a public repo. Rotate.
Re-encrypt with a new passphrase; treat exposed booking references as compromised.

## What is encrypted, and how

`data/secrets.enc.json` holds every booking reference, PNR, ticket code, order number, voucher
code, Wi-Fi login, and record locator, keyed by the `id` of the stop or leg it belongs to.

- Key derivation: PBKDF2-SHA256, 16-byte random salt, ≥ 250,000 iterations
- Cipher: AES-GCM 256, 12-byte random IV
- File shape: `{ "v": 1, "salt": "<b64>", "iv": "<b64>", "ct": "<b64>" }`
- Encrypt with `tools/encrypt.mjs`, passphrase from an env var (never a CLI argument)
- Decrypt in the browser with WebCrypto only. Decrypted values live in memory. Never written to
  `localStorage`, never logged, never put in the DOM as an attribute — only as text content the
  user asked to see.
- "Remember on this phone" stores the **derived key** in `localStorage`, default off.

A wrong passphrase must fail with a readable message and no stack trace.

## Supabase

The anon key is public by design. The `trip_progress` table therefore has open anon read/write
under RLS and **must contain nothing but booleans and timestamps**. Use a long random `trip_id`.

The `trail-status` Edge Function is read-only, fetches one public page, and returns parsed JSON.
It needs no secrets. Rate-limit it; cache for 10 minutes.

## Pre-commit hook

`tools/precommit-secret-scan.sh` greps the staged diff for every known reference pattern (PNRs,
order numbers, voucher codes, and the like. The committed script holds only shape patterns; the
specific values live in the gitignored `tools/secret-patterns.local`, never in the repo, and are
sourced by the script at scan time. If anything matches, the commit is blocked. Install it
with `git config core.hooksPath tools/`.
