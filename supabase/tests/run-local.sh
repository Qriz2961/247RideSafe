#!/usr/bin/env bash
# LOCAL TESTING ONLY: builds a scratch database on a local Postgres (16+),
# runs the real migration and seed, then the rule tests and a 10-way race.
# Usage: PGHOST=/tmp PGPORT=54329 PGUSER=postgres supabase/tests/run-local.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB=rentals247_test
P="psql -v ON_ERROR_STOP=1 -q"
$P -d postgres -c "drop database if exists $DB" -c "create database $DB"
$P -d $DB -f tests/00_local_stub.sql
$P -d $DB -f migrations/20261028000000_init.sql 2>&1 | grep -v "pg_cron not available" || true
$P -d $DB -f seed.sql
$P -d $DB -f tests/10_booking_rules.sql

echo "15. Ten customers press Book on the same van at the same second: exactly one wins."
for i in $(seq 0 9); do
  $P -d $DB -c "insert into auth.users (id, phone) values ('00000000-0000-0000-0000-1000000000$(printf %02d $i)', '6392000000$(printf %02d $i)')"
done
for i in $(seq 0 9); do
  ( $P -d $DB -tA -c "
      select set_config('request.jwt.claims', '{\"sub\":\"00000000-0000-0000-0000-1000000000$(printf %02d $i)\",\"phone\":\"6392000000$(printf %02d $i)\"}', false);
      set role authenticated;
      select code from create_hold('WITH_DRIVER', (select id from units where plate_no = 'NJK 9090'), null,
        now() + interval '20 days', now() + interval '21 days', 5, 'Downtown', 'MANUAL', 'Racer $i', 'Racer $i');" >/dev/null 2>&1 && echo WIN || echo LOSE ) &
done | sort | uniq -c | tee /dev/stderr | grep -q "1 WIN"
echo "ALL TESTS PASSED"
