// Coordinate helpers for the trip shell: map links and clipboard copy.
//
// Coordinates are { la, lo } — latitude then longitude, the same order
// everywhere (tech.md). Dates and durations live in dates.js; distance/bounds
// helpers for the map are added in spec 03.

/**
 * Build an Apple Maps directions URL for a stop (requirement 4.6).
 *
 * The stop's `directions` field is already an Apple Maps `dirflg` value:
 *   "w" walking, "d" driving, "r" transit. Defaults to walking, the trip's
 * dominant mode, when absent or unrecognised.
 *
 * @param {{ la: number, lo: number, directions?: string }} stop
 * @returns {string} maps.apple.com URL
 */
export function mapsUrl(stop) {
  const flag = ["w", "d", "r"].includes(stop.directions) ? stop.directions : "w";
  return `https://maps.apple.com/?daddr=${stop.la},${stop.lo}&dirflg=${flag}`;
}

/**
 * The "la,lo" string copied by the Copy coordinates action.
 * @param {{ la: number, lo: number }} stop
 * @returns {string}
 */
export function coordString(stop) {
  return `${stop.la},${stop.lo}`;
}

/**
 * Copy a stop's coordinates to the clipboard, falling back to window.prompt when
 * the async Clipboard API is unavailable or rejects (requirement 4.6). The
 * prompt is pre-filled so the value can be copied by hand.
 *
 * @param {{ la: number, lo: number }} stop
 * @returns {Promise<boolean>} true if written via the Clipboard API
 */
export async function copyCoords(stop) {
  const text = coordString(stop);
  if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Permission denied or insecure context — fall through to the prompt.
    }
  }
  if (typeof window !== "undefined" && typeof window.prompt === "function") {
    window.prompt("Copy these coordinates", text);
  }
  return false;
}
