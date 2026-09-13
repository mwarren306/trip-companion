// Fails if any leg is missing required fields or any fare is a bare number.
import { readFile } from "node:fs/promises";
const d = JSON.parse(await readFile("data/itinerary.json", "utf8"));
const errs = [];
for (const day of d.days) {
  let prev = null;
  for (const it of day.items) {
    if (it.kind === "leg") {
      for (const k of ["steps", "duration", "verified", "source"]) if (!it[k]) errs.push(`${it.id}: missing ${k}`);
      if (Array.isArray(it.steps) && it.steps.some(s => s.length > 140)) errs.push(`${it.id}: a step exceeds 140 chars`);
      if (it.cost !== undefined && typeof it.cost !== "string") errs.push(`${it.id}: cost must be a display string`);
      if (prev?.kind !== "stop") errs.push(`${it.id}: leg must follow a stop`);
    } else if (it.kind === "stop") {
      for (const k of ["id", "t", "name", "la", "lo", "cat", "status", "note"]) if (it[k] === undefined) errs.push(`${it.id ?? "?"}: missing ${k}`);
    } else errs.push(`${day.n}: unknown item kind ${it.kind}`);
    prev = it;
  }
  if (day.items.at(-1)?.kind === "leg") errs.push(`day ${day.n}: ends on a leg`);
}
if (errs.length) { console.error(errs.join("\n")); process.exit(1); }
console.log(`itinerary.json valid — ${d.days.length} days`);
