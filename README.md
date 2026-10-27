# 24/7 Rentals & Tours: booking app

Stage 2 (front end) of the plan in [PLAN.md](PLAN.md). Phone app for iOS and Android: [mobile/](mobile/README.md). Flow picture: [booking-flow.svg](booking-flow.svg).

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

| Page | What to try |
|---|---|
| `/book` | Book a self-drive, day tour or long-term tour. Units already booked for your dates are greyed out. |
| `/my-bookings` | Sign in with `0917 123 4567`, code `123456` (sample customer Ana). |
| `/owner` | Nole's dashboard: Today, Calendar, Needs action (verify GCash ref nos.), Payments, Units (block dates), Customers, Texts. |

## What's real and what's pretend (Stage 2)

| Piece | Now | Becomes |
|---|---|---|
| Data | Saved in this browser (localStorage). "Reset demo" on /owner restores sample data. | Supabase tables (Stage 3) |
| Slot check | Runs on screen **and** again when saving | Database overlap rule (Stage 3) |
| SMS log-in code | Always `123456` | Supabase phone log-in (Stage 4) |
| GCash / QR Ph | "Simulate successful payment" button | PayMongo hosted checkout + webhook (Stage 5) |
| Text reminders | Shown in the owner's Texts tab | Semaphore with registered sender `247RENTALS` (Stage 5) |

House rules (deposit %, buffer, hold time, cancellation tiers) live in `src/lib/config.ts`. They are placeholders until Nole answers PLAN.md section 10.
