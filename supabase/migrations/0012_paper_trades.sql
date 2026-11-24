-- paper_trades: the trade history of the pretend ("paper") trading account on
-- the private page /pro/paper (app/pro/paper, lib/pro/paper-store.ts).
--
-- One row per pretend buy or sell. The account itself is not stored: cash,
-- gold held and profit are worked out from these rows, starting from 100,000
-- baht (lib/pro/paper.ts). No real money or real orders are involved.
--
-- Private: RLS is on with NO policies and every grant to the browser-facing
-- roles is removed, so the anon and authenticated keys can neither read nor
-- write it. Only the service_role key, used by server-side code, gets
-- through. Safe to re-run.

create table if not exists paper_trades (
  id          bigserial primary key,
  -- 1, 2, 3, ... in the order the trades were made. Unique on purpose: the
  -- server writes "last seq + 1", so two requests racing each other (a double
  -- click) cannot both be stored and spend the same cash twice.
  seq         integer not null unique check (seq > 0),
  side        text not null check (side in ('buy', 'sell')),
  -- Gold bought or sold, in baht-weight (fractions allowed).
  baht_weight numeric(14, 6) not null check (baht_weight > 0),
  -- Price per baht-weight of 96.5% gold bar: the dealer's SELL price for a
  -- buy, the dealer's BUY price for a sell.
  price       numeric(12, 2) not null check (price > 0),
  -- Cash paid (buy) or received (sell), in baht.
  amount      numeric(14, 2) not null check (amount > 0),
  -- Official announcement time of the price that was used.
  price_time  timestamptz not null,
  created_at  timestamptz not null default now()
);

alter table paper_trades enable row level security;

revoke all on paper_trades from anon, authenticated;
revoke all on sequence paper_trades_id_seq from anon, authenticated;

-- Make sure the server-side role can use it even if this project's default
-- grants for new tables ever change.
grant all on paper_trades to service_role;
grant usage, select on sequence paper_trades_id_seq to service_role;
