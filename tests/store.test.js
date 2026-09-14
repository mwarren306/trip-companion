// Progress store tests (req 5.1–5.2, 6.3–6.5): toggle, persistence, and the
// subscribe notification the To-sort open count relies on. Node has no
// localStorage, so we install a minimal in-memory shim before importing.

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Minimal localStorage shim.
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
};

const { createStore } = await import("../lib/store.js");

beforeEach(() => mem.clear());

test("toggle flips done state and returns the new value", () => {
  const s = createStore();
  assert.equal(s.get("t1"), false);
  assert.equal(s.toggle("t1"), true);
  assert.equal(s.get("t1"), true);
  assert.equal(s.toggle("t1"), false);
  assert.equal(s.get("t1"), false);
});

test("done state persists across store instances (reload)", () => {
  const first = createStore();
  first.toggle("t2");
  const second = createStore();
  assert.equal(second.get("t2"), true);
});

test("subscribers are notified with id and new state", () => {
  const s = createStore();
  const seen = [];
  const off = s.subscribe((id, isDone) => seen.push([id, isDone]));
  s.toggle("t3");
  s.toggle("t3");
  off();
  s.toggle("t3"); // after unsubscribe — not observed
  assert.deepEqual(seen, [["t3", true], ["t3", false]]);
});

test("open count derives from get() across a todo list", () => {
  const todos = [{ id: "t1" }, { id: "t2" }, { id: "t3" }];
  const s = createStore();
  const open = () => todos.reduce((n, t) => n + (s.get(t.id) ? 0 : 1), 0);
  assert.equal(open(), 3);
  s.toggle("t1");
  assert.equal(open(), 2);
  s.toggle("t2");
  assert.equal(open(), 1);
  s.toggle("t1"); // restore
  assert.equal(open(), 2);
});
