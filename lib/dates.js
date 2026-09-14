// Date and duration helpers for the trip shell.
//
// Calendar dates only — no timezone math (tech.md): itinerary dates are local
// Italian ISO strings and are compared as strings. Coordinates and distances
// live in geo.js; this file is dates and durations.

/** Format a Date as a local YYYY-MM-DD string. */
export function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Whole calendar days from `today` until `startIso`.
 * @param {string} startIso YYYY-MM-DD
 * @param {Date} today
 * @returns {number} positive when today is before start
 */
export function daysUntil(startIso, today) {
  const start = Date.parse(`${startIso}T00:00:00`);
  const now = Date.parse(`${isoDate(today)}T00:00:00`);
  return Math.round((start - now) / 86400000);
}

/**
 * Parse a leg duration string into minutes. Handles "6 min", "3 h 47", "1 h",
 * "45 min". Returns 0 for empty/unparseable input.
 * @param {string} s
 * @returns {number} minutes
 */
export function parseDurationMinutes(s) {
  if (!s) return 0;
  let minutes = 0;
  const h = /(\d+)\s*h/.exec(s);
  if (h) minutes += Number(h[1]) * 60;
  const m = /(?:h\s*)?(\d+)\s*(?:min\b|$)/.exec(s) || /h\s*(\d+)/.exec(s);
  if (m) minutes += Number(m[1]);
  else if (!h) {
    const bare = /(\d+)/.exec(s);
    if (bare) minutes += Number(bare[1]);
  }
  return minutes;
}

/** Format a minute total as a readable duration: "0 min", "15 min", "4 h 32". */
export function formatMinutes(total) {
  if (total <= 0) return "0 min";
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h && m) return `${h} h ${m}`;
  if (h) return `${h} h`;
  return `${m} min`;
}

/**
 * Sum a list of leg duration strings into one readable "time on the move".
 * @param {string[]} durations
 * @returns {string}
 */
export function sumMoveTime(durations) {
  const total = durations.reduce((sum, d) => sum + parseDurationMinutes(d), 0);
  return formatMinutes(total);
}
