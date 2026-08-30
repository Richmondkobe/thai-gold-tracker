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
not committed — it embeds `CRON_SECRET`): `"*/30 * * * *"`, every 30 minutes around
the clock. Off-hours runs are cheap no-ops — the Edge Function's unchanged-price
check skips the insert, and only a genuinely new announcement fires price alerts.
It calls `net.http_post()` against the deployed `fetch-prices` Edge Function.
(Verified against live `cron.job` 2026-08-30; an earlier two-job 08:00-19:00
Bangkok schedule described here previously has been replaced.)

## Price alerts

Email signup on the homepage (`components/PriceAlertSignup.tsx`) -> `POST /api/alerts` ->
Resend confirmation email -> `/alerts/confirm?token=` (auto-confirms on load, safe/idempotent)
or `/alerts/unsubscribe?token=` (requires a button click - deletion is destructive, so it's
a Server Action, not a GET-triggered side effect). `price_alerts` holds email PII: RLS is
fully locked (no anon/authenticated policies at all), every read/write goes through
`lib/supabase/admin.ts` server-side. Sending domain `thaigoldtracker.com` must be
verified in Resend before this works. No rate-limiting/abuse protection exists yet
(anyone can submit any email address) - add if this becomes a problem.

## Explicitly out of scope (v2)

LINE integration, user accounts, fuel/currency price tracking. Do not implement these unless asked.
