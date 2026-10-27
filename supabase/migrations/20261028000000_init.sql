-- 24/7 RideSafe – Stage 3 database (PLAN.md section 4)
--
-- Run once on a fresh Supabase project: Dashboard → SQL Editor → paste → Run.
-- Then run ../seed.sql for the starting units and tours.
--
-- Plain-language map:
--   * The database itself refuses double bookings (constraint no_double_booking).
--   * Prices are worked out here, not on the phone, so nobody can edit the total.
--   * Customers only ever see their own rows (Row Level Security policies).
--   * Customers change bookings only through the functions at the bottom
--     (create_hold, submit_manual_proof, request_cancel, delete_my_account).

create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------- types

create type public.service_type   as enum ('SELF_DRIVE', 'WITH_DRIVER', 'DAY_TOUR', 'LONG_TOUR');
create type public.booking_status as enum ('HELD', 'PENDING_VERIFICATION', 'CONFIRMED', 'ONGOING', 'COMPLETED', 'EXPIRED', 'CANCELLED', 'NO_SHOW');
create type public.payment_method as enum ('GCASH_PAYMONGO', 'GCASH_MANUAL', 'BANK', 'COD');
create type public.lock_in_method as enum ('GCASH_PAYMONGO', 'MANUAL', 'AGREEMENT_ONLY');
create type public.payment_kind   as enum ('DEPOSIT', 'BALANCE', 'REFUND');
create type public.payment_status as enum ('PENDING', 'VERIFIED');
create type public.unit_type      as enum ('Sedan', 'Hatchback', 'MPV', 'SUV', 'Van');
create type public.unit_status    as enum ('ACTIVE', 'MAINTENANCE', 'RETIRED');
create type public.tour_type      as enum ('DAY_6H', 'LONG_TERM');

-- ---------------------------------------------------------------- house rules
-- Mirrors src/lib/config.ts RULES. One row only.

create table public.settings (
  id int primary key default 1 check (id = 1),
  hold_minutes int not null default 30,
  deposit_rate numeric(4, 3) not null default 0.300,
  min_deposit int not null default 1000,
  self_drive_security_deposit int not null default 3000,
  self_drive_min_age int not null default 21,
  min_lead_hours int not null default 2,
  agreement_version text not null default 'v1-draft',
  updated_at timestamptz not null default now()
);
insert into public.settings (id) values (1);

-- ---------------------------------------------------------------- people

-- Nole (and later staff). Add him once after his first log-in:
--   insert into staff (user_id, role) values ('<his auth user id>', 'OWNER');
create table public.staff (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'OWNER' check (role in ('OWNER', 'STAFF')),
  created_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete set null,
  full_name text not null,
  mobile text not null unique check (mobile ~ '^09[0-9]{9}$' or mobile like 'deleted-%'),
  email text,
  license_no text,
  license_photo_path text,          -- storage bucket "licenses" (private)
  license_expiry date,
  is_trusted boolean not null default false,
  is_blocked boolean not null default false,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ---------------------------------------------------------------- fleet and tours

create table public.units (
  id uuid primary key default gen_random_uuid(),
  plate_no text not null unique,
  name text not null,
  type public.unit_type not null,
  seats int not null check (seats between 1 and 30),
  transmission text not null check (transmission in ('AT', 'MT')),
  fuel text not null check (fuel in ('Gas', 'Diesel')),
  daily_rate int not null default 0 check (daily_rate >= 0),           -- self-drive, per 24 hrs
  with_driver_rate int not null check (with_driver_rate >= 0),         -- per day, driver included
  self_drive_allowed boolean not null default true,
  status public.unit_status not null default 'ACTIVE',
  color text not null default '#e2e8f0',
  photo_path text,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  check (not self_drive_allowed or daily_rate > 0)
);

create table public.unit_blocks (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units (id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  reason text not null,
  created_at timestamptz not null default now(),
  check (end_at > start_at)
);
create index on public.unit_blocks (unit_id, start_at);

create table public.tours (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type public.tour_type not null,
  base_price int not null check (base_price > 0),   -- DAY_6H: per tour. LONG_TERM: per day.
  max_pax int not null check (max_pax > 0),
  min_days int,
  start_slots text[] not null default '{}',          -- '06:00' (Manila time)
  itinerary text[] not null default '{}',
  includes text[] not null default '{}',
  is_active boolean not null default true,
  sort int not null default 0
);

-- ---------------------------------------------------------------- bookings

-- A booking keeps its unit busy from pickup until return + 2 hours (cleaning,
-- refuel, checking). Adding hours to a timestamp doesn't depend on time zone,
-- so marking this immutable is safe. To change the buffer, edit the interval
-- here and re-create constraint no_double_booking.
create function public.booking_window(start_at timestamptz, end_at timestamptz)
returns tstzrange language sql immutable parallel safe as $$
  select tstzrange(start_at, end_at + interval '2 hours', '[)')
$$;

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  customer_id uuid not null references public.customers (id),
  unit_id uuid not null references public.units (id),
  tour_id uuid references public.tours (id),
  service_type public.service_type not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  pax int not null check (pax > 0),
  pickup_location text not null,
  total int not null check (total >= 0),
  deposit_due int not null check (deposit_due >= 0),
  security_deposit int not null default 0,
  lock_in public.lock_in_method not null,
  status public.booking_status not null default 'HELD',
  hold_expires_at timestamptz,
  cancel_requested boolean not null default false,
  created_by text not null check (created_by in ('CUSTOMER', 'OWNER')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at),
  check ((service_type in ('DAY_TOUR', 'LONG_TOUR')) = (tour_id is not null)),
  -- THE double-booking rule. Two busy bookings on the same unit can't overlap,
  -- even if two people press "Book" in the same second.
  constraint no_double_booking exclude using gist (
    unit_id with =,
    public.booking_window(start_at, end_at) with &&
  ) where (status in ('HELD', 'PENDING_VERIFICATION', 'CONFIRMED', 'ONGOING'))
);
create index on public.bookings (customer_id);
create index on public.bookings (start_at);
create index on public.bookings (status) where status in ('HELD', 'PENDING_VERIFICATION');

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  kind public.payment_kind not null,
  method public.payment_method not null,
  amount int not null check (amount > 0),
  reference_no text,
  proof_path text,                  -- storage bucket "receipts" (private)
  status public.payment_status not null default 'PENDING',
  created_at timestamptz not null default now(),
  verified_by uuid references auth.users (id) on delete set null,
  verified_at timestamptz
);
create index on public.payments (booking_id);
-- Same GCash / bank reference number can't be used twice. Stops the
-- "send last week's screenshot again" trick.
create unique index payments_reference_once on public.payments (method, regexp_replace(reference_no, '\s', '', 'g'))
  where reference_no is not null and kind <> 'REFUND';

create table public.agreements (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings (id) on delete cascade,
  version text not null,
  signed_name text not null,
  signed_at timestamptz not null default now(),
  signed_by uuid references auth.users (id) on delete set null,
  pdf_path text
);

create table public.booking_events (
  id bigint generated always as identity primary key,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  from_status public.booking_status,
  to_status text not null,          -- a status, or 'NOTE'
  by_role text not null check (by_role in ('CUSTOMER', 'OWNER', 'SYSTEM')),
  by_user uuid,
  note text,
  at timestamptz not null default now()
);
create index on public.booking_events (booking_id);

create table public.sms_log (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings (id) on delete set null,
  to_mobile text not null,
  template text not null,
  body text not null,
  provider_status text,
  sent_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- helpers

create function public.is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff where user_id = auth.uid())
$$;

create function public.owns_booking(p_booking_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.bookings b join public.customers c on c.id = b.customer_id
    where b.id = p_booking_id and c.user_id = auth.uid()
  )
$$;

/** '+63 917 123 4567', '639171234567', '9171234567' → '09171234567', else null. */
create function public.normalize_mobile(raw text) returns text
language sql immutable as $$
  select case
    when d ~ '^639[0-9]{9}$' then '0' || substr(d, 3)
    when d ~ '^09[0-9]{9}$' then d
    when d ~ '^9[0-9]{9}$' then '0' || d
  end
  from (select regexp_replace(coalesce(raw, ''), '[^0-9]', '', 'g') as d) x
$$;

create function public.new_booking_code() returns text
language plpgsql volatile set search_path = '' as $$
declare
  chars constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';  -- no 0/O, 1/I/L mix-ups over the phone
  c text;
begin
  loop
    c := '247-';
    for i in 1..4 loop
      c := c || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    end loop;
    exit when not exists (select 1 from public.bookings where code = c);
  end loop;
  return c;
end $$;

-- Same maths as quote() in src/lib/logic.ts. Keep the two in step.
create function public.quote_price(
  p_service public.service_type, p_unit_id uuid, p_tour_id uuid, p_start timestamptz, p_end timestamptz,
  out total int, out deposit int, out security int
) language plpgsql stable set search_path = '' as $$
declare
  s public.settings;
  u public.units;
  t public.tours;
  days int := greatest(1, ceil(extract(epoch from (p_end - p_start)) / 86400.0)::int);
begin
  select * into s from public.settings where id = 1;
  select * into u from public.units where id = p_unit_id;
  select * into t from public.tours where id = p_tour_id;
  total := case p_service
    when 'SELF_DRIVE' then u.daily_rate * days
    when 'WITH_DRIVER' then u.with_driver_rate * days
    when 'DAY_TOUR' then t.base_price
    when 'LONG_TOUR' then t.base_price * days
  end;
  total := coalesce(total, 0);
  deposit := case when total = 0 then 0
    else least(total, greatest(s.min_deposit, (round(total * s.deposit_rate / 100) * 100)::int)) end;
  security := case when p_service = 'SELF_DRIVE' then s.self_drive_security_deposit else 0 end;
end $$;

-- Same tiers as CANCELLATION_TIERS in src/lib/config.ts.
create function public.cancellation_refund(p_booking_id uuid, out pct int, out amount int, out hours_before int)
language plpgsql stable security definer set search_path = '' as $$
declare
  b public.bookings;
  paid int;
  h numeric;
begin
  select * into b from public.bookings where id = p_booking_id;
  if b.id is null or not (public.is_owner() or public.owns_booking(p_booking_id)) then
    raise exception 'Booking not found';
  end if;
  h := extract(epoch from (b.start_at - now())) / 3600;
  pct := case when h >= 72 then 100 when h >= 24 then 50 else 0 end;
  select coalesce(sum(p.amount), 0) into paid from public.payments p
    where p.booking_id = b.id and p.kind = 'DEPOSIT' and p.status = 'VERIFIED';
  amount := round(paid * pct / 100.0);
  hours_before := floor(h);
end $$;

-- ---------------------------------------------------------------- audit trail

create function public.log_booking_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into public.booking_events (booking_id, from_status, to_status, by_role, by_user, note)
    values (new.id, old.status, new.status::text,
      case when public.is_owner() then 'OWNER' when auth.uid() is null then 'SYSTEM' else 'CUSTOMER' end,
      auth.uid(), current_setting('app.status_note', true));
  end if;
  return new;
end $$;

create trigger bookings_log_change before update on public.bookings
  for each row execute function public.log_booking_change();

-- ---------------------------------------------------------------- customer actions

/**
 * Saves a booking as HELD for settings.hold_minutes (or CONFIRMED straight away
 * for agreement-only). Customers must be signed in with their phone; the mobile
 * number comes from their verified log-in, not from what they typed.
 * The owner can encode walk-in / Messenger bookings for any number.
 */
create function public.create_hold(
  p_service public.service_type,
  p_unit_id uuid,
  p_tour_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_pax int,
  p_pickup text,
  p_lock_in public.lock_in_method,
  p_full_name text,
  p_signed_name text,
  p_email text default null,
  p_license_no text default null,
  p_mobile text default null          -- owner only; customers use their log-in number
) returns public.bookings
language plpgsql security definer set search_path = '' as $$
declare
  s public.settings;
  u public.units;
  t public.tours;
  c public.customers;
  b public.bookings;
  q record;
  owner boolean := public.is_owner();
  v_mobile text;
begin
  select * into s from public.settings where id = 1;

  if owner then
    v_mobile := public.normalize_mobile(p_mobile);
  elsif auth.uid() is null then
    raise exception 'Please sign in with your mobile number first.';
  else
    v_mobile := public.normalize_mobile(auth.jwt() ->> 'phone');
  end if;
  if v_mobile is null then raise exception 'Enter a valid PH mobile number (09XX XXX XXXX).'; end if;

  if length(trim(coalesce(p_full_name, ''))) < 3 then raise exception 'Enter your full name.'; end if;
  if lower(trim(coalesce(p_signed_name, ''))) <> lower(trim(p_full_name)) then
    raise exception 'Type your full name exactly to sign the agreement.';
  end if;
  if length(trim(coalesce(p_pickup, ''))) = 0 then raise exception 'Where should we meet you?'; end if;
  if p_end <= p_start then raise exception 'Return must be after pickup.'; end if;
  if not owner and p_start < now() + make_interval(hours => s.min_lead_hours) then
    raise exception 'Pickup must be at least % hours from now.', s.min_lead_hours;
  end if;
  if p_service = 'SELF_DRIVE' and length(trim(coalesce(p_license_no, ''))) = 0 then
    raise exception 'Enter your driver''s license number.';
  end if;

  -- Lock the unit so two bookings for it are handled one after the other.
  select * into u from public.units where id = p_unit_id for update;
  if u.id is null then raise exception 'Unit not found.'; end if;
  if u.status <> 'ACTIVE' then raise exception 'That unit is not available right now.'; end if;
  if p_service = 'SELF_DRIVE' and not u.self_drive_allowed then raise exception 'That unit is with driver only.'; end if;
  if p_pax > u.seats then raise exception 'That unit seats only %.', u.seats; end if;

  if p_service in ('DAY_TOUR', 'LONG_TOUR') then
    select * into t from public.tours where id = p_tour_id and is_active;
    if t.id is null or t.type <> (case when p_service = 'DAY_TOUR' then 'DAY_6H' else 'LONG_TERM' end)::public.tour_type then
      raise exception 'Pick a tour package.';
    end if;
    if p_pax > t.max_pax then raise exception 'This tour takes up to % people.', t.max_pax; end if;
    if p_service = 'DAY_TOUR' and p_end - p_start <> interval '6 hours' then raise exception 'Day tours run for 6 hours.'; end if;
    if p_service = 'LONG_TOUR' and t.min_days is not null and p_end - p_start < make_interval(days => t.min_days) then
      raise exception 'Minimum % days.', t.min_days;
    end if;
  elsif p_tour_id is not null then
    raise exception 'Tour package only applies to tours.';
  end if;

  if exists (select 1 from public.unit_blocks k where k.unit_id = u.id and tstzrange(k.start_at, k.end_at) && tstzrange(p_start, p_end)) then
    raise exception 'Sorry, that unit was just taken for those dates. Please pick another unit or time.';
  end if;

  -- Holds that ran out stop blocking the unit right away, not at the next sweep.
  update public.bookings set status = 'EXPIRED'
    where unit_id = u.id and status = 'HELD' and hold_expires_at < now();

  select * into c from public.customers where mobile = v_mobile;
  if c.is_blocked then raise exception 'We can''t take this booking online. Please message us on Messenger.'; end if;
  if c.id is null then
    insert into public.customers (user_id, full_name, mobile, email, license_no)
    values (case when owner then null else auth.uid() end, trim(p_full_name), v_mobile, nullif(trim(p_email), ''), nullif(trim(p_license_no), ''))
    returning * into c;
  else
    update public.customers set
      full_name = trim(p_full_name),
      email = coalesce(nullif(trim(p_email), ''), email),
      license_no = coalesce(nullif(trim(p_license_no), ''), license_no),
      user_id = coalesce(user_id, case when owner then null else auth.uid() end)
    where id = c.id returning * into c;
  end if;

  if p_lock_in = 'AGREEMENT_ONLY' and not c.is_trusted and not owner then
    raise exception 'Agreement-only booking is for returning customers. Please pay the deposit.';
  end if;

  q := public.quote_price(p_service, u.id, t.id, p_start, p_end);

  begin
    insert into public.bookings (code, customer_id, unit_id, tour_id, service_type, start_at, end_at, pax, pickup_location,
      total, deposit_due, security_deposit, lock_in, status, hold_expires_at, created_by)
    values (public.new_booking_code(), c.id, u.id, t.id, p_service, p_start, p_end, p_pax, trim(p_pickup),
      q.total, q.deposit, q.security, p_lock_in, 'HELD', now() + make_interval(mins => s.hold_minutes),
      case when owner then 'OWNER' else 'CUSTOMER' end)
    returning * into b;
  exception when exclusion_violation then
    raise exception 'Sorry, that unit was just taken for those dates. Please pick another unit or time.';
  end;

  insert into public.booking_events (booking_id, to_status, by_role, by_user)
    values (b.id, 'HELD', case when owner then 'OWNER' else 'CUSTOMER' end, auth.uid());
  insert into public.agreements (booking_id, version, signed_name, signed_by)
    values (b.id, s.agreement_version, trim(p_signed_name), auth.uid());

  if p_lock_in = 'AGREEMENT_ONLY' then
    perform set_config('app.status_note', 'Agreement only (trusted customer)', true);
    update public.bookings set status = 'CONFIRMED', hold_expires_at = null where id = b.id returning * into b;
  end if;
  return b;
end $$;

create function public.submit_manual_proof(
  p_booking_id uuid, p_method public.payment_method, p_reference_no text, p_proof_path text default null
) returns public.bookings
language plpgsql security definer set search_path = '' as $$
declare
  b public.bookings;
begin
  if p_method not in ('GCASH_MANUAL', 'BANK') then raise exception 'Use GCash send-money or bank transfer.'; end if;
  if length(regexp_replace(coalesce(p_reference_no, ''), '\s', '', 'g')) < 6 then raise exception 'Enter the full reference number.'; end if;
  select * into b from public.bookings where id = p_booking_id for update;
  if b.id is null or not (public.owns_booking(b.id) or public.is_owner()) then raise exception 'Booking not found.'; end if;
  if b.status <> 'HELD' or b.hold_expires_at < now() then raise exception 'This hold has already ended. Please book again.'; end if;
  begin
    insert into public.payments (booking_id, kind, method, amount, reference_no, proof_path)
    values (b.id, 'DEPOSIT', p_method, b.deposit_due, trim(p_reference_no), p_proof_path);
  exception when unique_violation then
    raise exception 'That reference number was already used. Please check it and try again.';
  end;
  perform set_config('app.status_note', 'Ref ' || trim(p_reference_no), true);
  update public.bookings set status = 'PENDING_VERIFICATION', hold_expires_at = null where id = b.id returning * into b;
  return b;
end $$;

create function public.request_cancel(p_booking_id uuid) returns public.bookings
language plpgsql security definer set search_path = '' as $$
declare
  b public.bookings;
begin
  select * into b from public.bookings where id = p_booking_id for update;
  if b.id is null or not public.owns_booking(b.id) then raise exception 'Booking not found.'; end if;
  if b.status not in ('HELD', 'PENDING_VERIFICATION', 'CONFIRMED') then raise exception 'This booking can''t be cancelled online.'; end if;
  update public.bookings set cancel_requested = true where id = b.id returning * into b;
  insert into public.booking_events (booking_id, to_status, by_role, by_user, note)
    values (b.id, 'NOTE', 'CUSTOMER', auth.uid(), 'Cancellation requested');
  return b;
end $$;

/**
 * In-app account deletion (App Store 5.1.1(v), Google Play). Wipes the
 * customer's personal details and log-in. Booking amounts and dates stay for
 * BIR records. Delete their license photo from storage in the app before calling.
 */
create function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare
  c public.customers;
begin
  if auth.uid() is null then raise exception 'Not signed in.'; end if;
  select * into c from public.customers where user_id = auth.uid();
  if c.id is not null then
    perform set_config('app.status_note', 'Account deleted by customer', true);
    update public.bookings set status = 'CANCELLED'
      where customer_id = c.id and status in ('HELD', 'PENDING_VERIFICATION', 'CONFIRMED');
    update public.customers set
      full_name = 'Deleted customer', mobile = 'deleted-' || c.id, email = null, license_no = null,
      license_photo_path = null, license_expiry = null, user_id = null, deleted_at = now()
    where id = c.id;
    update public.sms_log set to_mobile = 'deleted', body = '(removed)' where to_mobile = c.mobile;
  end if;
  delete from auth.users where id = auth.uid();
end $$;

-- ---------------------------------------------------------------- owner actions

create function public.verify_payment(p_payment_id uuid) returns public.bookings
language plpgsql security definer set search_path = '' as $$
declare
  p public.payments;
  b public.bookings;
begin
  if not public.is_owner() then raise exception 'Owner only.'; end if;
  update public.payments set status = 'VERIFIED', verified_by = auth.uid(), verified_at = now()
    where id = p_payment_id and status = 'PENDING' returning * into p;
  if p.id is null then raise exception 'Payment not found or already verified.'; end if;
  select * into b from public.bookings where id = p.booking_id;
  if p.kind = 'DEPOSIT' and b.status = 'PENDING_VERIFICATION' then
    perform set_config('app.status_note', 'Verified ref ' || coalesce(p.reference_no, ''), true);
    update public.bookings set status = 'CONFIRMED' where id = b.id returning * into b;
  end if;
  return b;
end $$;

-- ---------------------------------------------------------------- public availability

/** Busy windows for the booking screen. No names, numbers or reasons, just times. */
create function public.get_busy_windows(p_from timestamptz, p_to timestamptz)
returns table (unit_id uuid, start_at timestamptz, end_at timestamptz, kind text)
language sql stable security definer set search_path = '' as $$
  select b.unit_id, b.start_at, b.end_at, 'BOOKING'
    from public.bookings b
   where (b.status in ('PENDING_VERIFICATION', 'CONFIRMED', 'ONGOING')
          or (b.status = 'HELD' and b.hold_expires_at > now()))
     and b.end_at > p_from and b.start_at < p_to
  union all
  select k.unit_id, k.start_at, k.end_at, 'BLOCK'
    from public.unit_blocks k
   where k.end_at > p_from and k.start_at < p_to
$$;

-- ---------------------------------------------------------------- hold sweeper (PLAN.md job 3)

create function public.expire_holds() returns int
language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  perform set_config('app.status_note', 'Hold ran out', true);
  update public.bookings set status = 'EXPIRED' where status = 'HELD' and hold_expires_at < now();
  get diagnostics n = row_count;
  return n;
end $$;

-- Runs every minute on Supabase (pg_cron). Skipped quietly where pg_cron isn't available.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('expire-holds', '* * * * *', 'select public.expire_holds()');
exception when others then
  raise notice 'pg_cron not available, schedule expire_holds() another way: %', sqlerrm;
end $$;

-- ---------------------------------------------------------------- who can call what

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.get_busy_windows(timestamptz, timestamptz) to anon, authenticated;
grant execute on function public.quote_price(public.service_type, uuid, uuid, timestamptz, timestamptz) to anon, authenticated;
grant execute on function public.normalize_mobile(text) to anon, authenticated;
grant execute on function public.booking_window(timestamptz, timestamptz) to anon, authenticated;
-- The row rules call these two for every visitor; they simply return false for strangers.
grant execute on function public.is_owner() to anon, authenticated;
grant execute on function public.owns_booking(uuid) to anon, authenticated;
grant execute on function public.create_hold(public.service_type, uuid, uuid, timestamptz, timestamptz, int, text, public.lock_in_method, text, text, text, text, text) to authenticated;
grant execute on function public.submit_manual_proof(uuid, public.payment_method, text, text) to authenticated;
grant execute on function public.request_cancel(uuid) to authenticated;
grant execute on function public.cancellation_refund(uuid) to authenticated;
grant execute on function public.delete_my_account() to authenticated;
grant execute on function public.verify_payment(uuid) to authenticated;

-- ---------------------------------------------------------------- row level security

alter table public.settings enable row level security;
alter table public.staff enable row level security;
alter table public.customers enable row level security;
alter table public.units enable row level security;
alter table public.unit_blocks enable row level security;
alter table public.tours enable row level security;
alter table public.bookings enable row level security;
alter table public.payments enable row level security;
alter table public.agreements enable row level security;
alter table public.booking_events enable row level security;
alter table public.sms_log enable row level security;

-- Catalogue: anyone can read. Only the owner edits.
create policy "read settings" on public.settings for select using (true);
create policy "owner edits settings" on public.settings for update using (public.is_owner());
create policy "read units" on public.units for select using (status <> 'RETIRED' or public.is_owner());
create policy "owner manages units" on public.units for all using (public.is_owner()) with check (public.is_owner());
create policy "read tours" on public.tours for select using (is_active or public.is_owner());
create policy "owner manages tours" on public.tours for all using (public.is_owner()) with check (public.is_owner());

-- Owner-only tables (reasons for blocks, the SMS log, the audit trail).
create policy "owner manages blocks" on public.unit_blocks for all using (public.is_owner()) with check (public.is_owner());
create policy "owner reads sms" on public.sms_log for all using (public.is_owner()) with check (public.is_owner());
create policy "owner reads events" on public.booking_events for select using (public.is_owner());
create policy "see own staff row" on public.staff for select using (user_id = auth.uid());

-- Customers see only their own things. All their changes go through the functions above.
create policy "own customer row" on public.customers for select using (user_id = auth.uid() or public.is_owner());
create policy "owner manages customers" on public.customers for update using (public.is_owner()) with check (public.is_owner());
create policy "own bookings" on public.bookings for select using (public.owns_booking(id) or public.is_owner());
create policy "owner manages bookings" on public.bookings for update using (public.is_owner()) with check (public.is_owner());
create policy "own payments" on public.payments for select using (public.owns_booking(booking_id) or public.is_owner());
create policy "owner manages payments" on public.payments for all using (public.is_owner()) with check (public.is_owner());
create policy "own agreements" on public.agreements for select using (public.owns_booking(booking_id) or public.is_owner());

-- ---------------------------------------------------------------- photo storage
-- License photos are sensitive personal information under the Data Privacy Act.
-- Private buckets; each customer uploads into a folder named after their user id.

insert into storage.buckets (id, name, public) values ('licenses', 'licenses', false), ('receipts', 'receipts', false)
  on conflict (id) do nothing;

create policy "upload own photos" on storage.objects for insert to authenticated
  with check (bucket_id in ('licenses', 'receipts') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "see own photos" on storage.objects for select to authenticated
  using (bucket_id in ('licenses', 'receipts') and ((storage.foldername(name))[1] = auth.uid()::text or public.is_owner()));
create policy "delete own photos" on storage.objects for delete to authenticated
  using (bucket_id in ('licenses', 'receipts') and ((storage.foldername(name))[1] = auth.uid()::text or public.is_owner()));
