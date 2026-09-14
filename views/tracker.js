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

  const label = document.createElement("p");
  label.className = "todo-label";
  label.textContent = todo.label;
  body.append(label);

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
