-- indexnow_urls: every sitemap URL that has been submitted to IndexNow at
-- least once. The daily job (app/api/cron/indexnow/route.ts) compares the
-- current sitemap against this list so it can submit pages that are NEW since
-- the last run (a new month or year page, or one added by a deploy) without
-- resubmitting the whole site every day.
--
-- Not sensitive (these are public URLs), but nothing outside the server needs
-- it, so it is locked down like the other server-only tables: RLS on, no
-- anon/authenticated policies or grants, service_role only. Safe to re-run.

create table if not exists indexnow_urls (
  url                text primary key,
  first_submitted_at timestamptz not null default now()
);

alter table indexnow_urls enable row level security;

revoke all on indexnow_urls from anon, authenticated;
