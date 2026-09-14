// Secure bookings — the unlock flow (spec 05).
//
// Owns the one piece of decrypted runtime state: a session AES-GCM key and the
// decrypted { id: reference } map, both held in closures created by
// createSecrets() and never placed on ctx as data. ctx.secrets exposes only
// functions (security.md: nothing decrypted in storage, the URL, the DOM as an
// attribute, or the console). This file also renders the lock affordance, the
// inline passphrase prompt, the reveal + Copy, and the background re-lock.

import { deriveKey, deriveKeyExtractable, decryptBlob, exportKey, importKey } from "../lib/crypto.js";

const BLOB_URL = "data/secrets.enc.json";
const REMEMBER_KEY = "secrets.key"; // localStorage: stored derived key (JWK), opt-in only
const RELOCK_AFTER_MS = 5 * 60 * 1000; // req 3.2

/**
 * Create the secrets session. The CryptoKey and decrypted map live only in this
 * closure. Returns the ctx.secrets surface (functions only).
 * @returns {object} ctx.secrets
 */
export function createSecrets() {
  let key = null; // in-memory session key (CryptoKey) or null when locked
  let refs = null; // decrypted { id: reference } map, or null when locked
  let blob = null; // cached encrypted file, fetched lazily on first unlock
  const listeners = new Set();

  function emit() {
    for (const fn of listeners) fn();
  }

  /** Fetch and cache the encrypted blob once. Kept off the boot critical path. */
  async function loadBlob() {
    if (blob) return blob;
    const res = await fetch(BLOB_URL);
    if (!res.ok) throw new Error("blob-unavailable");
    blob = await res.json();
    return blob;
  }

  /** Decrypt the whole blob with the current key into the refs map. */
  async function decryptInto(k) {
    const b = await loadBlob();
    refs = await decryptBlob(k, b); // throws on wrong key (caught by callers)
    key = k;
    emit();
  }

  return {
    /** @returns {boolean} is a key held this session? */
    hasKey() {
      return key !== null;
    },

    /**
     * Derive a key from the passphrase, decrypt the blob, cache in memory. When
     * `remember` is true, also persist the derived key (JWK) — never the
     * passphrase, never a decrypted value.
     * @returns {Promise<boolean>} true on success, false on any failure
     */
    async unlock(passphrase, remember = false) {
      try {
        const b = await loadBlob();
        if (remember) {
          const k = await deriveKeyExtractable(passphrase, b);
          await decryptInto(k);
          try {
            localStorage.setItem(REMEMBER_KEY, JSON.stringify(await exportKey(k)));
          } catch {
            // Storage unavailable — remember degrades to session-only.
          }
        } else {
          await decryptInto(await deriveKey(passphrase, b));
        }
        return true;
      } catch {
        // Wrong passphrase, or blob missing/corrupt: caller shows the readable
        // message. Nothing logged, no reason surfaced.
        return false;
      }
    },

    /**
     * Import a remembered key from localStorage, if present, and decrypt.
     * Best-effort and non-blocking at boot.
     * @returns {Promise<boolean>}
     */
    async useRemembered() {
      let jwk;
      try {
        const raw = localStorage.getItem(REMEMBER_KEY);
        if (!raw) return false;
        jwk = JSON.parse(raw);
      } catch {
        return false;
      }
      try {
        await decryptInto(await importKey(jwk));
        return true;
      } catch {
        // Stored key no longer matches the blob (re-encrypted) — drop it.
        try { localStorage.removeItem(REMEMBER_KEY); } catch { /* ignore */ }
        return false;
      }
    },

    /** @returns {?string} decrypted reference for id, or null if locked/absent. */
    get(id) {
      return refs ? (refs[id] ?? null) : null;
    },

    /** @returns {boolean} is a key currently persisted on this device? */
    isRemembered() {
      try {
        return localStorage.getItem(REMEMBER_KEY) !== null;
      } catch {
        return false;
      }
    },

    /** Clear the remembered key and drop the in-memory key; re-locks everything. */
    forget() {
      try { localStorage.removeItem(REMEMBER_KEY); } catch { /* ignore */ }
      key = null;
      refs = null;
      emit();
    },

    /** Drop the in-memory key/map (background re-lock). Remembered key untouched. */
    lock() {
      key = null;
      refs = null;
      emit();
    },

    /** Subscribe to lock-state changes (unlock/forget/re-lock). */
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

/**
 * Install the background re-lock: after the app is hidden for more than 5
 * minutes, drop the in-memory key unless a key is remembered (req 3.2). Wired
 * once at boot. Uses document visibility; safe to call in a non-DOM context
 * (no-op when document is absent).
 * @param {object} secrets ctx.secrets
 */
export function installBackgroundRelock(secrets) {
  if (typeof document === "undefined" || !document.addEventListener) return;
  let hiddenAt = 0;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      hiddenAt = Date.now();
    } else if (document.visibilityState === "visible") {
      if (hiddenAt && Date.now() - hiddenAt > RELOCK_AFTER_MS && !secrets.isRemembered()) {
        secrets.lock();
      }
      hiddenAt = 0;
    }
  });
}

/* ------------------------------------------------------ lock affordance UI */

/**
 * Render the lock affordance for a stop or leg that has `hasSecret: true` — the
 * seam spec 01 left on the card (and spec 02's expanded leg reuses). Returns an
 * element that renders one of three states and swaps between them in place:
 *   - locked: dashed box, "Booking reference hidden", right-aligned "Unlock"
 *   - prompting: inline passphrase field + Remember checkbox (no window.prompt)
 *   - revealed: the reference as selectable text with a Copy action
 * Subscribes to ctx.secrets so unlock/forget/re-lock re-render it (req 2.2).
 *
 * @param {{ id: string }} item stop or leg carrying the secret id
 * @param {object} ctx shared context (ctx.secrets)
 * @returns {HTMLElement}
 */
export function renderLockAffordance(item, ctx) {
  const box = document.createElement("div");
  box.className = "lock";
  box.dataset.state = "locked";

  const render = () => {
    if (ctx.secrets.hasKey()) {
      renderRevealed(box, item, ctx);
    } else {
      renderLocked(box, item, ctx);
    }
  };

  // Re-render on any lock-state change; unsubscribe when the card is torn down
  // (view:unmount, the shared teardown from spec 01).
  const unsub = ctx.secrets.subscribe(render);
  const view = document.getElementById("view");
  view?.addEventListener("view:unmount", unsub, { once: true });

  render();
  return box;
}

/** Locked state: dashed box + Unlock. Tapping Unlock reveals (one-tap when a
 *  key is already held) or opens the inline prompt (req 2.1, 2.2). */
function renderLocked(box, item, ctx) {
  box.dataset.state = "locked";
  box.replaceChildren();

  const label = document.createElement("span");
  label.className = "lock-label";
  label.textContent = "Booking reference hidden";
  box.append(label);

  const unlock = document.createElement("button");
  unlock.type = "button";
  unlock.className = "lock-unlock";
  unlock.textContent = "Unlock";
  unlock.addEventListener("click", () => {
    if (ctx.secrets.hasKey()) {
      renderRevealed(box, item, ctx); // one-tap: session key already held
    } else {
      renderPrompt(box, item, ctx);
    }
  });
  box.append(unlock);
}

/** Prompt state: inline password field + Remember checkbox, never window.prompt
 *  (req 2.1). On submit, unlock and reveal, or show the readable error (req 2.3). */
function renderPrompt(box, item, ctx) {
  box.dataset.state = "prompting";
  box.replaceChildren();

  const form = document.createElement("form");
  form.className = "lock-form";

  const field = document.createElement("input");
  field.type = "password";
  field.className = "lock-field";
  field.setAttribute("aria-label", "Passphrase");
  field.placeholder = "Passphrase";
  field.autocomplete = "off";
  field.setAttribute("autocapitalize", "off");
  field.setAttribute("autocorrect", "off");
  field.spellcheck = false;
  form.append(field);

  const remember = document.createElement("label");
  remember.className = "lock-remember";
  const cb = document.createElement("input");
  cb.type = "checkbox"; // defaults unchecked (req 2.1, 2.4)
  remember.append(cb, document.createTextNode(" Remember on this phone"));
  form.append(remember);

  const error = document.createElement("p");
  error.className = "lock-error";
  error.hidden = true;
  error.setAttribute("role", "alert");
  form.append(error);

  const actions = document.createElement("div");
  actions.className = "lock-actions";
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "btn btn-primary lock-submit";
  submit.textContent = "Unlock";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "btn btn-secondary lock-cancel";
  cancel.textContent = "Cancel";
  cancel.addEventListener("click", () => renderLocked(box, item, ctx));
  actions.append(submit, cancel);
  form.append(actions);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const passphrase = field.value;
    // Read then clear the field; the passphrase string is not retained.
    field.value = "";
    const ok = await ctx.secrets.unlock(passphrase, cb.checked);
    if (ok) {
      renderRevealed(box, item, ctx); // subscription re-renders the other cards
    } else {
      // Wrong passphrase (or blob problem): readable message, field already
      // cleared, focus returned. No stack trace, no console, no network retry.
      error.textContent = "That passphrase didn't work";
      error.hidden = false;
      field.focus();
    }
  });

  box.append(form);
  field.focus?.();
}

/** Revealed state: the reference as selectable text + Copy (req 3.1). Shows a
 *  plain notice when the id has no reference on file (error-handling case). */
function renderRevealed(box, item, ctx) {
  box.dataset.state = "revealed";
  box.replaceChildren();

  const value = ctx.secrets.get(item.id);
  if (value == null) {
    const none = document.createElement("p");
    none.className = "lock-none";
    none.textContent = "No reference on file for this item.";
    box.append(none);
    return;
  }

  // Selectable text — the value appears ONLY as text content the user asked to
  // see, never as an attribute, title, aria-label, URL, or log (security.md).
  const out = document.createElement("output");
  out.className = "lock-value";
  out.textContent = value;
  box.append(out);

  const copy = document.createElement("button");
  copy.type = "button";
  copy.className = "lock-copy";
  copy.textContent = "Copy";
  copy.addEventListener("click", () => copyReference(out, value));
  box.append(copy);
}

/**
 * Copy the revealed reference. Prefers the async Clipboard API; when it is
 * unavailable or rejects, falls back to selecting the on-page text so the user
 * can copy by hand — never pre-fills window.prompt with the value (that would
 * put a secret into a native dialog string).
 */
async function copyReference(outEl, value) {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // fall through to selection
    }
  }
  try {
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(outEl);
    sel.removeAllRanges();
    sel.addRange(range);
  } catch {
    // Selection unavailable — the value is visible for manual copy regardless.
  }
}
