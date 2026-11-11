-- push_subscriptions: browser Web Push subscriptions for "every price change"
-- notifications (components/PushNotificationToggle.tsx ->
-- app/api/push/subscriptions/route.ts; sent by supabase/functions/fetch-prices).
--
-- One row per browser/device. No email or account is involved: the endpoint is
-- an opaque URL issued by the browser's push service (Google FCM, Mozilla,
-- Apple, Microsoft) and p256dh/auth are that browser's public encryption keys.
-- The endpoint is still a capability (anyone holding it plus our VAPID private
-- key could notify that device), so the table is locked down exactly like
-- price_alerts: RLS on, no anon/authenticated policies or grants, service_role
-- only. Safe to re-run.

create table if not exists push_subscriptions (
  id              bigserial primary key,
  endpoint        text not null unique,
  p256dh          text not null,
  auth            text not null,
  created_at      timestamptz not null default now(),
  -- Last time a push to this subscription was accepted by its push service.
  -- Null = never delivered yet. Rows the push service reports as gone
  -- (404/410) are deleted by the sender, so this is mainly for diagnostics.
  last_success_at timestamptz
);

alter table push_subscriptions enable row level security;

revoke all on push_subscriptions from anon, authenticated;
