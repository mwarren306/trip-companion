// Days view — the trip shell's primary view: day chips, day header, and the
// timeline of stops and transport legs.
//
// Tasks 4–5 scope: sticky day chips (req 2.1–2.3) and the day header with three
// facts (req 3.1). Task 7 scope: the timeline itself — items in source order,
// the continuous thread, numbered stop cards, and category pins (req 4.1–4.2).
// Stop conditional content (task 8), the compact leg connector (task 9),
// actions (task 10), and check-off (task 11) slot into the seams left here.

import { isoDate, sumMoveTime, daysSince } from "../lib/dates.js";
import { categoryIcon, modeIcon, lockGlyph } from "./icons.js";
import { renderLockAffordance } from "./lock.js";

// A leg whose facts were verified more than this many days ago is flagged in the
// warn colour rather than dim (spec 02, req 3.2).
const VERIFIED_STALE_DAYS = 60;

/** Categories the design system defines a tint/fill token for. */
const KNOWN_CATS = new Set(["sight", "food", "stay", "move", "open"]);

/** Normalise a stop's category to a known token key, defaulting to "open". */
function catOf(stop) {
  return KNOWN_CATS.has(stop.cat) ? stop.cat : "open";
}

// Status chip: map the data-model `status` to its label and token pair
// (design-system.md). `plain` (and anything unknown) shows no chip.
const STATUS = {
  set: { label: "Booked", tone: "ok" },
  flag: { label: "Check this", tone: "warn" },
  open: { label: "Not booked", tone: "open" },
};

/**
 * Mount the Days view.
 * @param {HTMLElement} el container (<main id="view">)
 * @param {object} ctx shared context from app.js
 */
export function mount(el, ctx) {
  const days = ctx.data.days;
  const day = days.find((d) => d.n === ctx.selectedDayN) ?? days[0];
  const todayIso = isoDate(ctx.today);
  // Progress line shows only while the trip is in progress (req 5.3), compared
  // on ISO strings like routing (tech.md: no timezone math).
  const inProgress = todayIso >= ctx.data.start && todayIso <= ctx.data.end;

  const dayStops = day.items.filter((i) => i.kind === "stop");

  renderDayChips(days, day, todayIso, ctx);
  const updateProgress = renderDayHeader(days, day, dayStops, ctx, inProgress);
  renderTimeline(el, day, ctx, updateProgress);

  // Re-render the affected card and the header count when the store changes,
  // including a checkmark synced from another device (spec 06) — no reload.
  // Torn down via the view:unmount event (dispatched by app.js render), the
  // one teardown mechanism shared with the To-sort view.
  if (ctx.store && typeof ctx.store.subscribe === "function") {
    const unsubscribe = ctx.store.subscribe((id, isDone) => {
      const card = el.querySelector(`.stop[data-id="${cssEscape(id)}"]`);
      if (card) applyDoneState(card, isDone);
      updateProgress();
    });
    el.addEventListener("view:unmount", unsubscribe, { once: true });
  }
}

/** Minimal CSS.escape fallback for attribute selectors (stop/leg ids are simple). */
function cssEscape(s) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(s);
  return String(s).replace(/["\\]/g, "\\$&");
}

/**
 * Reflect done state on a stop card: toggle the data attribute (CSS collapses it
 * to a struck-through single line) and keep the tick's aria-pressed in sync.
 */
function applyDoneState(card, isDone) {
  card.dataset.done = String(isDone);
  const tick = card.querySelector(".tick");
  if (tick) {
    tick.setAttribute("aria-pressed", String(isDone));
    const label = isDone ? "Mark not done" : "Mark done";
    tick.setAttribute("aria-label", `${label}: ${card.dataset.name || ""}`.trim());
  }
}

/* --------------------------------------------------------------- timeline */

/**
 * Render the day's timeline: every `day.items` entry in source order, inside
 * the 600px column with a 30px gutter. The continuous thread is drawn by the
 * `.timeline` gutter background (styles), so it never breaks between a stop and
 * the following leg (design decision). Stops get a numbered pin and a
 * category-tinted card; a running counter numbers stops only — legs are
 * unnumbered (req 4.1–4.2).
 */
function renderTimeline(el, day, ctx, updateProgress) {
  const list = document.createElement("ol");
  list.className = "timeline";
  list.setAttribute("aria-label", "Stops and transport for the day");

  let stopNumber = 0;
  for (const item of day.items) {
    if (item.kind === "stop") {
      list.append(renderStop(item, ++stopNumber, ctx, updateProgress));
    } else if (item.kind === "leg") {
      list.append(renderLeg(item, ctx));
    }
  }

  el.append(list);
  revealClampedNoteToggles(list);
}

/**
 * Reveal the "More" control only on notes whose clamped text actually overflows
 * four lines. Measured after the list is in the document (clamped height vs full
 * scrollHeight). Under a test/non-browser DOM without layout, this is a no-op.
 */
function revealClampedNoteToggles(list) {
  for (const wrap of list.querySelectorAll(".note-wrap")) {
    const note = wrap.querySelector(".stop-note");
    const toggle = wrap.querySelector(".note-more");
    if (!note || !toggle) continue;
    // While clamped, scrollHeight exceeds clientHeight iff there's hidden text.
    if (note.scrollHeight - note.clientHeight > 1) {
      toggle.hidden = false;
    }
  }
}

/**
 * A numbered stop card: category pin (number) in the gutter, then a card with a
 * category-tinted icon tile and the time over the name. Conditional content
 * (status chip, window, note, alert) is task 8; the actions row is task 10 and
 * check-off is task 11 — a `.stop-extra` seam is left for them.
 * @param {object} stop
 * @param {number} n running stop number within the day
 * @param {object} ctx shared context (store, geo, navigate)
 * @param {() => void} updateProgress recompute the header "k of n" line
 */
function renderStop(stop, n, ctx, updateProgress) {
  const cat = catOf(stop);

  const li = document.createElement("li");
  li.className = "timeline-item stop";
  li.dataset.cat = cat;
  li.dataset.id = stop.id;
  li.dataset.name = stop.name;
  li.dataset.done = String(ctx.store?.get(stop.id) ?? false);

  // Numbered pin, sits in the gutter over the thread.
  const pin = document.createElement("span");
  pin.className = "pin";
  pin.setAttribute("aria-hidden", "true");
  pin.textContent = String(n);
  li.append(pin);

  const card = document.createElement("article");
  card.className = "stop-card";

  const head = document.createElement("div");
  head.className = "stop-head";

  // Category icon tile: real inline-SVG icon, coloured by category (icons.js).
  const tile = document.createElement("span");
  tile.className = "cat-tile";
  tile.append(categoryIcon(cat));
  head.append(tile);

  const heading = document.createElement("div");
  heading.className = "stop-heading";

  // Time line: the stop's `t`, plus the timed-entry `window` as from–to when
  // present (req 4.5).
  const time = document.createElement("p");
  time.className = "stop-time";
  time.append(document.createTextNode(stop.t));
  if (stop.window && stop.window.from && stop.window.to) {
    const win = document.createElement("span");
    win.className = "stop-window";
    win.textContent = `${stop.window.from}–${stop.window.to}`;
    time.append(win);
  }
  heading.append(time);

  const name = document.createElement("h2");
  name.className = "stop-name";
  // The pin (decorative, aria-hidden) carries the number visually; expose the
  // order to assistive tech via a visually-hidden prefix so the visible heading
  // reads just the name.
  const order = document.createElement("span");
  order.className = "visually-hidden";
  order.textContent = `Stop ${n}: `;
  name.append(order);
  name.append(document.createTextNode(stop.name));
  heading.append(name);

  head.append(heading);

  // Check-off tick (req 5.1–5.2): ≥44px target, aria-pressed reflects done
  // state. Toggling persists via the store, collapses/restores the card (CSS
  // reads data-done), and updates the header count. The store subscription in
  // mount keeps this in sync when the same id is toggled elsewhere.
  const tick = document.createElement("button");
  tick.type = "button";
  tick.className = "tick";
  const isDone = ctx.store?.get(stop.id) ?? false;
  tick.setAttribute("aria-pressed", String(isDone));
  tick.setAttribute("aria-label", `${isDone ? "Mark not done" : "Mark done"}: ${stop.name}`);
  const box = document.createElement("span");
  box.className = "tick-box";
  box.setAttribute("aria-hidden", "true");
  tick.append(box);
  tick.addEventListener("click", () => {
    const next = ctx.store.toggle(stop.id);
    applyDoneState(li, next);
    updateProgress();
  });
  head.append(tick);

  card.append(head);

  // Status chip (req 4.3) — text label, only for known non-plain statuses.
  const status = STATUS[stop.status];
  if (status) {
    const chip = document.createElement("span");
    chip.className = "status-chip";
    chip.dataset.tone = status.tone;
    chip.textContent = status.label;
    card.append(chip);
  }

  // Note (rendered only when present — no placeholder copy). Clamped to four
  // lines so the day scans; a "More" control (revealed only when the note is
  // actually clipped, measured after mount) expands it in place.
  if (stop.note) {
    const noteWrap = document.createElement("div");
    noteWrap.className = "note-wrap";
    noteWrap.dataset.expanded = "false";

    const note = document.createElement("p");
    note.className = "stop-note";
    note.textContent = stop.note;
    noteWrap.append(note);

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "note-more";
    toggle.hidden = true; // revealed after measuring, only when clamped
    toggle.textContent = "More";
    toggle.setAttribute("aria-expanded", "false");
    toggle.addEventListener("click", () => {
      const expanded = noteWrap.dataset.expanded === "true";
      noteWrap.dataset.expanded = String(!expanded);
      toggle.textContent = expanded ? "More" : "Less";
      toggle.setAttribute("aria-expanded", String(!expanded));
    });
    noteWrap.append(toggle);

    card.append(noteWrap);
  }

  // Alert block (req 4.4) — never clamped, never collapsed; warn pair. role=note
  // so the constraint is exposed without hijacking focus like an alert would.
  // These are the reason the app exists, so they always render in full.
  if (stop.alert) {
    const alert = document.createElement("p");
    alert.className = "alert-block";
    alert.setAttribute("role", "note");
    alert.textContent = stop.alert;
    card.append(alert);
  }

  // Lock affordance (spec 05) — between the alert and the actions row, per the
  // design-system card order. Only when this stop carries a booking reference.
  if (stop.hasSecret) {
    card.append(renderLockAffordance(stop, ctx));
  }

  // Actions row (req 4.6, task 10). Check-off (task 11) attaches to this card.
  card.append(renderActions(stop, ctx));

  li.append(card);
  return li;
}

/**
 * Actions row: primary Directions (opens the Apple Maps URL from geo.mapsUrl)
 * and secondary Copy coordinates (geo.copyCoords, prompt fallback). Both are
 * ≥ 44px targets; icons are aria-hidden with the meaning in the text label
 * (req 4.6, design-system.md).
 */
function renderActions(stop, ctx) {
  const row = document.createElement("div");
  row.className = "actions";

  const directions = document.createElement("a");
  directions.className = "btn btn-primary";
  directions.href = ctx.geo.mapsUrl(stop);
  directions.target = "_blank";
  directions.rel = "noopener";
  directions.textContent = "Directions";
  row.append(directions);

  const copy = document.createElement("button");
  copy.type = "button";
  copy.className = "btn btn-secondary";
  copy.textContent = "Copy coordinates";
  copy.addEventListener("click", () => {
    ctx.geo.copyCoords(stop);
  });
  row.append(copy);

  return row;
}

/**
 * A transport leg in the timeline (spec 02). The compact connector — mode icon,
 * bold duration, one summary fact, plus `depart → arrive` and a lock glyph when
 * present — is the ≥44px expand control (aria-expanded). Tapping it toggles the
 * expanded instruction block, which grows inside this same `<li>` so the stops
 * above never move (req 2.3) and the gutter thread stays continuous.
 * @param {object} leg
 * @param {object} ctx shared context (ctx.today, ctx.secrets)
 */
function renderLeg(leg, ctx) {
  const li = document.createElement("li");
  li.className = "timeline-item leg";
  li.dataset.mode = leg.mode;
  li.dataset.id = leg.id;
  li.dataset.expanded = "false";

  // Compact connector is a button so the whole row is one tap target.
  const connector = document.createElement("button");
  connector.type = "button";
  connector.className = "leg-connector";
  connector.setAttribute("aria-expanded", "false");

  const icon = document.createElement("span");
  icon.className = "leg-icon";
  icon.append(modeIcon(leg.mode));
  connector.append(icon);

  const text = document.createElement("p");
  text.className = "leg-text";

  const duration = document.createElement("span");
  duration.className = "leg-duration";
  duration.textContent = leg.duration;
  text.append(duration);

  // One summary fact, comma-separated (real text node, never concatenated).
  // `distance` is deliberately never shown in the compact form.
  if (leg.summary) {
    text.append(document.createTextNode(", "));
    const summary = document.createElement("span");
    summary.className = "leg-summary";
    summary.textContent = leg.summary;
    text.append(summary);
  }

  // depart → arrive in tabular numerals (req 1.2), only when timed.
  if (leg.depart && leg.arrive) {
    const times = document.createElement("span");
    times.className = "leg-times";
    times.textContent = `${leg.depart} → ${leg.arrive}`;
    text.append(times);
  }

  connector.append(text);

  // Lock glyph when a booking reference is attached (req 1.3).
  if (leg.hasSecret) {
    const lock = document.createElement("span");
    lock.className = "leg-lock-glyph";
    lock.append(lockGlyph());
    connector.append(lock);
  }

  li.append(connector);

  // Expanded panel, built once and toggled (req 2.1, 2.3). One leg open at a
  // time: opening this one closes any sibling that is open.
  const panel = renderExpandedLeg(leg, ctx);
  li.append(panel);

  connector.addEventListener("click", () => {
    const open = li.dataset.expanded === "true";
    if (!open) collapseOpenSiblings(li);
    li.dataset.expanded = String(!open);
    connector.setAttribute("aria-expanded", String(!open));
  });

  return li;
}

/** Collapse any other expanded leg in the same timeline (one open at a time). */
function collapseOpenSiblings(current) {
  const list = current.parentElement;
  if (!list) return;
  for (const li of list.children) {
    if (li !== current && li.classList?.has("leg") && li.dataset.expanded === "true") {
      li.dataset.expanded = "false";
      li.querySelector(".leg-connector")?.setAttribute("aria-expanded", "false");
    }
  }
}

/**
 * The expanded instruction block for a leg (req 2.1). Renders, in this order and
 * only when present: line/operator; depart → arrive; steps (numbered); buy;
 * cost; validate; platform; fallback; verified + source (dim, or warn when the
 * facts are more than 60 days old, req 3.2). When the leg has a booking
 * reference, the spec-05 lock affordance is mounted at the foot (req 2.2).
 * Values are shown verbatim — nothing here computes a fare, time, or platform
 * (req 3.3).
 * @param {object} leg
 * @param {object} ctx
 * @returns {HTMLElement}
 */
function renderExpandedLeg(leg, ctx) {
  const panel = document.createElement("div");
  panel.className = "leg-detail";
  panel.setAttribute("role", "region");

  // line / operator
  if (leg.line || leg.operator) {
    const head = document.createElement("p");
    head.className = "leg-line";
    head.textContent = [leg.line, leg.operator].filter(Boolean).join(", ");
    panel.append(head);
  }

  // depart → arrive (full, tabular)
  if (leg.depart && leg.arrive) {
    const times = document.createElement("p");
    times.className = "leg-detail-times";
    times.textContent = `${leg.depart} → ${leg.arrive}`;
    panel.append(times);
  }

  // steps — numbered instruction list
  if (Array.isArray(leg.steps) && leg.steps.length) {
    const ol = document.createElement("ol");
    ol.className = "leg-steps";
    for (const step of leg.steps) {
      const item = document.createElement("li");
      item.textContent = step;
      ol.append(item);
    }
    panel.append(ol);
  }

  // buy / cost / validate / platform / fallback — labelled rows, only when present
  appendDetailRow(panel, "Buy", leg.buy);
  appendDetailRow(panel, "Cost", leg.cost);
  appendDetailRow(panel, "Validate", leg.validate);
  appendDetailRow(panel, "Platform", leg.platform);
  appendDetailRow(panel, "Fallback", leg.fallback);

  // verified + source — dim, or warn when stale (> 60 days). Verbatim source.
  if (leg.verified || leg.source) {
    const prov = document.createElement("p");
    prov.className = "leg-provenance";
    const age = daysSince(leg.verified, ctx?.today ?? new Date());
    const stale = age != null && age > VERIFIED_STALE_DAYS;
    if (stale) prov.classList.add("is-stale");
    const label = leg.verified ? `Checked ${leg.verified}` : "";
    const src = leg.source ? `${label ? " — " : ""}${leg.source}` : "";
    prov.textContent = `${label}${src}`;
    panel.append(prov);
  }

  // Booking reference (req 2.2) — spec 05's affordance, reused unchanged.
  if (leg.hasSecret) {
    panel.append(renderLockAffordance(leg, ctx));
  }

  return panel;
}

/** Append a `Label: value` detail row, only when the value is present. */
function appendDetailRow(panel, label, value) {
  if (!value) return;
  const row = document.createElement("p");
  row.className = "leg-detail-row";
  const dt = document.createElement("span");
  dt.className = "leg-detail-label";
  dt.textContent = `${label}: `;
  row.append(dt, document.createTextNode(value));
  panel.append(row);
}

/* ------------------------------------------------------------------ chips */

/**
 * Render the sticky, horizontally scrolling day chips into <nav id="day-nav">.
 * The selected chip is filled; today's chip is marked distinctly (not by colour
 * alone) and carries aria-current (req 2.1–2.3, accessibility.md).
 */
function renderDayChips(days, selectedDay, todayIso, ctx) {
  const nav = document.getElementById("day-nav");
  nav.replaceChildren();

  const list = document.createElement("ul");
  list.className = "chips";

  for (const d of days) {
    const isSelected = d.n === selectedDay.n;
    const isToday = d.iso === todayIso;

    const li = document.createElement("li");
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    if (isSelected) chip.classList.add("is-selected");
    if (isToday) {
      chip.classList.add("is-today");
      chip.setAttribute("aria-current", "date");
    }
    chip.setAttribute("aria-pressed", String(isSelected));

    // Text cue so "today" never relies on colour alone. Rendered inline as a
    // small suffix on one line so today's chip is the same height as the rest.
    const label = document.createElement("span");
    label.className = "chip-label";
    label.textContent = d.date;
    chip.append(label);
    if (isToday) {
      const cue = document.createElement("span");
      cue.className = "chip-today-cue";
      cue.textContent = "Today";
      chip.append(cue);
    }

    chip.addEventListener("click", () => {
      ctx.navigate("days", d.n);
      chip.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
    });

    li.append(chip);
    list.append(li);
  }

  nav.append(list);
}

/* ----------------------------------------------------------------- header */

/**
 * Render the day header: eyebrow "Day n of N — place", h1 title, and three fact
 * tiles (stops, time on the move, first stop). While the trip is in progress, a
 * "k of n stops done" line is shown and kept live (req 3.1, 5.3).
 * @returns {() => void} updateProgress — recomputes the "k of n stops done"
 *   line from the store; a no-op when the line isn't shown.
 */
function renderDayHeader(days, day, dayStops, ctx, inProgress) {
  const header = document.getElementById("day-header");
  header.replaceChildren();

  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = `Day ${day.n} of ${days.length} — ${day.place}`;
  header.append(eyebrow);

  const h1 = document.createElement("h1");
  h1.className = "day-title";
  h1.textContent = day.title;
  header.append(h1);

  // Progress line (req 5.3): only while the trip is in progress. Recomputed from
  // the store on every toggle/sync so it never drifts from the cards.
  let updateProgress = () => {};
  if (inProgress && dayStops.length) {
    const progress = document.createElement("p");
    progress.className = "progress";
    progress.setAttribute("aria-live", "polite");
    header.append(progress);
    updateProgress = () => {
      const done = dayStops.reduce((k, s) => k + (ctx.store?.get(s.id) ? 1 : 0), 0);
      progress.textContent = `${done} of ${dayStops.length} stops done`;
    };
    updateProgress();
  }

  const facts = document.createElement("dl");
  facts.className = "facts";

  const legs = day.items.filter((i) => i.kind === "leg");

  appendFact(facts, "Stops", String(dayStops.length));
  appendFact(facts, "On the move", sumMoveTime(legs.map((l) => l.duration)));
  const firstStop = dayStops[0];
  if (firstStop) appendFact(facts, "First stop", firstStop.t);

  header.append(facts);
  return updateProgress;
}

function appendFact(dl, term, value) {
  const wrap = document.createElement("div");
  wrap.className = "fact";
  const dt = document.createElement("dt");
  dt.textContent = term;
  const dd = document.createElement("dd");
  dd.textContent = value;
  wrap.append(dt, dd);
  dl.append(wrap);
}
