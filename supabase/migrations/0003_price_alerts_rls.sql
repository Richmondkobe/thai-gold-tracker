-- price_alerts stores email addresses (PII) - lock it down completely.
-- No anon/authenticated policies are defined, so with RLS enabled every
-- operation is denied for those roles by default; only the service_role
-- key (used server-side in app/api/alerts/route.ts, app/alerts/confirm,
-- and app/alerts/unsubscribe) can read or write this table.
alter table price_alerts enable row level security;

revoke all on price_alerts from anon, authenticated;
