-- LOCAL TESTING ONLY. Tries to break the booking rules; every block must pass.
-- Run: supabase/tests/run-local.sh

\set ON_ERROR_STOP 1
set client_min_messages = warning;

-- Three log-ins: two customers and Nole.
insert into auth.users (id, phone) values
  ('00000000-0000-0000-0000-00000000000a', '639171234567'),  -- Ana
  ('00000000-0000-0000-0000-00000000000b', '639181234567'),  -- Ben
  ('00000000-0000-0000-0000-0000000000ff', '639278087892');  -- Nole
insert into staff (user_id) values ('00000000-0000-0000-0000-0000000000ff');

create function pg_temp.login(who text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', case who
    when 'ana'  then '{"sub":"00000000-0000-0000-0000-00000000000a","phone":"639171234567"}'
    when 'ben'  then '{"sub":"00000000-0000-0000-0000-00000000000b","phone":"639181234567"}'
    when 'nole' then '{"sub":"00000000-0000-0000-0000-0000000000ff","phone":"639278087892"}'
    else '' end, false);
  perform set_config('role', case when who = 'anon' then 'anon' else 'authenticated' end, false);
end $$;
grant execute on function pg_temp.login(text) to anon, authenticated;

create function pg_temp.at(day_offset int, hour int) returns timestamptz language sql as $$
  select (date_trunc('day', now() at time zone 'Asia/Manila') + make_interval(days => day_offset, hours => hour)) at time zone 'Asia/Manila'
$$;
grant execute on function pg_temp.at(int, int) to anon, authenticated;

create function pg_temp.unit(p text) returns uuid language sql as $$ select id from units where plate_no = p $$;
grant execute on function pg_temp.unit(text) to anon, authenticated;

\echo '1. Ana books the Vios (self-drive, 1 day). Price is worked out by the database.'
select pg_temp.login('ana');
do $$ declare b bookings; begin
  b := create_hold('SELF_DRIVE', pg_temp.unit('NBC 1234'), null, pg_temp.at(2, 8), pg_temp.at(3, 8), 2, 'Tacloban airport', 'MANUAL',
                   'Ana Dela Cruz', 'ana dela cruz', null, 'N01-23-456789');
  assert b.status = 'HELD', 'should be held';
  assert b.total = 1800 and b.deposit_due = 1000 and b.security_deposit = 3000, format('price wrong: %s/%s/%s', b.total, b.deposit_due, b.security_deposit);
  assert b.code ~ '^247-[A-Z2-9]{4}$', 'code format';
end $$;

\echo '2. Ben tries the same Vios at an overlapping time: refused.'
select pg_temp.login('ben');
do $$ begin
  perform create_hold('WITH_DRIVER', pg_temp.unit('NBC 1234'), null, pg_temp.at(2, 20), pg_temp.at(3, 20), 2, 'Robinsons', 'MANUAL', 'Ben Cruz', 'Ben Cruz');
  assert false, 'double booking was allowed';
exception when raise_exception then
  assert sqlerrm like '%just taken%', sqlerrm;
end $$;

\echo '3. Ben books 1 hour after Ana returns (inside the 2-hour buffer): refused. 3 hours after: OK.'
do $$ begin
  perform create_hold('WITH_DRIVER', pg_temp.unit('NBC 1234'), null, pg_temp.at(3, 9), pg_temp.at(3, 18), 2, 'Robinsons', 'MANUAL', 'Ben Cruz', 'Ben Cruz');
  assert false, 'buffer ignored';
exception when raise_exception then
  assert sqlerrm like '%just taken%', sqlerrm;
end $$;
do $$ declare b bookings; begin
  b := create_hold('WITH_DRIVER', pg_temp.unit('NBC 1234'), null, pg_temp.at(3, 11), pg_temp.at(3, 18), 2, 'Robinsons', 'MANUAL', 'Ben Cruz', 'Ben Cruz');
  assert b.total = 2800 and b.deposit_due = 1000, format('with-driver price wrong: %s/%s', b.total, b.deposit_due);
end $$;

\echo '4. Each customer sees only their own bookings.'
do $$ begin
  assert (select count(*) from bookings) = 1, 'Ben sees other people''s bookings';
  assert (select count(*) from customers) = 1, 'Ben sees other customers';
end $$;

\echo '5. Ben cannot change his total directly.'
do $$ declare n int; begin
  update bookings set total = 1 where true;
  get diagnostics n = row_count;
  assert n = 0, 'customer edited a booking';
end $$;

\echo '6. Agreement-only is refused for a new customer.'
do $$ begin
  perform create_hold('SELF_DRIVE', pg_temp.unit('NDA 5678'), null, pg_temp.at(5, 8), pg_temp.at(6, 8), 2, 'x', 'AGREEMENT_ONLY', 'Ben Cruz', 'Ben Cruz', null, 'N99');
  assert false, 'agreement-only allowed';
exception when raise_exception then
  assert sqlerrm like '%returning customers%', sqlerrm;
end $$;

\echo '7. Someone not signed in can see busy times but not bookings, and cannot book.'
select pg_temp.login('anon');
do $$ begin
  assert (select count(*) from get_busy_windows(now(), now() + interval '30 days')) >= 2, 'busy windows missing';
  assert (select count(*) from bookings) = 0, 'anon sees bookings';
  assert (select count(*) from units) = 6, 'anon should see the fleet';
end $$;
do $$ begin
  perform create_hold('SELF_DRIVE', pg_temp.unit('NDA 5678'), null, pg_temp.at(5, 8), pg_temp.at(6, 8), 2, 'x', 'MANUAL', 'Hacker', 'Hacker', null, 'N1');
  assert false, 'anon could book';
exception when insufficient_privilege then null;
end $$;

\echo '8. Ana sends her GCash ref. Ben reuses the same ref on his booking: refused.'
select pg_temp.login('ana');
do $$ declare b bookings; begin
  select * into b from bookings limit 1;
  b := submit_manual_proof(b.id, 'GCASH_MANUAL', '5012 334 889201', '00000000-0000-0000-0000-00000000000a/receipt.jpg');
  assert b.status = 'PENDING_VERIFICATION', 'should wait for Nole';
end $$;
select pg_temp.login('ben');
do $$ declare b bookings; begin
  select * into b from bookings limit 1;
  perform submit_manual_proof(b.id, 'GCASH_MANUAL', '5012334889201');
  assert false, 'reused reference number accepted';
exception when raise_exception then
  assert sqlerrm like '%already used%', sqlerrm;
end $$;

\echo '9. Nole verifies Ana''s payment: booking confirmed and logged.'
select pg_temp.login('nole');
do $$ declare b bookings; p uuid; begin
  assert (select count(*) from bookings) = 2, 'owner should see all bookings';
  select id into p from payments where status = 'PENDING';
  b := verify_payment(p);
  assert b.status = 'CONFIRMED', 'not confirmed';
  assert (select count(*) from booking_events where booking_id = b.id and to_status = 'CONFIRMED' and by_role = 'OWNER') = 1, 'no audit row';
end $$;

\echo '10. Ben''s hold runs out: the unit frees up for Ana straight away.'
reset role;
update bookings set hold_expires_at = now() - interval '1 minute' where status = 'HELD';
select pg_temp.login('ana');
do $$ declare b bookings; begin
  b := create_hold('WITH_DRIVER', pg_temp.unit('NBC 1234'), null, pg_temp.at(3, 12), pg_temp.at(3, 17), 2, 'Airport', 'MANUAL', 'Ana Dela Cruz', 'Ana Dela Cruz');
  assert b.status = 'HELD', 'expired hold still blocking';
end $$;

\echo '11. Fortuner is at the casa for PMS: customers cannot book it.'
select pg_temp.login('nole');
insert into unit_blocks (unit_id, start_at, end_at, reason) values (pg_temp.unit('NGH 1357'), pg_temp.at(4, 8), pg_temp.at(4, 17), 'PMS at casa');
select pg_temp.login('ana');
do $$ begin
  perform create_hold('SELF_DRIVE', pg_temp.unit('NGH 1357'), null, pg_temp.at(4, 6), pg_temp.at(4, 10), 2, 'x', 'MANUAL', 'Ana Dela Cruz', 'Ana Dela Cruz', null, 'N01');
  assert false, 'booked over a block';
exception when raise_exception then
  assert sqlerrm like '%just taken%', sqlerrm;
end $$;
do $$ begin
  assert (select count(*) from unit_blocks) = 0, 'customer can read block reasons';
end $$;

\echo '12. Tour pricing matches the app (day tour 4,500 → deposit 1,400; 3-day loop 18,000 → 5,400).'
do $$ declare b bookings; t uuid; begin
  select id into t from tours where type = 'DAY_6H' order by sort limit 1;
  b := create_hold('DAY_TOUR', pg_temp.unit('NJK 9090'), t, pg_temp.at(6, 8), pg_temp.at(6, 14), 10, 'Hotel', 'MANUAL', 'Ana Dela Cruz', 'Ana Dela Cruz');
  assert b.total = 4500 and b.deposit_due = 1400, format('day tour %s/%s', b.total, b.deposit_due);
  select id into t from tours where type = 'LONG_TERM';
  b := create_hold('LONG_TOUR', pg_temp.unit('NLM 4321'), t, pg_temp.at(8, 6), pg_temp.at(11, 6), 14, 'Office', 'MANUAL', 'Ana Dela Cruz', 'Ana Dela Cruz');
  assert b.total = 18000 and b.deposit_due = 5400, format('long tour %s/%s', b.total, b.deposit_due);
end $$;

\echo '13. Ana asks to cancel; refund follows the 72h / 24h tiers.'
do $$ declare b bookings; r record; begin
  select * into b from bookings where status = 'CONFIRMED';
  b := request_cancel(b.id);
  assert b.cancel_requested, 'not flagged';
  r := cancellation_refund(b.id);
  assert r.pct = 50 and r.amount = 500, format('refund %s%% %s', r.pct, r.amount);
end $$;

\echo '14. Ben deletes his account: personal details gone, log-in removed.'
select pg_temp.login('ben');
select delete_my_account();
reset role;
do $$ begin
  assert not exists (select 1 from customers where mobile = '09181234567'), 'mobile still stored';
  assert not exists (select 1 from auth.users where id = '00000000-0000-0000-0000-00000000000b'), 'log-in still exists';
  assert exists (select 1 from customers where full_name = 'Deleted customer'), 'row should stay for records';
end $$;

\echo 'ALL BOOKING RULE TESTS PASSED'
