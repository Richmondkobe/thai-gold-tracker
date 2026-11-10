-- price_alerts: add a second kind of alert.
--   'target'       - the original one-shot alert: fires once when ทองคำแท่ง
--                    ขายออก crosses target_price in `direction`, then
--                    triggered_at is stamped and it never fires again.
--   'every_change' - emails the subscriber on every new price announcement
--                    until they unsubscribe. No target, no direction, and
--                    triggered_at is never stamped.
-- Existing rows become 'target' via the default and keep working unchanged.
-- Safe to re-run.

alter table price_alerts
  add column if not exists alert_type text not null default 'target';

alter table price_alerts drop constraint if exists price_alerts_alert_type_check;
alter table price_alerts
  add constraint price_alerts_alert_type_check
  check (alert_type in ('target', 'every_change'));

-- every_change rows have no target, so these can no longer be NOT NULL...
alter table price_alerts alter column target_price drop not null;
alter table price_alerts alter column direction drop not null;

-- ...but a 'target' row must still carry both, and an 'every_change' row
-- must carry neither (keeps it out of the target-alert trigger query).
alter table price_alerts drop constraint if exists price_alerts_target_fields_check;
alter table price_alerts
  add constraint price_alerts_target_fields_check
  check (
    (alert_type = 'target' and target_price is not null and direction is not null)
    or
    (alert_type = 'every_change' and target_price is null and direction is null)
  );

-- One every_change subscription per email address, enforced by the database
-- so two simultaneous signups can't both get through. app/api/alerts/route.ts
-- checks first to give a friendly message; this is the backstop.
create unique index if not exists idx_price_alerts_one_every_change_per_email
  on price_alerts (lower(email))
  where alert_type = 'every_change';
