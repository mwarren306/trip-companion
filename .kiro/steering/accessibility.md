---
inclusion: always
---

# Accessibility

WCAG 2.1 AA as the floor. This is used outdoors on a phone, so contrast and target size matter
more than usual.

- Text contrast ≥ 4.5:1 against its background. Every token pair in `design-system.md` was
  chosen to pass; if you introduce a new pairing, check it.
- Tap targets ≥ 44 × 44 px. Chips, pins, tick circles, action buttons — all of them.
- Focus visible on every interactive element: 2px `--go` outline, 2px offset. Never `outline: none`.
- All icons are decorative and `aria-hidden`, with the meaning carried by adjacent text. Icon-only
  buttons get `aria-label`.
- The map is a `figure` with a text alternative listing the day's stops in order; the map itself is
  `aria-hidden`. The list *is* the accessible version of the map.
- Status is never conveyed by colour alone — every chip has a text label.
- Respect `prefers-reduced-motion`.
- Landmarks: `header`, `nav`, `main`, and one `h1` per view.
- Live region for the trail-status panel so a refreshed status is announced.
