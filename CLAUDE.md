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
time" below). Only a genuinely new price inserts a row and fires browser pushes and
price alerts.
(Verified against live `cron.job` 2026-11-11, when it was changed from `*/30` with
`cron.alter_job`.)

To change the schedule without retyping the secret:
`select cron.alter_job(job_id := (select jobid from cron.job where jobname = 'fetch-gold-prices'), schedule := '...');`

Things that follow from the 2-minute cadence:

- `cron.job_run_details` gains ~720 rows a day and pg_cron never prunes it. A second
  job, `prune-cron-run-details` (`17 20 * * *` UTC = 03:17 Bangkok), deletes rows older
  than 7 days. Created with `cron.schedule(...)` in the SQL editor and verified
  against live `cron.job` on 2026-11-11 (both jobs listed and active).
- The public pages are ISR. The homepage revalidates every 60s (the other price pages
  stay at 300s: every regeneration is an ISR write, and only `/` is worth spending
  them on). ISR serves the stale page to the first visitor after expiry, so a new
  price reaches the homepage roughly 1-3 minutes after GTA announces it - while the
  push/email goes out the moment the fetcher sees it, and a notification tapped
  straight away can briefly land on the previous price. On-demand revalidation from
  the Edge Function would close that gap; it is not built.

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
inserted (and after the browser pushes - see below), and can never fail the insert
(`fireAlerts` never throws). Order matters
because of Resend's daily cap: **target alerts are sent first** (individually), then
every_change emails via Resend's batch endpoint (one request per 100 recipients, each
person still gets their own email). On any Resend 429 / quota error the function stops
sending for that run and logs `RESEND QUOTA/RATE LIMIT HIT` - unsent target alerts stay
armed for the next price change, unsent every_change emails are skipped. Watch the
volume: every_change costs (subscribers x price changes per day) emails, and GTA can
announce 10-30+ changes on a volatile day, so the free plan's cap is reached quickly.

## Browser push notifications

Free, no email: the homepage button "เปิดการแจ้งเตือนราคาทองบนเครื่องนี้"
(`components/PushNotificationToggle.tsx`, above the email form) subscribes the browser
to Web Push for every price change.

- **Client.** `public/sw.js` is push-only on purpose - no `fetch` handler, no caching,
  so it can never serve a stale price; it is registered only when the user turns
  notifications on. `app/manifest.ts` + `public/icons/*` + `app/apple-icon.png` +
  `appleWebApp` metadata make the site installable, which is the only way iPhone/iPad
  allow web push (iOS 16.4+, opened from the home-screen icon); in a normal iOS Safari
  tab the card shows add-to-home-screen instructions instead of the button. The enable
  handler must call `Notification.requestPermission()` before any other `await`
  (Safari needs it directly in the tap) and must NOT await the welcome
  `showNotification()` (its promise can hang and froze the card in its busy state).
- **Storage.** `push_subscriptions` (migration 0009: `endpoint` unique, `p256dh`, `auth`,
  `created_at`, `last_success_at`). RLS fully locked like `price_alerts`; written only
  through `POST`/`DELETE /api/push/subscriptions` with the service-role client.
  `lib/push-subscription.ts` only accepts endpoints on known push-service hosts (FCM,
  Mozilla, Apple, Windows), because the sender POSTs to whatever URL is stored - add a
  host there if a legitimate browser is ever rejected.
- **Sending.** `supabase/functions/_shared/push.ts`, called by `fetch-prices` right after
  a genuinely new row is inserted and BEFORE any email (push is free and has no Resend
  quota). Title like "ราคาทองลง 50 บาท", body = new bar sell price + announcement time,
  tap opens `/`. Subscriptions answering 404/410 are deleted; the rest get
  `last_success_at`. Neither the push block nor the email block can throw, so one
  failing never affects the other or the stored price. Pushes use TTL 2h and a shared
  `Topic`, so a device coming back online gets only the latest price.
- **Library.** `jsr:@negrel/webpush@0.5.0` (pinned): pure Web Crypto + `fetch`, so it
  runs natively in the Supabase Edge (Deno) runtime, unlike the Node-based `web-push`
  package. It is a small 0.x library whose README says it has had no expert crypto
  review. Proven on 2026-11-11 by a push sent from the deployed Edge runtime and
  displayed by real Chrome on macOS (and decrypted by a scripted Mozilla subscriber).
- **Keys.** One VAPID pair, standard base64url format. `NEXT_PUBLIC_VAPID_PUBLIC_KEY` on
  Vercel (Production + Preview) - the button renders nothing if it is missing at build
  time. `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` as Supabase function secrets. The
  private key is deliberately NOT on Vercel (Vercel never sends pushes). All three are
  in the local `.env.local`. **Never regenerate the pair** - every existing browser
  subscription is bound to it and would silently stop working.
- **Testing without a price change.** The `push-test` Edge Function sends one push to
  one subscription (`{"id": <row id>}` or a full `{"subscription": ...}`); it cannot
  broadcast. Auth is a service_role key as Bearer, checked by using it against the Auth
  admin API (the runtime's injected `SUPABASE_SERVICE_ROLE_KEY` is not byte-identical
  to the dashboard key, so a string comparison fails). Deploy it with
  `--no-verify-jwt`. "Accepted by the push service" is not "shown on screen": OS-level
  settings (e.g. macOS System Settings > Notifications > Google Chrome) can hide
  notifications entirely.
- **Scale note.** Each push costs a little Edge Function CPU for encryption; fine for
  hundreds of subscribers, but revisit (batching across invocations) well before
  several thousand.

## Official announcement time (`last_announced_at`)

GTA sometimes re-announces identical prices. We never insert a row for that (it would
add a zero-change line to the intraday table and zero out "เทียบกับประกาศก่อนหน้า"), but the
fetcher stamps the newer `asTime` onto the existing latest row as
`gold_prices.last_announced_at` (migration 0008). `fetched_at` keeps meaning "when this
price took effect" and still drives the intraday table, charts, daily closes and every
change calculation. Anything that shows a "last updated" time must use
`LatestGoldPriceRow.announcedAt` from `getLatestPrices()` (= `last_announced_at ??
fetched_at`), never `fetchedAt`. The same logic is mirrored in `lib/gold-price-store.ts`.

## IndexNow (Bing and other participating engines)

Tells search engines about new and changed pages (protocol: indexnow.org/documentation).

- **Key.** `INDEXNOW_KEY` env var (Vercel Production + local `.env.local`). The repo is
  public and the protocol says only the owner and the search engines should know the
  key, so the key file is NOT committed: `/<key>.txt` is rewritten (next.config.ts) to
  `app/api/indexnow-key/[key]/route.ts`, which answers only for the configured key.
  Changing the key means updating the env var and redeploying.
- **Daily job.** Vercel Cron (`vercel.json`, `30 11 * * *` UTC = 18:30 Bangkok, after
  the market closes) calls `GET /api/cron/indexnow` with Vercel's `CRON_SECRET`. It
  submits the pages that change every trading day (`/`, `/history`,
  `/gold-price-chart`, the current month page, the current year page) plus any
  sitemap URL not yet in the `indexnow_urls` table (migration 0010), then records
  those. One POST to `api.indexnow.org`, which shares it with every engine.
- **Not on price changes, on purpose.** IndexNow asks sites not to resubmit a URL many
  times a day, and every submission spends crawl quota.
- **One-off tools.** `scripts/indexnow-submit-sitemap.ts --submit` sends the whole live
  sitemap (first setup or a big batch of new pages only); `--seed` records the sitemap
  in `indexnow_urls` without submitting. `vercel crons run /api/cron/indexnow` triggers
  the daily job by hand.
- 200 and 202 (key validation pending) are both success; 403 means the key file is not
  reachable or wrong.

## Explicitly out of scope (v2)

LINE integration, user accounts, fuel/currency price tracking. Do not implement these unless asked.
