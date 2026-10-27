# Database setup (Stage 3)

Ready to run on a **new, empty** Supabase project. No command line needed.

## Run it (about 5 minutes)

1. Supabase dashboard → your project → **SQL Editor** → **New query**
2. Paste all of `migrations/20261028000000_init.sql` → **Run**. You should see "Success. No rows returned".
3. New query → paste `seed.sql` → **Run** (starting units and Leyte tours; edit them later in Table Editor)
4. **Authentication → Sign In / Providers → Phone**: turn on. Until an SMS provider is connected, add test numbers under
   "Test phone numbers" (e.g. `639171234567=123456`) so log-in works without real texts.
5. After Nole signs in once, find his id in **Authentication → Users**, then run:
   `insert into staff (user_id, role) values ('<his id>', 'OWNER');`

## What's inside

| Piece | What it does |
|---|---|
| `no_double_booking` | The database refuses two busy bookings on the same unit, pickup to return + 2 hrs |
| `create_hold()` | The only way a customer books. Works out the price itself, checks blocks, seats, tour rules, trusted status |
| `payments_reference_once` | The same GCash / bank reference number can't be used twice |
| Row Level Security | Customers see only their own rows; visitors see the fleet, tours and busy times only |
| `licenses`, `receipts` buckets | Private photo storage, one folder per customer |
| `expire_holds()` | Runs every minute (pg_cron) and releases unpaid holds |
| `delete_my_account()` | App Store / Google Play account deletion; keeps amounts and dates for BIR |

## Tested

`tests/run-local.sh` builds a scratch copy on a local Postgres 16 and runs 15 checks, including
10 customers booking the same van in the same second (exactly 1 wins). The files in `tests/`
are for local testing only; don't run `00_local_stub.sql` on Supabase.
