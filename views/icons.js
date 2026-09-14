// Inline SVG icons for the trip shell.
//
// design-system.md: icons are inline SVG, 1.9px stroke, round caps, no emoji.
// Every icon is decorative — meaning is always carried by adjacent text — so
// each <svg> is marked aria-hidden and focusable="false". Stroke colour is
// `currentColor`, so the caller sets colour via CSS (category tint, --mid, etc).

const NS = "http://www.w3.org/2000/svg";

/**
 * Build an aria-hidden 24×24 stroked icon from a list of SVG child specs.
 * @param {Array<[string, Record<string,string|number>]>} parts [tag, attrs]
 * @returns {SVGSVGElement}
 */
function svg(parts) {
  const el = document.createElementNS(NS, "svg");
  el.setAttribute("viewBox", "0 0 24 24");
  el.setAttribute("width", "24");
  el.setAttribute("height", "24");
  el.setAttribute("fill", "none");
  el.setAttribute("stroke", "currentColor");
  el.setAttribute("stroke-width", "1.9");
  el.setAttribute("stroke-linecap", "round");
  el.setAttribute("stroke-linejoin", "round");
  el.setAttribute("aria-hidden", "true");
  el.setAttribute("focusable", "false");
  for (const [tag, attrs] of parts) {
    const child = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) child.setAttribute(k, String(v));
    el.append(child);
  }
  return el;
}

/* ----------------------------------------------------------- categories */
// sight → landmark, food → fork, stay → bed, move → train, open → question.

const CATEGORY = {
  sight: () =>
    svg([
      ["path", { d: "M4 21h16" }], // ground line
      ["path", { d: "M6 21V10" }], // left column
      ["path", { d: "M10 21V10" }],
      ["path", { d: "M14 21V10" }],
      ["path", { d: "M18 21V10" }], // right column
      ["path", { d: "M4 10h16" }], // architrave
      ["path", { d: "M12 3 4 8h16z" }], // pediment
    ]),
  food: () =>
    svg([
      ["path", { d: "M7 3v7" }], // fork tines centre
      ["path", { d: "M4 3v4a3 3 0 0 0 6 0V3" }], // outer tines
      ["path", { d: "M7 10v11" }], // handle
      ["path", { d: "M17 3c-1.5 0-3 2-3 6 0 2 1 3 3 3" }], // knife/spoon bowl
      ["path", { d: "M17 3v18" }], // knife handle
    ]),
  stay: () =>
    svg([
      ["path", { d: "M3 7v12" }], // headboard post
      ["path", { d: "M3 13h18v6" }], // mattress line + foot post
      ["path", { d: "M3 13v-2a2 2 0 0 1 2-2h9a3 3 0 0 1 3 3v1" }], // pillow + body
    ]),
  move: () =>
    svg([
      ["rect", { x: "5", y: "3", width: "14", height: "13", rx: "3" }], // body
      ["path", { d: "M5 11h14" }], // window band
      ["path", { d: "M9 16l-2 4" }], // left leg
      ["path", { d: "M15 16l2 4" }], // right leg
      ["circle", { cx: "9", cy: "13.5", r: "0.6" }], // headlights
      ["circle", { cx: "15", cy: "13.5", r: "0.6" }],
    ]),
  open: () =>
    svg([
      ["path", { d: "M9.2 9a3 3 0 1 1 4.3 2.7c-1 .5-1.5 1.1-1.5 2.3" }], // question hook
      ["circle", { cx: "12", cy: "18", r: "0.6" }], // dot
    ]),
};

/* ----------------------------------------------------------------- modes */
// Leg mode icons. Modes not drawn fall back to a generic move arrow so a leg
// always shows something meaningful (duration text carries the real meaning).

const MODE = {
  walk: () =>
    svg([
      ["circle", { cx: "13", cy: "4.5", r: "1.6" }], // head
      ["path", { d: "M13 8v5" }], // torso
      ["path", { d: "M13 13l-3 8" }], // back leg
      ["path", { d: "M13 13l3 4 1 4" }], // front leg
      ["path", { d: "M13 9l-4 2" }], // back arm
      ["path", { d: "M13 9l4 1" }], // front arm
    ]),
  taxi: () =>
    svg([
      ["path", { d: "M4 15l1.5-5A2 2 0 0 1 7.4 8.5h9.2a2 2 0 0 1 1.9 1.5L20 15" }], // roof
      ["rect", { x: "3", y: "15", width: "18", height: "5", rx: "2" }], // body
      ["path", { d: "M10 5h4" }], // taxi sign top
      ["path", { d: "M12 5v3.5" }],
      ["circle", { cx: "7.5", cy: "20", r: "1.2" }],
      ["circle", { cx: "16.5", cy: "20", r: "1.2" }],
    ]),
  train: () => MODE_TRAIN(),
  tram: () => MODE_TRAIN(),
  bus: () =>
    svg([
      ["rect", { x: "4", y: "4", width: "16", height: "13", rx: "3" }],
      ["path", { d: "M4 11h16" }],
      ["path", { d: "M8 17v3" }],
      ["path", { d: "M16 17v3" }],
      ["circle", { cx: "8", cy: "14", r: "0.6" }],
      ["circle", { cx: "16", cy: "14", r: "0.6" }],
    ]),
  vaporetto: () => MODE_BOAT(),
  boat: () => MODE_BOAT(),
  shuttle: () => MODE_BUS_ALIAS(),
  flight: () =>
    svg([
      ["path", { d: "M21 15l-8-2-3 7-2 0 1.5-8L3 10.5 3 8l8 2 5-6a1.6 1.6 0 0 1 2.3 2.2l-3 4 3.7 1.3z" }],
    ]),
};

function MODE_TRAIN() {
  return svg([
    ["rect", { x: "6", y: "3", width: "12", height: "14", rx: "3" }],
    ["path", { d: "M6 11h12" }],
    ["path", { d: "M9 17l-2 4" }],
    ["path", { d: "M15 17l2 4" }],
    ["circle", { cx: "9", cy: "14", r: "0.6" }],
    ["circle", { cx: "15", cy: "14", r: "0.6" }],
  ]);
}

function MODE_BOAT() {
  return svg([
    ["path", { d: "M3 15h18l-2 4a2 2 0 0 1-1.8 1.1H6.8A2 2 0 0 1 5 19z" }], // hull
    ["path", { d: "M6 15V8h7l4 7" }], // cabin
    ["path", { d: "M9 8V5" }], // mast
  ]);
}

function MODE_BUS_ALIAS() {
  return MODE.bus();
}

/**
 * A category icon element (decorative). Falls back to the "open" question mark
 * for unknown categories so a tile always draws something.
 * @param {string} cat
 * @returns {SVGSVGElement}
 */
export function categoryIcon(cat) {
  return (CATEGORY[cat] ?? CATEGORY.open)();
}

/**
 * A transport-mode icon element (decorative). Falls back to the train glyph for
 * unknown modes; the leg's duration/summary text carries the real meaning.
 * @param {string} mode
 * @returns {SVGSVGElement}
 */
export function modeIcon(mode) {
  return (MODE[mode] ?? MODE_TRAIN)();
}
