-- Thai Gold Tracker: core price table + daily rollup view.
-- Prices are quoted in THB per baht-weight (บาทละ), as published by
-- the Thai Gold Traders Association (สมาคมค้าทองคำ, goldtraders.or.th).

create table if not exists gold_prices (
  id            bigint generated always as identity primary key,
  fetched_at    timestamptz not null default now(),
  bar_buy       numeric(10,2) not null,   -- ทองคำแท่ง รับซื้อ
  bar_sell      numeric(10,2) not null,   -- ทองคำแท่ง ขายออก
  ornament_buy  numeric(10,2) not null,   -- ทองรูปพรรณ รับซื้อ (ฐานภาษี)
  ornament_sell numeric(10,2) not null,   -- ทองรูปพรรณ ขายออก
  source        text not null default 'goldtraders'
);

create index if not exists idx_gold_prices_fetched_at
  on gold_prices (fetched_at desc);

alter table gold_prices enable row level security;

-- Public (anon) and logged-in users may only read. Only the service_role
-- key (used server-side by the cron fetcher) bypasses RLS to insert —
-- no insert/update/delete policy is defined for anon/authenticated,
-- so those roles are denied those operations by default.
create policy "Public read access"
  on gold_prices
  for select
  to anon, authenticated
  using (true);

grant select on gold_prices to anon, authenticated;

-- One row per Asia/Bangkok calendar day: the last (most recent) price
-- published that day. Powers the history page's daily table/chart.
create or replace view daily_gold_prices
  with (security_invoker = true)
as
select distinct on ((fetched_at at time zone 'Asia/Bangkok')::date)
  (fetched_at at time zone 'Asia/Bangkok')::date as price_date,
  fetched_at,
  bar_buy,
  bar_sell,
  ornament_buy,
  ornament_sell,
  source
from gold_prices
order by (fetched_at at time zone 'Asia/Bangkok')::date desc, fetched_at desc;

grant select on daily_gold_prices to anon, authenticated;
