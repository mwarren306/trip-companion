// Progress store — persists which stops and todo items are checked off.
//
// This is the local half: a set of done ids in localStorage. Checkmarks are the
// only thing stored on the device (tech.md); nothing sensitive lives here.
// Supabase sync and the offline queue are spec 06 and layer on top of the same
// get / toggle / subscribe surface without changing it.

const KEY = "progress.done";

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function save(done) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...done]));
  } catch {
    // Storage unavailable — done state is in-memory for this session only.
  }
}

/**
 * Create a progress store.
 * @returns {{ get(id): boolean, toggle(id): boolean, subscribe(fn): () => void }}
 */
export function createStore() {
  const done = load();
  const listeners = new Set();

  function emit(id, isDone) {
    for (const fn of listeners) fn(id, isDone);
  }

  return {
    /** @returns {boolean} whether `id` is checked off. */
    get(id) {
      return done.has(id);
    },

    /**
     * Flip the done state of `id`, persist, and notify subscribers.
     * @returns {boolean} the new done state.
     */
    toggle(id) {
      const next = !done.has(id);
      if (next) done.add(id);
      else done.delete(id);
      save(done);
      emit(id, next);
      return next;
    },

    /**
     * Subscribe to changes. `fn(id, isDone)` runs after each toggle (and, in
     * spec 06, after a remote sync updates local state).
     * @returns {() => void} unsubscribe
     */
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
