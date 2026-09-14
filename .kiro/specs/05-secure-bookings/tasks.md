# Secure bookings — tasks

- [ ] 1. Confirm the encryption tool contract (`tools/encrypt.mjs`)
  - The tool is already written; verify (do not rewrite) that it reads `secrets.json` from
    `SECRETS_PATH` and the passphrase from `TRIP_PASSPHRASE`, refuses to run when the plaintext is
    inside the repo and not gitignored, and prints only the output path and byte count.
  - Confirm it emits `{ v, kdf, iter, salt, iv, ct }` so the browser can read `iter`/`salt` back.
  - Do not add a passphrase or plaintext path default; both stay in the environment only.
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 2. `lib/crypto.js` — WebCrypto helpers
  - Implement `deriveKey(passphrase, { salt, iter })` (PBKDF2-SHA256 → AES-GCM-256) and
    `decryptBlob(key, { iv, ct })` returning the parsed `{ id: reference }` object, rejecting on
    GCM auth failure.
  - Implement base64⇄`Uint8Array` helpers and `exportKey`/`importKey` (JWK) for the Remember path.
  - Read `salt`/`iter`/`iv` from the file, never constants; log nothing; touch no DOM or storage.
  - _Requirements: 2.2, 2.3 (crypto per `security.md`)_

- [ ] 3. The `ctx.secrets` session and lazy blob load
  - In `views/lock.js`, build the `ctx.secrets` object (`hasKey`, `unlock`, `useRemembered`, `get`,
    `remember`, `isRemembered`, `forget`, `lock`, `subscribe`) with the `CryptoKey` and decrypted
    map held in module-scope closures — never on `ctx` as data.
  - Fetch `data/secrets.enc.json` lazily on the first unlock attempt and cache it; not at boot.
  - Wire `app.js` boot to init `ctx.secrets` and call `useRemembered()` (non-blocking).
  - _Requirements: 2.2, 2.5_

- [ ] 4. Lock affordance on stop cards
  - Render the locked box (dashed 1px `--line-2`, 11px radius, dim "Booking reference hidden",
    right-aligned `--go` "Unlock", ≥44px target) on any **stop** with `hasSecret: true` — the seam
    spec 01 left. Export `renderLockAffordance(item, ctx)` so spec 02's expanded leg can reuse it
    unchanged; the leg mount point itself is spec 02's (req 02-2.2).
  - Subscribe each affordance to `ctx.secrets` so unlock/forget/re-lock re-render without a reload.
  - _Requirements: 2.1, 2.2_

- [ ] 5. Inline passphrase prompt
  - On "Unlock" with no key held, expand the affordance into an inline form: a `type="password"`
    field (autocomplete/autocapitalize/spellcheck off), a "Remember on this phone" checkbox
    defaulting **off**, an "Unlock" submit, and a cancel that collapses back.
  - On submit call `ctx.secrets.unlock(value)`; clear the input after reading it. Never
    `window.prompt`.
  - _Requirements: 2.1, 2.4_

- [ ] 6. Decrypt, reveal, and one-tap for the rest
  - On correct passphrase, decrypt the whole blob into memory and reveal the tapped item's
    reference; other locked items become one-tap (no prompt) because the session key is held.
  - _Requirements: 2.2_

- [ ] 7. Wrong-passphrase handling
  - On failure show `That passphrase didn't work` in a `--warn` inline message, clear the field,
    return focus; no stack trace, no console output, no network call.
  - _Requirements: 2.3, 2.5_

- [ ] 8. Reveal as selectable text + Copy
  - Render the revealed reference as selectable text with a `Copy` action
    (`navigator.clipboard.writeText`, falling back to selecting the on-page text — never pre-filling
    a `window.prompt` with the value). The value appears only as text content, never an attribute,
    `title`, `aria-label`, URL, or log.
  - _Requirements: 3.1, 2.5_

- [ ] 9. Remember on this phone / Forget
  - When "Remember" is checked at a successful unlock, store the exported derived key (JWK) in
    `localStorage` under a dedicated key — never the passphrase, never a decrypted value.
  - Add a `Forget on this phone` control in the To-sort view (`views/tracker.js`), shown only when
    `ctx.secrets.isRemembered()`; it clears the stored key and drops the in-memory key, re-locking
    all affordances.
  - Degrade to session-only when `localStorage` is unavailable.
  - _Requirements: 2.4, 2.5_

- [ ] 10. Background re-lock after 5 minutes
  - On `visibilitychange`, timestamp on hide; on show, if > 5 minutes elapsed and "Remember" is
    off, call `ctx.secrets.lock()` and let the subscription re-lock affordances. With "Remember" on,
    reload the key and stay revealable. Threshold is a single named constant.
  - _Requirements: 3.2_

- [ ] 11. Styles
  - Add the lock affordance (locked + revealed), inline prompt, and copy styles to `styles/app.css`,
    drawing every colour from `styles/tokens.css`. Respect `prefers-reduced-motion` for the
    expand/reveal (160ms height/opacity, per `design-system.md`).
  - _Requirements: 2.1, 3.1_

- [ ] 12. Tests (no real secret in any test)
  - `lib/crypto.js`: round-trip a synthetic `{ id: value }` with a random passphrase/salt; assert a
    wrong passphrase rejects without an unhandled throw; assert `iter`/`salt` are read from the blob
    (two blobs, different `iter`); export→import→decrypt (Remember path).
  - Unlock flow (headless DOM shim): Unlock shows the inline field (not `window.prompt`); correct
    passphrase reveals + flips others to one-tap; wrong shows `That passphrase didn't work` and
    clears; Forget re-locks.
  - No-leak: assert no decrypted value or passphrase reaches the shimmed `localStorage`/`console`,
    and that the input is cleared after submit.
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1_

- [ ] 13. Acceptance verification
  - Terminal: `git ls-files` contains no `secrets.json`; `git log -p` contains no known reference
    string (the secret-scan hook plus a manual grep).
  - Wrong passphrase: readable error, no stack trace, no network call.
  - On device: unlock the **Borghese stop (4b)** to reveal the TicketOne order; refresh without
    "Remember" and confirm it re-locks. (The Termini-leg reveal is spec 02's acceptance.)
  - _Requirements: 1.1, 2.1, 2.2, 2.3, 3.1, 3.2_
