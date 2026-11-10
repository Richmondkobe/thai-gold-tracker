@AGENTS.md

# Thai Gold Tracker

## Goal

Rank on Google Thailand for **ราคาทองวันนี้** (gold price today) and its variants (ราคาทองรูปพรรณวันนี้, ราคาทอง, ราคาทองคำวันนี้, ราคาทองย้อนหลัง). SEO is the product — every architectural decision favors indexability and speed over anything else. This is a content site, not an app; there is no login, no user accounts, no client-side state that matters to Google.

## Stack

- Next.js (App Router, TypeScript, Tailwind CSS)
- Supabase (Postgres, Singapore region) — read via `anon` key in RSC, write only via `service_role` key in server-only routes
- Deployed on Vercel. Scheduled price-fetching runs on **Supabase Edge Functions + pg_cron**, not Vercel Cron — Vercel's serverless IPs get a Cloudflare JS challenge from goldtraders.or.th that can't be passed server-side; Supabase's infrastructure isn't challenged. See `supabase/functions/fetch-prices/`.
- Source data: Thai Gold Traders Association (สมาคมค้าทองคำ, goldtraders.or.th) — no official public API; we call their internal JSON endpoints (`/api/GoldPrices/Latest`, `/api/GoldPrices/Details`) directly from the server. See fragility notes in the fetcher's comments before changing the parser.
- `app/api/cron/fetch-prices/route.ts` still exists but is **not used in production** (it would hit the same Cloudflare wall if actually invoked on Vercel) — kept only because `scripts/backfill-test.ts` exercises the same underlying `lib/` functions for local testing.

## Standing rules

1. **Every public page uses SSG or ISR — no client-only rendering for content Google must index.** Price data, tables, and text content must be present in the server-rendered HTML. Client components are only for interactive widgets layered on top of already-rendered content (e.g. chart hover, range toggle), never for the content itself.
2. **Every page has complete Thai metadata (title, description), OpenGraph tags, and JSON-LD structured data.** No page ships without a `generateMetadata`/`metadata` export and at least one relevant JSON-LD block (WebSite/Organization sitewide, FAQPage where applicable).
3. **Dates display in Thai Buddhist calendar (พ.ศ.) format.** Use the shared Thai date formatter — never raw ISO strings or Gregorian years in UI copy.
4. **Prices always show all four values:** ทองคำแท่ง รับซื้อ/ขายออก and ทองรูปพรรณ รับซื้อ (ฐานภาษี)/ขายออก, plus change vs. the previous update and vs. yesterday's close. Never show a partial price card.
5. **Keep dependencies minimal; no heavy client bundles.** No headless-browser libraries, no heavy charting libraries, no client-side data-fetching libraries for content that can be server-rendered. Justify any new dependency against this rule before adding it.

## Cron schedule (Supabase `pg_cron`)

One `cron.schedule(...)` job, `fetch-gold-prices` (run manually via the SQL editor,
not committed — it embeds `CRON_SECRET`): `"*/2 * * * *"`, every 2 minutes around
the clock (jobid 2). It calls `net.http_post()` against the deployed `fetch-prices`
Edge Function. Most runs are cheap no-ops: when the four prices match the latest row
nothing is inserted and no alerts fire; the only write is a `last_announced_at` stamp
when GTA has re-announced the same prices at a newer time (see "Official announcement
time" below). Only a genuinely new price inserts a row and fires price alerts.
(Verified against live `cron.job` 2026-11-11, when it was changed from `*/30` with
`cron.alter_job`.)

To change the schedule without retyping the secret:
`select cron.alter_job(job_id := (select jobid from cron.job where jobname = 'fetch-gold-prices'), schedule := '...');`

Things that follow from the 2-minute cadence: `cron.job_run_details` gains ~720 rows a
day and is never pruned automatically; and the public pages are ISR (`/` revalidates
every 300s), so a new price can take up to ~2 + 5 minutes to appear on the site even
though the alert email goes out as soon as the fetcher sees it.

## Price alerts

Email signup on the homepage (`components/PriceAlertSignup.tsx`) -> `POST /api/alerts` ->
Resend confirmation email -> `/alerts/confirm?token=` (auto-confirms on load, safe/idempotent)
or `/alerts/unsubscribe?token=` (requires a button click - deletion is destructive, so it's
a Server Action, not a GET-triggered side effect). Confirm and unsubscribe are purely
token-based, so they work identically for both alert types. `price_alerts` holds email PII:
RLS is fully locked (no anon/authenticated policies at all), every read/write goes through
`lib/supabase/admin.ts` server-side. Sending domain `thaigoldtracker.com` must be
verified in Resend before this works. No rate-limiting/abuse protection exists yet
(anyone can submit any email address) - add if this becomes a problem.

Two alert types (`price_alerts.alert_type`, migration 0007):

- **`target`** (the default; all pre-0007 rows) - one-shot. Fires when ทองคำแท่ง ขายออก
  crosses `target_price` in `direction`, then `triggered_at` is stamped and it never
  fires again.
- **`every_change`** ("ทุกครั้งที่ราคาเปลี่ยน") - recurring. Emailed on every genuinely new
  price row until the user unsubscribes. `target_price`/`direction` are null (a check
  constraint enforces target-needs-both / every_change-has-neither) and `triggered_at`
  is never stamped. One per email address: a partial unique index on `lower(email)`
  backs the API's check. A repeat signup is rejected (409) if already confirmed; if the
  earlier one was never confirmed, the confirmation email is re-sent instead.

Sending happens in the `fetch-prices` Edge Function, only after a new row is actually
inserted, and can never fail the insert (`fireAlerts` never throws). Order matters
because of Resend's daily cap: **target alerts are sent first** (individually), then
every_change emails via Resend's batch endpoint (one request per 100 recipients, each
person still gets their own email). On any Resend 429 / quota error the function stops
sending for that run and logs `RESEND QUOTA/RATE LIMIT HIT` - unsent target alerts stay
armed for the next price change, unsent every_change emails are skipped. Watch the
volume: every_change costs (subscribers x price changes per day) emails, and GTA can
announce 10-30+ changes on a volatile day, so the free plan's cap is reached quickly.

## Official announcement time (`last_announced_at`)

GTA sometimes re-announces identical prices. We never insert a row for that (it would
add a zero-change line to the intraday table and zero out "เทียบกับประกาศก่อนหน้า"), but the
fetcher stamps the newer `asTime` onto the existing latest row as
`gold_prices.last_announced_at` (migration 0008). `fetched_at` keeps meaning "when this
price took effect" and still drives the intraday table, charts, daily closes and every
change calculation. Anything that shows a "last updated" time must use
`LatestGoldPriceRow.announcedAt` from `getLatestPrices()` (= `last_announced_at ??
fetched_at`), never `fetchedAt`. The same logic is mirrored in `lib/gold-price-store.ts`.

## Explicitly out of scope (v2)

LINE integration, user accounts, fuel/currency price tracking. Do not implement these unless asked.
