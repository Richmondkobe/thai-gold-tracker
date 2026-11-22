-- gold_prices: GTA's official announcement number, and its official buy prices
-- for gold of other purities.
--
-- announcement_seq   = GTA's own number for the announcement that set this
--                      row's prices: "ประกาศครั้งที่ N" of that Bangkok day
--                      (the feed's `priceSeq`). NOT the feed's `seq`, which is
--                      only the row number inside whatever date range was
--                      requested (the two match for a single day).
-- last_announced_seq = the number of the announcement recorded in
--                      last_announced_at (migration 0008): a later one that
--                      repeated these prices unchanged. Null if there was none.
--
-- The number shown on the site for the current price is last_announced_seq
-- when last_announced_at is set, otherwise announcement_seq. It is not the
-- same as the number of rows stored for the day: announcements that repeat the
-- previous prices get a number from GTA but never a row of their own.
--
-- ornament_buy_9999 / _90 / _80 / _50 / _40 = GTA's official tax-base buy
-- price per baht-weight for ornament gold of that purity (the feed's
-- oM9999_BuyPrice, oM90_BuyPrice, ...). They are GTA's figures, not pro rata:
-- 90% and 80% are 0.90x and 0.80x of ornament_buy (96.5%), but 50% is 0.45x
-- and 40% is 0.35x. Per gram = per baht-weight / 15.16, which reproduces the
-- feed's oM*_BuyGPrice exactly, so the per-gram figures are not stored.
--
-- All nullable: rows stored before this migration have none of these until
-- scripts/backfill-history.ts fills them, and GTA's own history has gaps
-- (2016 rows carry no 80% price).
--
-- No view or policy changes needed: daily_gold_prices and
-- yearly_gold_price_stats list their columns explicitly, and the existing
-- table-level SELECT grant/policy already covers new columns. Safe to re-run.

alter table gold_prices
  add column if not exists announcement_seq   integer,
  add column if not exists last_announced_seq integer,
  add column if not exists ornament_buy_9999  numeric(10,2),
  add column if not exists ornament_buy_90    numeric(10,2),
  add column if not exists ornament_buy_80    numeric(10,2),
  add column if not exists ornament_buy_50    numeric(10,2),
  add column if not exists ornament_buy_40    numeric(10,2);
