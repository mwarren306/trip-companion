// To-sort view acceptance tests (task 13; req 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7).
//
// Mounts the real tracker view against an in-memory todo list using the DOM
// shim: renders label/note/due (optional fields omitted when absent), the open
// count, and — before the trip — the days-until line; ticking strikes through
// and decrements the count; empty todo shows a single line.

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { installDom } from "./dom-shim.js";

const dom = installDom();
import * as geo from "../lib/geo.js";
import { createStore } from "../lib/store.js";
import { mount } from "../views/tracker.js";

const todos = () => [
  { id: "t1", label: "Call Belforte", note: "Confirm the boat.", due: "2026-09-18" },
  { id: "t2", label: "Download offline maps" }, // no note, no due
  { id: "t3", label: "Print tickets", due: "2026-09-16" }, // due, no note
];

const makeCtx = (overrides = {}) => ({
  data: { todo: todos() },
  geo,
  store: createStore(),
  daysUntilStart: null,
  navigate() {},
  ...overrides,
});

beforeEach(() => dom.reset());

test("renders each todo's label; note and due only when present (req 6.1, 6.2)", () => {
  mount(dom.view, makeCtx());
  const rows = dom.view.querySelectorAll(".todo-item");
  assert.equal(rows.length, 3);

  assert.equal(rows[0].querySelector(".todo-label").textContent, "Call Belforte");
  assert.equal(rows[0].querySelector(".todo-note").textContent, "Confirm the boat.");
  assert.equal(rows[0].querySelector(".todo-due").textContent, "Due 2026-09-18");

  // t2: no note, no due.
  assert.equal(rows[1].querySelector(".todo-note"), null);
  assert.equal(rows[1].querySelector(".todo-due"), null);

  // t3: due but no note.
  assert.equal(rows[2].querySelector(".todo-note"), null);
  assert.equal(rows[2].querySelector(".todo-due").textContent, "Due 2026-09-16");
});

test("shows the open count under the title (req 6.5)", () => {
  mount(dom.view, makeCtx());
  assert.equal(dom.view.querySelector(".todo-count").textContent, "3 of 3 to sort");
});

test("shows the days-until line before the trip (req 6.6)", () => {
  mount(dom.view, makeCtx({ daysUntilStart: 6 }));
  assert.equal(dom.view.querySelector(".days-until").textContent, "6 days until the trip.");

  dom.reset();
  mount(dom.view, makeCtx({ daysUntilStart: 1 }));
  assert.equal(dom.view.querySelector(".days-until").textContent, "1 day until the trip.");
});

test("no days-until line once the trip has started (daysUntilStart null)", () => {
  mount(dom.view, makeCtx({ daysUntilStart: null }));
  assert.equal(dom.view.querySelector(".days-until"), null);
});

test("ticking strikes the item through and decrements the open count; re-tick restores", () => {
  const ctx = makeCtx();
  mount(dom.view, ctx);
  const count = dom.view.querySelector(".todo-count");
  const row = dom.view.querySelector('.todo-item[data-done="false"]');
  const tick = row.querySelector(".tick");

  tick.click();
  assert.equal(row.dataset.done, "true", "row marked done (struck through via CSS)");
  assert.equal(tick.getAttribute("aria-pressed"), "true");
  assert.equal(count.textContent, "2 of 3 to sort", "open count decrements");

  tick.click();
  assert.equal(row.dataset.done, "false", "re-tick restores");
  assert.equal(count.textContent, "3 of 3 to sort");
});

test("empty todo shows a single 'Nothing to sort.' line, not an empty list (req 6.7)", () => {
  mount(dom.view, makeCtx({ data: { todo: [] } }));
  assert.equal(dom.view.querySelector(".todo-list"), null);
  const note = dom.view.querySelector(".todo-note");
  assert.equal(note.textContent, "Nothing to sort.");
});

// --- when / where line + stop link (req 6.8, 6.9) ---------------------------

const dataWithDays = {
  days: [{ n: 2, iso: "2026-09-17", items: [{ kind: "stop", id: "2e", name: "San Pietro" }] }],
  todo: [
    { id: "a1", label: "With when and where", when: "Thu 17 Sep", where: "Rome" },
    { id: "a2", label: "When only", when: "Before you fly" },
    { id: "a3", label: "Linked to a stop", when: "Thu 17 Sep", where: "Rome", stop: "2e" },
  ],
};

test("renders 'when, where' as a dim line under the label, before the note (req 6.8)", () => {
  mount(dom.view, { data: dataWithDays, geo, store: createStore(), daysUntilStart: null, navigate() {} });
  const rows = dom.view.querySelectorAll(".todo-item");
  assert.equal(rows[0].querySelector(".todo-meta").textContent, "Thu 17 Sep, Rome");
  // when only → no comma, no where
  assert.equal(rows[1].querySelector(".todo-meta").textContent, "Before you fly");
});

test("a todo with a stop renders its label as a link that navigates to the stop's day (req 6.9)", () => {
  const calls = [];
  mount(dom.view, {
    data: dataWithDays, geo, store: createStore(), daysUntilStart: null,
    navigate: (view, dayN, opts) => calls.push([view, dayN, opts]),
  });
  const rows = dom.view.querySelectorAll(".todo-item");

  // a1/a2 have no stop → plain label, no link.
  assert.equal(rows[0].querySelector(".todo-link"), null);
  // a3 has stop "2e" (on day 2) → label is a link.
  const link = rows[2].querySelector(".todo-link");
  assert.ok(link, "linked todo renders a .todo-link");
  assert.equal(link.textContent, "Linked to a stop");

  link.click();
  assert.deepEqual(calls, [["days", 2, { focusStopId: "2e" }]], "navigates to the stop's day with focusStopId");
});
