// Date-based routing tests for the trip shell (requirements 1.2–1.4).
//
// Uses Node's built-in test runner — no dependencies, no build step, matching
// the project's no-framework stance (tech.md). Run with:  node --test
//
// These import the real helpers from app.js (which skips its browser auto-boot
// when there is no `document`), so the tests exercise shipping code, not a copy.
// Task 13 extends this file with timeline-order and check-off coverage.

import { test } from "node:test";
import assert from "node:assert/strict";

import { route } from "../app.js";
import { isoDate, daysUntil } from "../lib/dates.js";

const data = {
  start: "2026-09-16",
  end: "2026-09-25",
  days: [
    { n: 1, iso: "2026-09-16" },
    { n: 2, iso: "2026-09-17" },
    { n: 10, iso: "2026-09-25" },
  ],
};

// Local Date constructor: month is 0-indexed, so 8 === September.
const sep = (day) => new Date(2026, 8, day);

test("isoDate formats a local date as YYYY-MM-DD", () => {
  assert.equal(isoDate(sep(3)), "2026-09-03");
  assert.equal(isoDate(sep(17)), "2026-09-17");
});

test("daysUntil counts whole calendar days to the start", () => {
  assert.equal(daysUntil("2026-09-16", sep(10)), 6);
  assert.equal(daysUntil("2026-09-16", sep(15)), 1);
});

test("before the trip: opens the To-sort view with a days-until count", () => {
  const r = route(data, sep(10));
  assert.equal(r.view, "tracker");
  assert.equal(r.dayN, null);
  assert.equal(r.daysUntilStart, 6);
});

test("on the start date (inclusive): opens Days on day 1", () => {
  const r = route(data, sep(16));
  assert.deepEqual(r, { view: "days", dayN: 1, daysUntilStart: null });
});

test("during the trip: opens Days on the matching day", () => {
  const r = route(data, sep(17));
  assert.deepEqual(r, { view: "days", dayN: 2, daysUntilStart: null });
});

test("on the end date (inclusive): opens Days on the last day", () => {
  const r = route(data, sep(25));
  assert.deepEqual(r, { view: "days", dayN: 10, daysUntilStart: null });
});

test("after the trip: opens Days on the last day", () => {
  const r = route(data, sep(30));
  assert.deepEqual(r, { view: "days", dayN: 10, daysUntilStart: null });
});
