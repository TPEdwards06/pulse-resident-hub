# Pulse — resident communication hub

**The One-Stop Shop for Student Housing Complexes.** MAN 327H, Team 6 ("Venture Capitalists").

Pulse gives an apartment complex one channel for building-wide announcements *and* messages tailored to each
resident (packages, payments, renewal deadlines and price changes), and tracks whether every resident actually
**saw** and **confirmed** each message. Sending a message isn't the same as the resident seeing it.

- **Live demo (residents):** https://tpedwards06.github.io/pulse-resident-hub/
- **Live demo (leasing staff):** https://tpedwards06.github.io/pulse-resident-hub/staff
- Use the one-click **Demo as Resident (John Doe)** / **Demo as Staff (Jane Doe – Leasing)** buttons on the login page.
- Staff can restore the original demo data with **Reset demo data** on the staff overview.

## Features

**Resident app** (mobile-first, matches the prototype mockup)
- Home: payment due, unread count, "Apartment Notifications" checklist (tick = read / confirmed), 2×2 tiles, renewal pill
- Full feed with urgent items pinned, message detail with "Got it" confirmation
- Packages, Payments (simulated), Reserve a Room (7 AM–11 PM, ≤2 h, 14 days ahead, max 3 upcoming), searchable FAQ
- Renewal page: countdown to the decision deadline, current vs. offer rent, a clear **price change** notice

**Staff dashboard**
- Compose with an audience builder (building, floor, units, renewal status, lease-end date) and a live recipient count
- Reach analytics for each message (seen % / confirmed %), a list of residents who haven't seen it, and one-click resend to just them
- Renewals board: days left, offer changes, whether the resident ever opened a renewal notice
- Packages and charges (each automatically notifies the resident), FAQ manager with view counts, room bookings
- Pending sign-ups: self-registered accounts get nothing until staff verify their unit

## Stack

TanStack Start + React + Tailwind (frontend), Supabase / Lovable Cloud (Postgres, auth, row-level security, RPCs).

- `drizzle/migrations/0000_pulse_schema_and_seed.sql`: schema, triggers, seed data
- `drizzle/migrations/0001_security_hardening.sql`: security fixes, resident feed RPC, staff reporting RPCs, demo reset

## Security model

- Row-level security on every table. Residents only ever read their own rows.
- Residents read messages only through `my_feed()`. They can't see audience rules, other residents' IDs, or messages scheduled for later.
- An email is linked to a pre-seeded profile, or granted the staff role, only after the address is **confirmed**.
- Postgres `EXECUTE` is revoked from `public`/`anon` on every function. Staff RPCs check `is_staff()`.
- Database-enforced input lengths, room-booking rules, an exclusion constraint against double booking, a staff send limit (30/hour), and one FAQ view per user.

`scripts/stress.mjs` runs 23 abuse and load checks against the backend (double-booking race, cross-resident tampering,
privilege escalation, injection, 300 parallel requests, read-receipt storm, rate limits).

## Development

```sh
npm i
npm run dev            # http://localhost:8080
bash scripts/deploy-pages.sh   # build the static SPA and publish to GitHub Pages
```
