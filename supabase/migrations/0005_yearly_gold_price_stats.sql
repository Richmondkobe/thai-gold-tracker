-- Per-calendar-year (Asia/Bangkok) min/max/avg of ทองคำแท่งขายออก (bar_sell),
-- computed across every intraday update, not just daily closes - a daily-close
-- based min/max would miss intraday swings. Aggregated in Postgres rather than
-- pulling thousands of gold_prices rows to the app just to reduce them to ~11
-- yearly rows.
create or replace view yearly_gold_price_stats
  with (security_invoker = true)
as
select
  extract(year from (fetched_at at time zone 'Asia/Bangkok'))::int as year,
  min(bar_sell) as min_price,
  max(bar_sell) as max_price,
  avg(bar_sell) as avg_price
from gold_prices
group by 1
order by 1;

grant select on yearly_gold_price_stats to anon, authenticated;
