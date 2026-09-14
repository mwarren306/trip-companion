// To-sort view — the running checklist of things to sort before and during the
// trip (requirements section 6). Renders data.todo, persists ticks through the
// store exactly as stop check-off does, shows the open count, and — before the
// trip — the days until start. The day-nav and day-header regions stay empty
// for this view.

/**
 * Mount the To-sort view.
 * @param {HTMLElement} el container (<main id="view">)
 * @param {object} ctx shared context from app.js
 */
export function mount(el, ctx) {
  // This view owns neither day chips nor the day header; clear them so nothing
  // from a previous Days render lingers.
  document.getElementById("day-nav")?.replaceChildren();
  document.getElementById("day-header")?.replaceChildren();

  const todos = Array.isArray(ctx.data.todo) ? ctx.data.todo : [];

  const h1 = document.createElement("h1");
  h1.className = "tracker-title";
  h1.textContent = "To sort";
  el.append(h1);

  // Days until start, above the list, when before the trip (6.6).
  if (ctx.daysUntilStart != null) {
    const days = document.createElement("p");
    days.className = "days-until";
    days.textContent =
      ctx.daysUntilStart === 1 ? "1 day until the trip." : `${ctx.daysUntilStart} days until the trip.`;
    el.append(days);
  }

  // Forget on this phone (spec 05, req 2.4) — shown only when a derived key is
  // remembered on this device. Placed before the empty-state return so it
  // appears regardless of whether there is anything to sort.
  if (ctx.secrets) renderForget(el, ctx);

  // Empty state (6.7).
  if (todos.length === 0) {
    const empty = document.createElement("p");
    empty.className = "todo-note";
    empty.textContent = "Nothing to sort.";
    el.append(empty);
    return;
  }

  // Open-count line (6.5). Held in a closure so ticks can update it in place.
  const count = document.createElement("p");
  count.className = "todo-count";
  el.append(count);

  const list = document.createElement("ul");
  list.className = "todo-list";
  el.append(list);

  const rows = todos.map((todo) => renderRow(todo, ctx));
  for (const { li } of rows) list.append(li);

  function refreshCount() {
    const open = todos.reduce((n, t) => n + (ctx.store.get(t.id) ? 0 : 1), 0);
    count.textContent = `${open} of ${todos.length} to sort`;
  }
  refreshCount();

  // Re-render on any store change (local tick or, in spec 06, a remote sync).
  const unsubscribe = ctx.store.subscribe((id) => {
    const row = rows.find((r) => r.todo.id === id);
    if (row) row.sync();
    refreshCount();
  });

  // Best-effort cleanup when the view is torn down (navigate clears <main>).
  el.addEventListener("view:unmount", unsubscribe, { once: true });
}

/**
 * Build one todo row.
 * @returns {{ li: HTMLElement, todo: object, sync: () => void }}
 */
function renderRow(todo, ctx) {
  const li = document.createElement("li");
  li.className = "todo-item";

  const tick = document.createElement("button");
  tick.type = "button";
  tick.className = "tick";
  tick.setAttribute("aria-label", `Mark "${todo.label}" done`);
  const box = document.createElement("span");
  box.className = "tick-box";
  box.setAttribute("aria-hidden", "true");
  tick.append(box);
  li.append(tick);

  const body = document.createElement("div");
  body.className = "todo-body";

  // Label. When the todo names a `stop`, the label is a link that navigates to
  // that stop's day and highlights the card (req 6.9); otherwise it is plain
  // text. The link is a button (in-app navigation, not a URL).
  const label = document.createElement("p");
  label.className = "todo-label";
  const dayN = todo.stop ? dayOfStop(ctx.data, todo.stop) : null;
  if (todo.stop && dayN != null) {
    const link = document.createElement("button");
    link.type = "button";
    link.className = "todo-link";
    link.textContent = todo.label;
    link.addEventListener("click", () => {
      ctx.navigate("days", dayN, { focusStopId: todo.stop });
    });
    label.append(link);
  } else {
    label.textContent = todo.label;
  }
  body.append(label);

  // "when, where" line under the label, before the note (req 6.8). `when` is
  // always present; `where` is appended with a plain comma when present.
  if (todo.when) {
    const meta = document.createElement("p");
    meta.className = "todo-meta";
    meta.textContent = todo.where ? `${todo.when}, ${todo.where}` : todo.when;
    body.append(meta);
  }

  if (todo.note) {
    const note = document.createElement("p");
    note.className = "todo-note";
    note.textContent = todo.note;
    body.append(note);
  }

  if (todo.due) {
    const due = document.createElement("p");
    due.className = "todo-due";
    due.textContent = `Due ${todo.due}`;
    body.append(due);
  }

  li.append(body);

  function sync() {
    const done = ctx.store.get(todo.id);
    li.dataset.done = String(done);
    tick.setAttribute("aria-pressed", String(done));
  }
  sync();

  tick.addEventListener("click", () => {
    ctx.store.toggle(todo.id);
    // The store subscription drives the re-render; no direct DOM change here.
  });

  return { li, todo, sync };
}

/**
 * "Forget on this phone" — removes the remembered booking key (spec 05, req
 * 2.4). Shown only while a key is remembered; hidden otherwise. Subscribes to
 * ctx.secrets so it appears/disappears live when a key is remembered or the
 * user forgets it, and cleans up on view teardown.
 */
function renderForget(el, ctx) {
  const wrap = document.createElement("div");
  wrap.className = "forget-key";
  el.append(wrap);

  const render = () => {
    wrap.replaceChildren();
    if (!ctx.secrets.isRemembered()) return;
    const line = document.createElement("p");
    line.className = "forget-line";
    line.textContent = "A booking passphrase is remembered on this phone.";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "forget-btn";
    btn.textContent = "Forget on this phone";
    btn.addEventListener("click", () => ctx.secrets.forget());
    wrap.append(line, btn);
  };

  const unsub = ctx.secrets.subscribe(render);
  el.addEventListener("view:unmount", unsub, { once: true });
  render();
}

/**
 * The day number that contains a given stop id, or null if not found. Used to
 * turn a todo's `stop` into a navigation target (req 6.9).
 * @param {object} data itinerary
 * @param {string} stopId
 * @returns {?number}
 */
function dayOfStop(data, stopId) {
  for (const day of data.days) {
    if (day.items.some((i) => i.kind === "stop" && i.id === stopId)) return day.n;
  }
  return null;
}
