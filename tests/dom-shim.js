// Minimal DOM shim for the acceptance tests (task 13).
//
// Node has no DOM; the shell's views are plain ES modules that build nodes with
// document.createElement and mount into #view / #day-nav / #day-header. This
// shim implements just enough of the DOM for mount() to run headless: element
// creation, class/dataset/attributes, text, append/replaceChildren, event
// listeners with dispatch (so view:unmount teardown fires), a click() helper,
// and querySelector(All) supporting ".cls" and '.cls[data-x="y"]'. It models the
// tree only — no layout — so layout-dependent behaviour (the note clamp's
// scrollHeight measurement) is a no-op here and is verified in the browser.

class El {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.attrs = {};
    this.dataset = {};
    this.classList = new Set();
    this._text = "";
    this._listeners = {};
    this._hidden = false;
  }
  set className(v) { this.classList = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get className() { return [...this.classList].join(" "); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  removeAttribute(k) { delete this.attrs[k]; }
  set textContent(v) { this._text = String(v); this.children = []; }
  get textContent() {
    return this.children.length ? this.children.map((c) => c.textContent).join("") : this._text;
  }
  set hidden(v) { this._hidden = !!v; }
  get hidden() { return this._hidden; }
  // Anchors set href/target/rel; buttons set type. Store where useful.
  set href(v) { this.attrs.href = v; }
  get href() { return this.attrs.href; }
  set target(v) { this.attrs.target = v; }
  set rel(v) { this.attrs.rel = v; }
  // Form-control properties behave as real readable/writable properties.
  set type(v) { this._type = v; }
  get type() { return this._type; }
  set value(v) { this._value = v; }
  get value() { return this._value ?? ""; }
  set checked(v) { this._checked = !!v; }
  get checked() { return !!this._checked; }

  append(...kids) { for (const k of kids) this.children.push(k); }
  replaceChildren(...kids) { this.children = [...kids]; }

  addEventListener(type, fn, opts) { (this._listeners[type] ??= []).push({ fn, once: !!(opts && opts.once) }); }
  dispatchEvent(evt) {
    const ls = this._listeners[evt.type] || [];
    const results = [];
    this._listeners[evt.type] = ls.filter((l) => { results.push(l.fn(evt)); return !l.once; });
    // Expose the (possibly async) listener results so tests can await them.
    this._lastDispatch = Promise.all(results.map((r) => Promise.resolve(r)));
    return true;
  }
  click() { this.dispatchEvent({ type: "click" }); return this._lastDispatch; }
  // Fire a submit event with a working preventDefault (forms use it). Returns a
  // promise that settles when async submit handlers finish.
  submit() { this.dispatchEvent({ type: "submit", preventDefault() {} }); return this._lastDispatch; }
  focus() { this._focused = true; }
  scrollIntoView() {}

  // Layout stubs — no geometry in the shim.
  get scrollHeight() { return 0; }
  get clientHeight() { return 0; }
  get scrollWidth() { return 0; }
  get clientWidth() { return 0; }
  getBoundingClientRect() { return { top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0 }; }

  _walk(pred, out) {
    for (const c of this.children) {
      if (c instanceof El) {
        if (pred(c)) out.push(c);
        c._walk(pred, out);
      }
    }
    return out;
  }
  querySelectorAll(sel) { return this._walk(matcher(sel), []); }
  querySelector(sel) { return this._walk(matcher(sel), [])[0] ?? null; }
}

// Supports ".cls" and '.cls[data-name="value"]' (value may be unquoted).
function matcher(sel) {
  const m = String(sel).match(/^\.([\w-]+)(?:\[data-([\w-]+)=(?:"([^"]*)"|([^\]]*))\])?$/);
  if (!m) return () => false;
  const [, cls, dataKey, dq, uq] = m;
  const camel = dataKey ? dataKey.replace(/-([a-z])/g, (_, c) => c.toUpperCase()) : null;
  const want = dq !== undefined ? dq : uq;
  return (el) => {
    if (!el.classList.has(cls)) return false;
    if (camel && el.dataset[camel] !== want) return false;
    return true;
  };
}

/**
 * Install the shim as globals and return the landmark elements the shell uses.
 * Call resetDom() before each mount so #day-nav / #day-header / #view are fresh.
 * @returns {{ view: El, dayNav: El, dayHeader: El, reset: () => object }}
 */
export function installDom() {
  const byId = {};
  const make = () => {
    byId["view"] = new El("main");
    byId["day-nav"] = new El("nav");
    byId["day-header"] = new El("div");
    return byId;
  };
  make();

  globalThis.document = {
    createElement: (t) => new El(t),
    createElementNS: (_ns, t) => new El(t),
    createTextNode: (t) => {
      const n = { textContent: String(t), classList: new Set(), children: [] };
      return n;
    },
    getElementById: (id) => byId[id] ?? null,
  };
  globalThis.CustomEvent = class { constructor(type, init) { this.type = type; Object.assign(this, init); } };
  globalThis.CSS = { escape: (s) => String(s) };

  // In-memory localStorage for the store.
  const mem = new Map();
  globalThis.localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
    clear: () => mem.clear(),
  };

  return {
    get view() { return byId["view"]; },
    get dayNav() { return byId["day-nav"]; },
    get dayHeader() { return byId["day-header"]; },
    reset() { mem.clear(); return make(); },
  };
}

export { El };
