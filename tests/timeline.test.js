// Timeline + check-off acceptance tests (task 13; req 4.1, 4.2, 5.1, 5.2, 5.3).
//
// Mounts the real Days view against a small in-memory fixture using the DOM
// shim, then asserts source order, the unbroken thread, stop numbering, and the
// check-off collapse/restore + header count. The clock is injected via ctx.today
// so "during the trip" is a data choice, not a mock of globals (design).

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { installDom } from "./dom-shim.js";

const dom = installDom();
import * as geo from "../lib/geo.js";
import { createStore } from "../lib/store.js";
import { mount } from "../views/days.js";

// A fixture with a start/end range and a 2026-09-17 day (the acceptance day),
// with stop-leg-stop-leg-stop so the thread must pass through legs.
const fixture = () => ({
  trip: "Test",
  start: "2026-09-16",
  end: "2026-09-25",
  generated: "2026-09-13",
  days: [
    {
      n: 2,
      iso: "2026-09-17",
      date: "Thu 17 Sep",
      title: "Ancient Rome",
      place: "Rome",
      items: [
        { kind: "stop", id: "2a", t: "09:00", name: "Colosseum", la: 41.89, lo: 12.49, cat: "sight", status: "set", note: "Booked.", directions: "w" },
        { kind: "leg", id: "2a-2b", mode: "walk", summary: "0.7 km", duration: "9 min", distance: "0.7 km", verified: "2026-09-13", source: "estimate", steps: ["Walk."] },
        { kind: "stop", id: "2b", t: "10:00", name: "Roman Forum", la: 41.892, lo: 12.485, cat: "sight", status: "flag", note: "Same ticket.", directions: "w" },
        { kind: "leg", id: "2b-2c", mode: "train", summary: "Line A", duration: "12 min", verified: "2026-09-13", source: "atac.it", steps: ["Ride."] },
        { kind: "stop", id: "2c", t: "12:00", name: "San Clemente", la: 41.889, lo: 12.497, cat: "sight", window: { from: "11:50", to: "12:00" }, note: "Timed entry.", directions: "w" },
      ],
    },
  ],
  todo: [],
});

const makeCtx = (data, overrides = {}) => ({
  data,
  today: new Date(2026, 8, 17), // Thu 17 Sep — during the trip
  selectedDayN: 2,
  geo,
  store: createStore(),
  navigate() {},
  ...overrides,
});

beforeEach(() => dom.reset());

test("timeline renders all items in source order (Thu 17 Sep)", () => {
  const data = fixture();
  mount(dom.view, makeCtx(data));

  const timeline = dom.view.querySelector(".timeline");
  const kinds = timeline.children.map((li) => (li.classList.has("stop") ? "stop" : "leg"));
  const expected = data.days[0].items.map((i) => i.kind);
  assert.deepEqual(kinds, expected, "rendered order must match source order");
});

test("the thread spans the whole column (one unbroken gutter element)", () => {
  // The thread is the .timeline list's own gutter background — a single element
  // wrapping every item — so it cannot break between a stop and the next leg.
  mount(dom.view, makeCtx(fixture()));
  const threads = dom.view.querySelectorAll(".timeline");
  assert.equal(threads.length, 1);
  assert.equal(threads[0].children.length, 5, "all five items live under the one thread element");
});

test("stops are numbered sequentially; legs are unnumbered", () => {
  mount(dom.view, makeCtx(fixture()));
  const items = dom.view.querySelector(".timeline").children;
  const stopPins = items.filter((li) => li.classList.has("stop")).map((li) => li.querySelector(".pin").textContent);
  assert.deepEqual(stopPins, ["1", "2", "3"]);
  const legsHavePins = items.filter((li) => li.classList.has("leg")).some((li) => li.querySelector(".pin"));
  assert.equal(legsHavePins, false);
});

test("check-off collapses a stop and increments the header count; re-toggle restores", () => {
  const data = fixture();
  const ctx = makeCtx(data);
  mount(dom.view, ctx);

  const progress = dom.dayHeader.querySelector(".progress");
  assert.equal(progress.textContent, "0 of 3 stops done");

  const card = dom.view.querySelector('.stop[data-id="2a"]');
  const tick = card.querySelector(".tick");
  assert.equal(card.dataset.done, "false");
  assert.equal(tick.getAttribute("aria-pressed"), "false");

  tick.click();
  assert.equal(card.dataset.done, "true", "card marked done");
  assert.equal(tick.getAttribute("aria-pressed"), "true");
  assert.equal(ctx.store.get("2a"), true, "persisted via the store");
  assert.equal(progress.textContent, "1 of 3 stops done", "header count increments");

  tick.click();
  assert.equal(card.dataset.done, "false", "re-toggle restores the card");
  assert.equal(progress.textContent, "0 of 3 stops done", "header count decrements");
});

test("an externally toggled checkmark re-renders the card and count (store sync)", () => {
  const data = fixture();
  const ctx = makeCtx(data);
  mount(dom.view, ctx);

  // Simulate a checkmark arriving from another device: toggle the store directly.
  ctx.store.toggle("2c");

  const card = dom.view.querySelector('.stop[data-id="2c"]');
  assert.equal(card.dataset.done, "true", "subscribed card reflects the external change");
  assert.equal(card.querySelector(".tick").getAttribute("aria-pressed"), "true");
  assert.equal(dom.dayHeader.querySelector(".progress").textContent, "1 of 3 stops done");
});

test("the progress line is hidden before the trip (req 5.3)", () => {
  const data = fixture();
  mount(dom.view, makeCtx(data, { today: new Date(2026, 8, 10) })); // before start
  assert.equal(dom.dayHeader.querySelector(".progress"), null);
});

test("view:unmount unsubscribes the Days view so a torn-down view stops updating", () => {
  const data = fixture();
  const ctx = makeCtx(data);
  mount(dom.view, ctx);

  // Tear down as app.js render() does, then reset landmarks and mount fresh.
  dom.view.dispatchEvent(new CustomEvent("view:unmount"));
  const before = dom.dayHeader.querySelector(".progress").textContent;

  // Toggling after teardown must not touch the old header.
  ctx.store.toggle("2a");
  assert.equal(dom.dayHeader.querySelector(".progress").textContent, before, "old view no longer updates after unmount");
});

// --- req 2.4: opening Days before the trip selects the first day, all chips --

// A ten-day fixture (dates only) to exercise chip rendering and default day.
const tenDays = () => ({
  trip: "Test", start: "2026-09-16", end: "2026-09-25", generated: "2026-09-14",
  days: Array.from({ length: 10 }, (_, i) => ({
    n: i + 1,
    iso: `2026-09-${16 + i}`,
    date: `Day ${16 + i}`,
    title: `Day ${i + 1}`,
    place: "Somewhere",
    items: [{ kind: "stop", id: `${i + 1}a`, t: "09:00", name: `Stop ${i + 1}`, la: 41, lo: 12, cat: "sight", directions: "w" }],
  })),
  todo: [],
});

test("opening Days before the trip selects Wed 16 Sep (day 1) with all ten chips (req 2.4)", () => {
  // Before the trip, navigate('days') sets no dayN, so selectedDayN is null and
  // the view defaults to the first day; today is before start.
  mount(dom.view, {
    data: tenDays(), today: new Date(2026, 8, 10), selectedDayN: null,
    geo, store: createStore(), navigate() {},
  });

  const chips = dom.dayNav.querySelectorAll(".chip");
  assert.equal(chips.length, 10, "all ten day chips are available");
  // (the DOM shim's querySelector takes a single class, so filter by classList)
  const selected = chips.filter((c) => c.classList.has("is-selected"));
  assert.equal(selected.length, 1, "exactly one chip is selected");
  assert.equal(selected[0].textContent.includes("Day 16"), true, "the first day (Wed 16 Sep) is selected");
});
