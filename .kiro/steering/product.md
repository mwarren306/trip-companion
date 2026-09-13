---
inclusion: always
---

# Product

A private trip companion for two people — Matt and Nancy — travelling Rome → Cinque Terre →
Florence → Venice, 16–25 September 2026. It is not a general travel app. It has exactly two users
and one trip, and every decision should be made for them.

## The job it does

Answer three questions in under five seconds, on a phone, outdoors, often with no signal:

1. Where are we going next?
2. How exactly do we get there — which door, which platform, which ticket, what it costs?
3. What must we not forget right now?

## Conditions it runs in

- One-handed, walking, in September sun and in dim restaurants
- Frequently with no data: the Cinque Terre trails, the Corniglia station staircase, the calli
  behind San Marco, the Frecciabianca between tunnels
- Under time pressure: timed museum entries, a lunch booking at the tail of service, a train that
  won't wait
- Sometimes mildly lost

## What "correct" means here

Transport instructions are the highest-stakes content. A wrong platform, a wrong fare, a wrong
"this ticket needs stamping" costs real money or a missed connection. Every transport leg in the
data was verified against a primary source (operator site, airport authority, park authority, the
hotel itself) in September 2026 and carries a `verified` date. Do not invent transport facts. Do
not round fares. If a fact isn't in `itinerary.json`, it isn't in the app.

## Source of truth

`itinerary.json` is derived from the master planning document `italy-2026.html`, which is
maintained separately. When they disagree, the HTML wins and the JSON is regenerated. The app
never edits itinerary content; it only records progress (checkmarks) and reads.

## Non-goals

- No accounts, no login, no user management
- No editing of the itinerary inside the app
- No recommendations, discovery, or "explore" features
- No analytics, tracking, or third-party scripts beyond the map tile provider and Supabase
