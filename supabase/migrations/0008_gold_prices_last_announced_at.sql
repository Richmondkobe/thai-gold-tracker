-- gold_prices.last_announced_at: the time of the most recent official GTA
-- announcement (their asTime) that repeated this row's prices unchanged.
--
-- Why: GTA sometimes publishes a new announcement whose four prices are
-- identical to the previous one. We deliberately do NOT insert a row for it
-- (a duplicate-price row would show up as a zero-change line in the intraday
-- table, make "เทียบกับประกาศก่อนหน้า" read 0, and look like a new price to
-- the alert trigger). But that left the site showing an older "อัปเดตล่าสุด"
-- time than the official one.
--
-- So instead the fetcher stamps the newer asTime onto the existing latest row:
--   fetched_at        = when this price first took effect (unchanged meaning:
--                       natural key, drives the intraday table, charts, daily
--                       closes and every change calculation)
--   last_announced_at = latest official announcement that confirmed it,
--                       null if it has never been re-announced
-- The displayed update time is coalesce(last_announced_at, fetched_at).
--
-- No view or policy changes needed: daily_gold_prices and
-- yearly_gold_price_stats list their columns explicitly, and the existing
-- table-level SELECT grant/policy already covers a new column. Safe to re-run.

alter table gold_prices
  add column if not exists last_announced_at timestamptz;
