-- price_alerts: email price-alert signups (see components/PriceAlertSignup.tsx
-- -> app/api/alerts/route.ts -> /alerts/confirm | /alerts/unsubscribe).
--
-- The table was originally created directly in the Supabase SQL editor; this
-- CREATE TABLE IF NOT EXISTS mirrors the production schema exactly so the
-- repo can reproduce the database from scratch. On production it is a no-op.
-- triggered_at is the fired marker for the alert trigger: null = armed
-- (once confirmed), set when the alert email is sent so it never fires twice.
--
-- Ordering note: 0003_price_alerts_rls.sql assumes this table exists, but is
-- numbered earlier because production got the table before the repo did. On a
-- fresh database run this file before 0003 (or rely on the RLS statements
-- repeated idempotently below, which make 0003 a no-op).

create table if not exists price_alerts (
  id           bigserial primary key,
  email        text not null,
  target_price numeric not null,
  direction    text not null check (direction in ('above', 'below')),
  confirmed    boolean not null default false,
  token        uuid not null default gen_random_uuid() unique,
  triggered_at timestamptz,
  created_at   timestamptz not null default now()
);

-- The trigger will scan for armed, confirmed alerts on every price update.
create index if not exists idx_price_alerts_armed
  on price_alerts (confirmed)
  where triggered_at is null;

-- Same lockdown as 0003_price_alerts_rls.sql (idempotent repeat so a fresh
-- database is safe regardless of the order the two files run in): the table
-- holds email PII, no anon/authenticated access at all, service_role only.
alter table price_alerts enable row level security;

revoke all on price_alerts from anon, authenticated;
