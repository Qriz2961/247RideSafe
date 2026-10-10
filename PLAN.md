# PLAN.md — 24/7 Vehicle Rental & Tours Booking App

> Stage 1 of the 6-stage app playbook. **No code yet.** This file is the brief the AI coding tool will build from.
> Owner: **Nole Candizo** · Drafted: 10 Oct 2026

---

## 0. My take before we start

- **The real enemy here is the double booking, not the design.** Most small rental shops in PH run on a Facebook page, a Messenger inbox and a notebook. The day two customers show up for the same Innova, you lose both and get a 1-star review. Every back-end rule below exists to stop that.
- **A deposit should be required, not optional.** The brief says "make a deposit *or* sign a booking agreement." I'd push back on that. A signed agreement with no money behind it is easy to walk away from. During Holy Week, Christmas and long weekends, no-shows on agreement-only bookings will cost Nole real money.
  - My rule: **deposit required for everyone**, with one exception: **agreement-only for returning customers or corporate accounts** that Nole marks as "trusted."
- **COD should only cover the balance, never the deposit.** If the deposit is COD, nothing is held. COD works for the balance at pickup.
- **Start with manual GCash/bank checking plus one automatic option, not five gateways.** Nole can check a GCash reference number in 10 seconds. Add the automatic gateway (PayMongo) once bookings pass about 30 a month, when checking by hand starts to eat his day.

---

## 1. Who it's for

| User | What they want | Device |
|---|---|---|
| **Customer** (local family, balikbayan, barkada, small company) | See what's free, book a unit or tour, pay the deposit, get a text reminder | Phone, often on mobile data, so pages must stay light |
| **Owner** (Nole Candizo) | See every booking at a glance, confirm payments, block units for repair, know who picks up tomorrow | Phone first, laptop second |
| **Driver / staff** (later) | See today's assignments only | Phone |

**Services sold**

| Service | How it's priced | Notes |
|---|---|---|
| Self-drive rental | Per 24 hours | Needs a valid license (PH, or foreign license within 90 days of arrival). Minimum age to be set by Nole (Europcar PH uses 21). |
| With driver | Per day or per trip | Driver's meals and lodging on overnight trips: Nole to set the rule |
| **6-hour Day Tour** | Fixed package price | Fixed start times (e.g. 6:00 AM, 1:00 PM). Includes driver and fuel? Nole to confirm. |
| **Long-term Tour** | Per day, multi-day package | Multi-day itinerary; the unit is blocked for the whole span |

---

## 2. Screens (front end, the "dining room")

### 2.1 Booking page (public)

1. **Pick what you need:** Self-drive · With driver · 6-hour Day Tour · Long-term Tour
2. **Pick the date and time:**
   - Rentals: pickup date/time + return date/time
   - Day Tour: date + start slot (6-hour window shown)
   - Long-term Tour: start date + number of days
3. **Pick a unit:** only units that are free for that window are shown (photo, seats, transmission, fuel type, rate). Units that are taken are greyed out, not hidden, so the customer knows to try another date.
4. **Your details:** name, mobile (+63), email (optional), pickup/drop-off spot, number of passengers. Self-drive adds a license number and a photo upload.
5. **Price summary:** total, deposit due now, balance due at pickup, refundable security deposit (self-drive only).
6. **Lock it in:** choose one:
   - **Pay deposit via GCash** (QR Ph through PayMongo, confirmed automatically), or
   - **Pay deposit via bank transfer / GCash send-money** (upload a screenshot and enter the reference number; Nole confirms), or
   - **Sign agreement only** (shown only to "trusted" customers)
   - Then: tick and type your name to e-sign the **Booking Agreement**. The customer can't continue without this.
7. **Confirmation screen:** booking code (e.g. `247-K3F9`), status, what happens next, a Messenger/Viber link to Nole.

> A **hold timer** shows: "We're holding this unit for 30:00." If the deposit isn't done in time, the unit goes back on sale.

### 2.2 My Bookings (customer)

- Sign in with a **one-time code sent by SMS** (no password; most customers will never remember one)
- List: upcoming / past / cancelled
- Each card: booking code, unit, dates, status badge, amount paid, balance
- Actions: upload proof of payment, view/download the signed agreement (PDF), request cancellation, message the owner

### 2.3 Owner dashboard (Nole only)

| Panel | What it shows | Why it matters |
|---|---|---|
| **Today / Tomorrow** | Pickups, returns, tours starting, with customer phone numbers you can tap to call | Nole's morning checklist |
| **Calendar board** | Rows = units, columns = days, bars = bookings (colour by status) | See the gaps and the clashes at a glance |
| **Needs action** | Bookings waiting for payment proof, holds about to expire, cancellation requests | Nothing sits unattended |
| **Payments** | Deposits received, balances due, COD to collect today, method breakdown | Ties to the daily cash count |
| **Units** | Add/edit unit, rates, photos, **block dates** (casa/PMS service, repair, personal use) | Stops booking a car that's at the shop |
| **Customers** | History, total spent, "trusted" flag, "do not rent" flag | Repeat-customer perks; protection from bad renters |
| **Tours** | Edit packages, itineraries, slot times, prices | |
| **Manual booking** | Encode walk-in or Messenger bookings | Still the same slot check, so no double booking even from Messenger |

---

## 3. What the kitchen does (back-end jobs)

| # | Job | Plain-language rule | Done when |
|---|---|---|---|
| 1 | **Check the slot is free** | A unit is "busy" if any booking that is *held, pending, confirmed or ongoing* overlaps the requested window, **plus a 2-hour turnaround buffer** (cleaning, refuel, checking). Blocked dates count as busy. The database itself refuses overlaps, not just the screen. | Two people pressing "book" on the same unit at the same second: only one gets it |
| 2 | **Choose a vehicle unit** | Customer picks from free units. For tours, the app can auto-pick the smallest free unit that fits the passenger count. Nole can reassign later. | |
| 3 | **Hold the unit** | Booking saved as `HELD` with a 30-minute expiry. A job runs every few minutes and releases expired holds. | Abandoned bookings don't block real ones |
| 4 | **Take the deposit or the signed agreement** | GCash via PayMongo: the payment provider tells our server it's paid (this message is called a *webhook*, basically the payment company "texting" our server) → status `CONFIRMED`. Bank/GCash screenshot → `PENDING_VERIFICATION` until Nole taps **Verify**. Agreement-only → trusted customers only, goes straight to `CONFIRMED`. | |
| 5 | **Record the booking agreement** | Store the agreement version, typed name, tick-box, date/time, IP address, and a PDF copy. | Nole can pull the signed copy if there's a dispute or an accident |
| 6 | **Save the booking** | Save with a short booking code, price breakdown and status history (who changed what, when). | |
| 7 | **Text reminders** | SMS on: booking confirmed · 24 hrs before pickup · 2 hrs before pickup · 2 hrs before return (self-drive) · balance due. Sent via a PH SMS provider (e.g. Semaphore) under a **registered sender name** like `247RENTALS`. | Customer gets the text; it's logged |
| 8 | **Handle the balance** | Balance method: **COD at pickup**, bank transfer or GCash. Nole marks it "collected" with amount and method. COD isn't marked paid until he taps it. | Cash count matches the app |
| 9 | **Cancel and refund** | Apply Nole's policy automatically (example: 72+ hrs before = full deposit back or rebook; 24–72 hrs = 50%; under 24 hrs or no-show = forfeit). Refunds are done manually; the app only computes the amount and logs it. | |
| 10 | **Tell Nole** | New booking / proof uploaded / cancellation → SMS or email to Nole. | |

**Booking statuses (one booking moves left to right)**

`HELD` → `PENDING_VERIFICATION` → `CONFIRMED` → `ONGOING` (picked up) → `COMPLETED`
Side exits: `EXPIRED` (hold ran out) · `CANCELLED` · `NO_SHOW`

---

## 4. What goes in the pantry (database tables)

| Table | Key fields | Notes |
|---|---|---|
| **customers** | id, full_name, mobile, email, license_no, license_photo, license_expiry, is_trusted, is_blocked, created_at | License photos are a **government ID**, which counts as *sensitive* data under the Data Privacy Act. Store in a private bucket; delete after X months. |
| **units** | id, plate_no, name (e.g. "Toyota Innova 2023 – White"), type (sedan/MPV/van/SUV), seats, transmission, fuel, daily_rate, with_driver_rate, photos, status (active/maintenance/retired) | |
| **unit_blocks** | id, unit_id, start_at, end_at, reason | PMS, repair, coding day, personal use |
| **tours** | id, name, type (`DAY_6H` / `LONG_TERM`), duration_hours or days, base_price, max_pax, itinerary, start_slots, includes (driver, fuel, tolls) | Package catalogue |
| **bookings** | id, code, customer_id, unit_id, tour_id (nullable), service_type (`SELF_DRIVE` / `WITH_DRIVER` / `DAY_TOUR` / `LONG_TOUR`), start_at, end_at, pax, pickup_location, total, deposit_due, balance_due, security_deposit, status, hold_expires_at, created_by (customer/owner) | The "no overlap" rule lives here at the database level |
| **payments** | id, booking_id, kind (deposit/balance/security/refund), method (`GCASH_PAYMONGO` / `GCASH_MANUAL` / `BANK` / `COD`), amount, reference_no, proof_image, status, verified_by, verified_at | Kept separate from bookings so partial payments and refunds don't get messy |
| **agreements** | id, booking_id, version, signed_name, signed_at, ip, pdf_url | |
| **sms_log** | id, booking_id, to, template, sent_at, provider_status | Proof that the reminder went out |
| **booking_events** | id, booking_id, from_status, to_status, by, at, note | Audit trail |

**Who sees what (Row Level Security: a database rule that filters rows per user)**
- Customer: only their own customers/bookings/payments/agreements rows
- Owner: everything
- Public: units and tours catalogue + *busy/free* dates only (never names or numbers)

---

## 5. Payments: Philippine setup

| Method | Used for | How it confirms | Cost (verify) | My take |
|---|---|---|---|---|
| **GCash via PayMongo (QR Ph / GCash)** | Deposit, balance | Automatic (webhook) | Reported at about **1.5%–2.5% per transaction**; card about 3.1–3.5% + ₱13–15. Sources disagree, so check PayMongo's own pricing page. | Best for the deposit: instant, no checking screenshots at midnight |
| **GCash send-money (manual)** | Deposit, balance | Screenshot + ref no., Nole verifies | Free | Fine at low volume. Watch for **fake/edited screenshots**: always match the ref no. in the GCash app before verifying. |
| **Bank transfer (BDO/BPI/UnionBank via InstaPay)** | Deposit, balance, corporate | Screenshot + ref no., Nole verifies | InstaPay fee on the sender's side | Corporates prefer this; they'll ask for an **Official Receipt**, so BIR registration matters |
| **COD** | Balance only, at pickup | Nole taps "collected" | Free | Never for the deposit |

- Card payments: same PayMongo checkout. Use the **hosted checkout** page so the app never touches card numbers.
- Build and test in **test mode** first; run one full fake booking before switching to live keys.
- Alternatives if PayMongo onboarding stalls: Xendit, Maya Business, HitPay.

---

## 6. SMS reminders: Philippine setup

- Provider: **Semaphore** (PH-based; local rates) or Twilio (more expensive to PH numbers).
- **Register the sender name first.** Unregistered alphanumeric sender IDs have been blocked by Globe/Smart since 2025. Expect paperwork: business documents (DTI/SEC), a Letter of Authorization per carrier, and sample messages. **Allow 1–3 weeks**; start this on day one, in parallel with the build.
- Keep texts under 160 characters to avoid paying for 2 messages. Example:
  `247: Hi Ana, pickup tomorrow 8AM, Innova ABC1234 @ Robinsons Iloilo. Balance P3,500 (COD/GCash). Ref 247-K3F9`

---

## 7. Legal / compliance checklist (Nole to confirm with a lawyer/accountant)

| Item | Why | Status |
|---|---|---|
| **LTFRB franchise / exemption** | Renting out vehicles, especially *with driver* or tours, may need a franchise. LTFRB MC 2011-008 exempts some long-term-lease rentals. Self-drive vs with-driver vs tours may be treated differently. | ☐ Verify |
| **DTI/SEC + Mayor's permit + BIR** | Needed for official receipts and for SMS sender registration | ☐ |
| **Data Privacy Act (RA 10173)** | License photos = sensitive personal info. Need a privacy notice on the booking page, consent tick-box, retention period. NPC registration thresholds are unclear across sources (250 staff / 1,000+ persons' sensitive data / high-risk processing); at minimum file the exemption or register. | ☐ Verify |
| **Insurance** | Comprehensive + passenger accident cover, especially for tours | ☐ |
| **Booking Agreement text** | Damage, fuel policy, late return fee, out-of-area rule (e.g. no RoRo without approval), smoking, traffic violations, number-coding days | ☐ Nole to draft; app just displays and records it |

---

## 8. Build stages (from the playbook)

| # | Stage | Done when | Est. effort |
|---|---|---|---|
| 1 | Plan | This file approved by Nole | ✅ now |
| 2 | Front end | Booking flow works on localhost:3000 with fake data | 1–2 sessions |
| 3 | Back end + database (Supabase) | Test booking saves and loads; **overlap test passes** | 1–2 sessions |
| 4 | Log-in (SMS one-time code) + RLS | Two test customers can't see each other's bookings | 1 session |
| 5 | Payments + SMS | Test-mode GCash payment confirms automatically; reminder text arrives | 1–2 sessions (+ waiting on sender ID) |
| 6 | Go live (Vercel + domain) | Domain loads on HTTPS with live keys | 1 session |

**Running costs (rough)**

| Item | Cost |
|---|---|
| Supabase, Vercel | Free tier to start |
| Domain (.com or .ph) | about ₱700/yr (.com); .ph costs more |
| SMS | Per message; budget about ₱1/text locally (verify current Semaphore rate) |
| PayMongo | % per transaction only (verify) |

---

## 9. Later (nice-to-haves, not in v1)

- Driver app: today's trips, check-in/out photos of the car (dents, fuel gauge, odometer)
- Damage photo checklist at pickup and return
- Messenger chatbot that links to the booking page
- Dynamic pricing for peak dates (Holy Week, Christmas, Sinulog/Dinagyang/MassKara)
- Loyalty discount for repeat customers
- n8n automation: new booking → Google Sheet → Nole's Viber group
- GPS tracker integration for self-drive units
- Multi-branch / partner units (other owners listing their cars)

---

## 10. Open questions for Nole

1. Deposit amount: fixed (e.g. ₱1,000) or a percentage (e.g. 30%)?
2. Turnaround buffer between bookings: 2 hours OK?
3. Self-drive: minimum age, security deposit amount, accepted IDs?
4. Day Tour: fixed start times? Fuel, tolls and parking included?
5. Long-term Tour: driver's meals and lodging, who pays?
6. Cancellation policy: OK with the 72h / 24h tiers above?
7. Area: which city/province is the base? (Affects tour packages and SMS copy.)
8. Business registration status: DTI/SEC, BIR, LTFRB?
