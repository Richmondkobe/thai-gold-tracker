-- Each row represents one GTA-published price update at a specific instant
-- (fetched_at stores their own asTime, not our poll time - see lib/goldtraders.ts),
-- so it's a natural key. This lets both the live cron/edge function and the
-- historical backfill script (scripts/backfill-history.ts) safely upsert with
-- ON CONFLICT DO NOTHING instead of relying on app-side duplicate checks.
alter table gold_prices
  add constraint gold_prices_fetched_at_key unique (fetched_at);
