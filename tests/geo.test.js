// Coordinate helper tests (requirement 4.6). Pure functions only; copyCoords is
// exercised in the browser since it depends on the Clipboard API / window.prompt.

import { test } from "node:test";
import assert from "node:assert/strict";

import { mapsUrl, coordString } from "../lib/geo.js";

test("coordString joins latitude and longitude in la,lo order", () => {
  assert.equal(coordString({ la: 41.9028, lo: 12.4964 }), "41.9028,12.4964");
});

test("mapsUrl builds an Apple Maps directions URL with the stop's dirflg", () => {
  assert.equal(
    mapsUrl({ la: 41.9028, lo: 12.4964, directions: "w" }),
    "https://maps.apple.com/?daddr=41.9028,12.4964&dirflg=w",
  );
  assert.equal(
    mapsUrl({ la: 41.89, lo: 12.49, directions: "r" }),
    "https://maps.apple.com/?daddr=41.89,12.49&dirflg=r",
  );
});

test("mapsUrl defaults to walking when directions is missing or unknown", () => {
  assert.match(mapsUrl({ la: 1, lo: 2 }), /dirflg=w$/);
  assert.match(mapsUrl({ la: 1, lo: 2, directions: "x" }), /dirflg=w$/);
});
