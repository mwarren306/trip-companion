# Secure bookings — design

## Overview

Booking references — PNRs, ticket codes, seat assignments, voucher and order numbers, Wi‑Fi
logins — are the one class of data in this app that must never be world-readable in a public repo.
They live only as ciphertext in `data/secrets.enc.json`, keyed by the `id` of the stop or leg they
belong to, and are decrypted in the browser, in memory, on demand, behind a passphrase the user
types. Nothing about the passphrase or the plaintext is ever authored into the project: the
plaintext `secrets.json` lives outside the repo (the author keeps it at `~/Downloads/secrets.json`),
the passphrase comes from an environment variable the author sets in their own terminal, and
`tools/encrypt.mjs` is the only thing that ever reads either — locally, by hand, never in CI.

This design covers three surfaces: the local encryption tool (already written; the design pins its
contract), the in-browser unlock flow (`views/lock.js` + `lib/crypto.js`, both currently empty),
and the reveal/re-lock behaviour on the stop and leg cards. The cryptographic parameters are fixed
by `security.md` and are not restated as choices here — they are read from the encrypted file at
runtime so the browser can never drift from what the tool produced.

This design honours the always-on steering: plain HTML/CSS/ES modules, no framework or build step
(`tech.md`); one view per file exporting `mount(el, ctx)` (`structure.md`); WebCrypto only, nothing
sensitive in `localStorage` except the derived key when the user opts in, and nothing decrypted
ever logged, URL-encoded, or written to storage (`security.md`, `tech.md`); colours only from
`styles/tokens.css`; WCAG 2.1 AA with 44px targets and text-labelled state (`accessibility.md`).

### Scope

In scope: the `lib/crypto.js` WebCrypto helpers (key derivation from a passphrase, key import for
"remember", AES-GCM decrypt); the lock affordance rendered on any stop/leg with `hasSecret: true`
(the seam spec 01 left); the inline passphrase prompt (not `window.prompt`); whole-blob decrypt
into memory with per-item reveal; the `Copy` action on a revealed reference; "Remember on this
phone" storing the derived key; the `Forget on this phone` control in the To-sort view; and the
background re-lock after 5 minutes.

Out of scope: the encryption tool's implementation (written; this design only pins its contract and
the file shape it emits), the itinerary content itself (spec 01), checkmark sync (spec 06), and the
secret-scan pre-commit hook (owned by `security.md`/tooling, not a runtime feature).

The **leg** lock affordance is also out of scope here and owned by spec 02: a leg's reference is
revealed inside the expanded leg (req 02-2.2), which spec 02 builds. Spec 05 ships the unlock
mechanism (`lib/crypto.js`, `ctx.secrets`, background re-lock, Remember/Forget) and the **stop-card**
affordance. When spec 02 lands, its expanded leg calls the same `renderLockAffordance(item, ctx)`
exported here — the affordance is item-shape-agnostic — so no new unlock code is needed there.

## Architecture

### Module layout

Follows `structure.md` exactly. Spec 05 touches:

```
views/lock.js       the unlock flow: lock affordance, inline prompt, reveal, copy, re-lock
lib/crypto.js       WebCrypto: deriveKey(passphrase, params), importKey(raw), decryptBlob(key, file)
lib/store.js        (consumed) the derived-key persistence for "Remember" reuses the store's
                    localStorage discipline; the key blob is the only sensitive-adjacent value and
                    is opt-in — see "Remember on this phone"
views/days.js       (consumed) mounts the lock affordance where a stop/leg has hasSecret
views/tracker.js    (consumed) hosts the "Forget on this phone" control
data/secrets.enc.json  read-only at runtime; produced by tools/encrypt.mjs
tools/encrypt.mjs   (written) local-only encryptor; contract pinned below
styles/app.css      lock affordance, inline prompt, revealed-reference styles
```

`lib/crypto.js` is a pure helper module: it takes bytes and parameters and returns bytes or a
`CryptoKey`; it never reads the DOM, never touches `localStorage`, never logs. `views/lock.js` owns
all the UI and the single in-memory session key; it is the only place a decrypted value becomes
visible text.

### The secrets session (the one piece of shared runtime state)

Spec 01's `ctx` is the seam. Spec 05 adds a small `ctx.secrets` object, owned by `views/lock.js`'s
module setup and built once at boot, holding the decrypted state for the session:

```js
ctx.secrets = {
  hasKey(): boolean,           // is a CryptoKey held (typed this session or remembered)?
  unlock(passphrase): Promise<boolean>,  // derive key, decrypt blob, cache in memory; false on fail
  useRemembered(): Promise<boolean>,     // import a remembered key from localStorage, if present
  get(id): ?string,            // decrypted reference for an id, or null if not unlocked/absent
  remember(on): void,          // persist / clear the derived key (opt-in)
  isRemembered(): boolean,     // is a key currently persisted on this device?
  forget(): void,              // clear remembered key AND drop the in-memory key
  lock(): void,                // drop the in-memory key (used by the background re-lock)
  subscribe(fn): () => void,   // notify lock affordances when lock state changes, to re-render
}
```

The decrypted map (`{ id: reference }`) and the `CryptoKey` live in module scope inside
`lib/`/`views/lock.js` closures — never on `ctx` as enumerable data, never frozen onto `ctx.data`,
never serialised. `ctx.secrets` exposes only functions.

### Boot sequence addition (app.js)

One line: after building `ctx`, `views/lock.js` initialises `ctx.secrets` and calls
`useRemembered()` (best-effort, async, non-blocking). If a derived key was remembered, lock
affordances mount already-unlocked; if not, they mount locked. Boot never prompts and never blocks
on crypto. `data/secrets.enc.json` is fetched lazily on the first unlock attempt, not at boot, so
the encrypted blob is off the critical path (consistent with spec 01's load-perf work).

### Cryptographic contract (read, don't choose)

`security.md` fixes the parameters; `tools/encrypt.mjs` emits them into the file. The browser reads
them back so the two can never disagree:

```jsonc
// data/secrets.enc.json
{ "v": 1, "kdf": "PBKDF2-SHA256", "iter": 300000, "salt": "<b64>", "iv": "<b64>", "ct": "<b64>" }
```

- Derive: PBKDF2-SHA256 over the typed passphrase with the file's `salt` and `iter` → AES-GCM-256
  key. `iter` and `salt` come from the file, not a constant in the browser, so re-encrypting with a
  higher iteration count needs no code change.
- Decrypt: AES-GCM with the file's `iv` over `ct`. A wrong passphrase fails GCM authentication —
  caught and turned into a readable message (req 2.3), never a thrown stack trace.
- The plaintext is one JSON object `{ id: reference }` (see `data-model.md`); decrypt yields the
  whole map at once (req 2.2), then reveal is per-id lookup.

### The passphrase and plaintext never enter the project (the constraint)

This is a property the design must preserve end to end:

- **Authoring:** `secrets.json` is at `~/Downloads/secrets.json`, outside the repo. `encrypt.mjs`
  reads its path from `SECRETS_PATH` and the passphrase from `TRIP_PASSPHRASE` — both from the
  environment, never a CLI argument (so neither lands in shell history as a flag) and never a file
  in the tree. The tool refuses to run if `SECRETS_PATH` resolves inside the repo and isn't
  gitignored (req 1.2), and prints only the output path and byte count (req 1.3).
- **Runtime:** the browser obtains the passphrase only from the inline field, uses it to derive a
  key, and discards the passphrase string immediately after `deriveKey` — only the `CryptoKey`
  (non-extractable, see below) survives, and only in memory unless "Remember" is on.
- **What may persist:** with "Remember on this phone" checked, the *derived key* is stored, never
  the passphrase (req 2.4) and never a decrypted value (req 2.5). The key is imported/exported via
  WebCrypto; see the note on extractability under "Remember".
- No design step, tool, test, or fixture places the real passphrase or any real plaintext reference
  into a tracked file. Tests use a throwaway passphrase and throwaway plaintext generated in the
  test itself (see Testing).

## Components and interfaces

### `lib/crypto.js`

Pure WebCrypto helpers, no I/O beyond what is passed in:

```js
// Derive an AES-GCM key from a passphrase and the file's KDF params.
export async function deriveKey(passphrase, { salt, iter }): Promise<CryptoKey>
// Decrypt the blob's ct with a key and the file's iv → parsed { id: reference } object.
export async function decryptBlob(key, { iv, ct }): Promise<object>   // throws on auth failure
// Export / import the derived key for "Remember on this phone".
export async function exportKey(key): Promise<JsonWebKey>
export async function importKey(jwk): Promise<CryptoKey>
// base64 <-> Uint8Array helpers (no dependency).
```

`deriveKey` zeroes nothing it doesn't own; the caller (`lock.js`) drops its reference to the
passphrase string right after. Decryption failure rejects; `lock.js` maps that to req 2.3.

### The lock affordance (rendered by the stop/leg card, owned by lock.js)

Mounted wherever a stop or leg has `hasSecret: true` — the seam spec 01 reserved (spec 01's card
renders everything up to the actions row and leaves this slot; spec 02's expanded leg renders it in
the detail block). Two visual states, from `design-system.md`:

- **Locked:** a dashed 1px `--line-2` box, 11px radius, dim text "Booking reference hidden", and a
  right-aligned `--go` text button "Unlock". The whole box is a ≥44px target.
- **Unlocked/revealed:** the reference as selectable text with a `Copy` action (req 3.1).

When any item is unlocked, other locked affordances flip to one-tap: because the session key is
already held, tapping their "Unlock" reveals immediately with no prompt (req 2.2). `lock.js`
subscribes each affordance to `ctx.secrets` so a state change (unlock, forget, re-lock) re-renders
them all without a reload.

### The inline passphrase prompt (req 2.1)

Not `window.prompt`. When "Unlock" is tapped and no key is held, the affordance expands in place
into a small form:

- A `type="password"` input labelled "Passphrase", `autocomplete="off"`, `autocapitalize="off"`,
  `spellcheck="false"`, `inputmode="text"`; on iOS this avoids the keyboard suggesting/storing it.
- A "Remember on this phone" checkbox, **default unchecked** (req 2.1, 2.4).
- A submit button "Unlock" and an escape/cancel that collapses back to the locked box.
- On submit: `await ctx.secrets.unlock(value)`. Success → reveal this item (and enable one-tap for
  the rest). Failure → show `That passphrase didn't work` in a `--warn` inline message and clear
  the field (req 2.3); focus returns to the field. No network call happens on failure (the blob is
  fetched once and cached; a wrong passphrase never triggers a request) and nothing is logged.
- The passphrase value is read from the input, passed to `unlock`, and the input is cleared; the
  string is not stored anywhere.

### Reveal and copy (req 3.1)

A revealed reference renders as `<output>`/selectable text (user can long-press/select) plus a
secondary `Copy` button that writes the value via `navigator.clipboard.writeText`, falling back to
selecting the text for manual copy when the clipboard API is unavailable (mirroring spec 01's
`copyCoords` fallback pattern, but the value is never pre-filled into a `window.prompt`, which would
put a secret in a native dialog string — instead the fallback selects the on-page text). The value
appears only as text content the user asked to see — never as an attribute, `title`, `aria-label`,
or logged string (`security.md`).

### Remember on this phone (req 2.4) and Forget (req 2.4)

- **Remember:** when the checkbox is on at a successful unlock, `ctx.secrets.remember(true)` stores
  the derived key. WebCrypto keys are stored as an exported JWK in `localStorage` under a dedicated
  key (e.g. `secrets.key`). This is the one sensitive-adjacent value allowed in `localStorage`, and
  only on explicit opt-in; the passphrase and all decrypted references stay out of storage (req 2.5).
  Design note on extractability: to persist the key at all it must be exported, so the stored key is
  extractable by definition. The security posture is unchanged from the passphrase case — anyone with
  the unlocked device and this key can read the references, which is exactly what "remember on this
  phone" means. We do not store the passphrase, so the passphrase (reused elsewhere) is not exposed.
- **Forget:** a `Forget on this phone` control lives in the To-sort view (`views/tracker.js`),
  shown only when `ctx.secrets.isRemembered()`. Tapping it calls `ctx.secrets.forget()`, which
  removes the stored key and drops the in-memory key, then re-locks every affordance via the
  subscription.

### Background re-lock (req 3.2)

`views/lock.js` listens for `visibilitychange`. On hide it timestamps; on show, if more than 5
minutes elapsed and "Remember" is off, it calls `ctx.secrets.lock()` (drops the in-memory key and
decrypted map) and the subscription re-renders affordances back to locked. With "Remember" on, the
key is reloaded from storage and items stay revealable (no re-prompt). The threshold is a single
named constant.

## Data model

- `data/secrets.enc.json`: `{ v, kdf, iter, salt, iv, ct }` as above; committed, ciphertext only.
- Plaintext (never committed, outside the repo): `{ "<stopOrLegId>": "<reference>" }` per
  `data-model.md`.
- The link from itinerary to secrets is the shared `id`: a stop/leg carries `hasSecret: true`
  (spec 01 data model) and the decrypted map is keyed by that same `id`. The shell already renders
  `hasSecret` as the seam; spec 05 fills it.

## Error handling

- **Wrong passphrase (2.3):** GCM auth failure is caught; the UI shows `That passphrase didn't
  work`, clears the field, keeps focus. No stack trace, no console output, no network call.
- **Missing/corrupt `secrets.enc.json`:** the first unlock attempt fetches it; a fetch or JSON
  parse failure surfaces the same readable inline error (the user cannot tell, and need not, whether
  the file or the passphrase was the problem) — still no stack trace.
- **`id` present as `hasSecret` but absent from the decrypted map:** reveal shows a plain "No
  reference on file for this item." line rather than an empty box — no placeholder secret, no error.
- **`localStorage` unavailable (private mode/quota):** "Remember" degrades to session-only; the
  checkbox still works for the session, and `isRemembered()` returns false so no stale Forget
  control appears.
- **WebCrypto unavailable (non-secure context):** the affordance shows a one-line notice that
  unlocking requires a secure context; GitHub Pages is HTTPS, so this is a dev-over-plain-HTTP edge.

## Testing strategy

Per repo policy, tests are written when the feature is implemented (tasks below), not preemptively.
No real secret ever enters a test: each crypto test generates a throwaway passphrase and a
throwaway plaintext object in-process, encrypts it with the same WebCrypto path the tool uses
(Node's `webcrypto`), then asserts the browser helpers round-trip it.

- **`lib/crypto.js` round-trip:** derive a key from a random passphrase + random salt, encrypt a
  synthetic `{ id: value }`, and assert `decryptBlob` returns it; assert a different passphrase
  rejects (the wrong-passphrase path) without throwing an unhandled error.
- **Parameter fidelity:** encrypt with `iter: 300000` and a second blob with a different `iter`;
  assert decrypt reads `iter`/`salt` from the blob (not a constant) and both succeed.
- **Export/import:** export a derived key to JWK, re-import, and decrypt with the imported key
  (the "Remember" path) — all with synthetic data.
- **No-leak assertions (unit-level):** spy that `unlock` clears the input and that no code path
  writes a decrypted value or the passphrase to the (shimmed) `localStorage` or `console`.
- **Unlock-flow view tests** (headless DOM shim from spec 01): tapping Unlock shows the inline
  field not `window.prompt`; a correct passphrase reveals the item and flips others to one-tap; a
  wrong one shows `That passphrase didn't work` and clears the field; Forget re-locks.
- **Acceptance, manual on device:** the `git ls-files`/`git log -p` checks (no `secrets.json`, no
  known reference string) are a tooling/CI-adjacent check run in the terminal, not a browser test;
  the Termini-leg reveal + refresh-re-locks check is run on the phone.

## Design decisions and rationale

- **Read crypto params from the file, not constants.** Iterations and salt live in
  `secrets.enc.json`; the browser derives from what the tool actually wrote. Re-encrypting at a
  higher cost never desyncs the decryptor, and `security.md`'s "≥ 250,000" can rise without a code
  change.
- **`ctx.secrets` exposes functions only; the key and plaintext live in closures.** Keeping the
  `CryptoKey` and decrypted map out of any enumerable/serialisable object makes it structurally hard
  to leak them into logs, the DOM, or storage — the properties `security.md` demands.
- **Decrypt the whole blob, reveal per item.** One passphrase entry unlocks the session (req 2.2);
  subsequent items are one-tap. Simpler and less error-prone than per-item key handling, and the
  blob is tiny.
- **Fetch `secrets.enc.json` lazily on first unlock.** Keeps the encrypted file off the boot
  critical path (consistent with spec 01's preload work) and means a user who never unlocks never
  downloads it.
- **Inline field, never `window.prompt`.** `window.prompt` can be styled inconsistently, can be
  suppressed, and puts the value in a native dialog; an inline `type="password"` field with
  autocomplete off is controllable and testable (req 2.1).
- **"Remember" stores the derived key, not the passphrase.** The passphrase may be reused by the
  user elsewhere; never persisting it limits blast radius. Persisting the key is inherently
  extractable, but its exposure equals physical possession of the unlocked phone — the stated
  meaning of the feature.
- **Copy fallback selects on-page text rather than pre-filling a prompt.** Spec 01's coordinate
  copy pre-fills `window.prompt`; for a secret that would place the value into a native dialog
  string, so the secure fallback is to select the already-revealed text instead.
