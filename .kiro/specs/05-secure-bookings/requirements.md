# Secure bookings — requirements

## Introduction
Every booking reference lives encrypted in `data/secrets.enc.json`. The app decrypts in memory on
demand with a passphrase. See `security.md` for the cryptographic parameters; those are not
negotiable.

## Requirements

### 1. Encryption tool
1.1 `tools/encrypt.mjs` SHALL read `secrets.json` from a path given in `SECRETS_PATH` and the
passphrase from `TRIP_PASSPHRASE`, and write `data/secrets.enc.json`.
1.2 THE TOOL SHALL refuse to run if `secrets.json` is inside the repo and not gitignored.
1.3 THE TOOL SHALL print nothing but the output path and byte count.

### 2. Unlock flow
2.1 WHEN a lock affordance is tapped and no key is held THE SYSTEM SHALL prompt for the passphrase
in an inline field (not `window.prompt`), with a "Remember on this phone" checkbox defaulting off.
2.2 WHEN the passphrase is correct THE SYSTEM SHALL decrypt the whole blob into memory and reveal
the reference for the tapped item only; other locked items become one-tap.
2.3 IF decryption fails THE SYSTEM SHALL show `That passphrase didn't work` and clear the field.
2.4 WHEN "Remember on this phone" is checked THE SYSTEM SHALL store the derived key (not the
passphrase) in `localStorage`; a `Forget on this phone` control in the To-sort view removes it.
2.5 THE SYSTEM SHALL never write a decrypted value to storage, the URL, or the console.

### 3. Reveal
3.1 THE SYSTEM SHALL render a revealed reference as selectable text with a `Copy` action.
3.2 THE SYSTEM SHALL re-lock revealed references when the app is backgrounded for > 5 minutes
unless "Remember" is on.

## Acceptance
- `git ls-files` contains no `secrets.json`; `git log -p` contains no known reference string.
- Wrong passphrase: readable error, no stack trace, no network call.
- Right passphrase: the Borghese stop (4b) reveals the TicketOne order; refresh without "Remember"
  re-locks. (The Termini-leg reveal moved to spec 02, which owns the expanded leg where a leg's lock
  affordance lives; spec 05 ships complete on the stop-card path plus the unlock mechanism.)
