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
Edge Function. Most runs are cheap no-ops: one small request to GTA's `/Latest`, one
read, and when its `asTime` is not newer than what is stored, nothing else. Only when
GTA has announced something new does the run fetch the day's full announcement list
and write (see "Storing every announcement" below). Only a genuinely new current price
fires browser pushes and price alerts, once per run.
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

## Storing every announcement (fetch-prices)

GTA can announce several times inside one 2-minute polling gap (2026-11-20: 90
announcements, 14 never seen by polling `/Latest`), so `/Latest` alone loses prices.

- **Flow.** Every run polls `/api/GoldPrices/Latest`. If its `asTime` is newer than the
  latest row's `last_announced_at ?? fetched_at`, the run also fetches
  `/api/GoldPricesDaily/pricechanges?StartDate=D&EndDate=D` for that Bangkok day (every
  announcement, same row shape) and upserts every price change in it (`onConflict:
  fetched_at`, `ignoreDuplicates`), so announcements missed between polls are stored
  too. If the list fails (10s timeout, non-200, not an array) the run logs it and stores
  the latest price alone, exactly the pre-list behaviour. At most ~90 list requests on
  the busiest day; do not move the list fetch onto every run.
- **Repeats are not rows.** The list includes announcements whose four prices equal the
  previous one (19 of 1,967 since 2026-08-01, mostly the first one on a Sunday). They
  never become rows; see "Official announcement time" below.
- **`priceSeq`, not `seq`.** `priceSeq` is GTA's official per-day number ("ประกาศครั้งที่").
  `seq` is only the row number inside the requested range: equal for one day and for
  `/Latest`, wrong for any longer range.
- **Notifications.** At most one push/email round per run, only when the newest price
  change was inserted by this run and is newer than every row stored before it.
  Recovered older announcements are stored silently. The "previous price" in the push
  and email is the official previous price change (what the homepage shows as
  เทียบกับประกาศก่อนหน้า), not the last price a notification was sent for.
- **Shared logic.** `supabase/functions/_shared/announcements.ts` (parsing, the
  repeat rule, the column mapping) is pure TypeScript with no imports, used by both the
  Edge Function and `scripts/backfill-history.ts`. Keep it import-free.
  `lib/gold-price-store.ts` (local testing only) mirrors just the latest-only path.
- **Repair.** `POST .../fetch-prices?day=YYYY-MM-DD` (same `CRON_SECRET` bearer) stores
  one day's announcements from Supabase's side; it never notifies about an old price.
  From a laptop, `npm run backfill-history -- --from=YYYY-MM-DD [--dry-run]` does the
  same for a range, and also fills `announcement_seq` and the purity prices on rows
  that already exist. Run from a worktree it needs the env file:
  `npx tsx --conditions=react-server --env-file=<repo>/.env.local scripts/backfill-history.ts ...`.
- **Left alone.** Rows GTA later withdrew (in the table but not in GTA's list, e.g.
  2026-09-17 15:28 and 2026-11-18 09:30 Bangkok) and the zero-change rows the original
  2016-onwards backfill stored are never deleted. Before 2026-08-01 `announcement_seq`
  and the purity prices are null (not backfilled).

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
fetcher stamps the newer `asTime` onto the row it repeats as
`gold_prices.last_announced_at` (migration 0008) and its official number as
`last_announced_seq` (migration 0011). `fetched_at` keeps meaning "when this
price took effect" and still drives the intraday table, charts, daily closes and every
change calculation. Anything that shows a "last updated" time must use
`LatestGoldPriceRow.announcedAt` from `getLatestPrices()` (= `last_announced_at ??
fetched_at`), never `fetchedAt`. The same logic is mirrored in `lib/gold-price-store.ts`.

The official announcement number works the same way: `gold_prices.announcement_seq` is
the number of the announcement that set the row's prices, and
`LatestGoldPriceRow.announcementSeq` is the number of the announcement at `announcedAt`
(`last_announced_seq` after a re-announcement, else `announcement_seq`; null when
unknown, never the older number). It is NOT the count of rows for the day, because
repeats are numbered by GTA but have no row.

## IndexNow (Bing and other participating engines)

Tells search engines about new and changed pages (protocol: indexnow.org/documentation).

- **Key.** `INDEXNOW_KEY` env var (Vercel Production + local `.env.local`). The repo is
  public and the protocol says only the owner and the search engines should know the
  key, so the key file is NOT committed: `/<key>.txt` is rewritten (next.config.ts) to
  `app/api/indexnow-key/[key]/route.ts`, which answers only for the configured key.
  Changing the key means updating the env var and redeploying.
- **Daily job.** Vercel Cron (`vercel.json`, `1 17 * * *` UTC = 00:01 Bangkok) calls
  `GET /api/cron/indexnow` with Vercel's `CRON_SECRET`. It runs just after midnight
  because the homepage `<title>` carries today's Bangkok date: the job first purges
  the cached homepage (`revalidatePath("/")`), re-requests it and checks the new date
  is in the title (reported as `homepageShowsToday`), then submits. Minute-level cron
  timing needs the Vercel Pro plan the project is on; on Hobby it would fire any time
  within the hour, and ordinary ISR (60s) would still roll the date on the first
  visits after midnight. It
  submits the pages that change every trading day (`/`, `/history`,
  `/gold-price-chart`, the current month page, the current year page) plus any
  sitemap URL not yet in the `indexnow_urls` table (migration 0010), then records
  those. Each new daily report page reaches IndexNow this way, once. One POST to
  `api.indexnow.org`, which shares it with every engine.
- **Not on price changes, on purpose.** IndexNow asks sites not to resubmit a URL many
  times a day, and every submission spends crawl quota.
- **One-off tools.** `scripts/indexnow-submit-sitemap.ts --submit` sends the whole live
  sitemap (first setup or a big batch of new pages only); `--seed` records the sitemap
  in `indexnow_urls` without submitting. `vercel crons run /api/cron/indexnow` triggers
  the daily job by hand.
- 200 and 202 (key validation pending) are both success; 403 means the key file is not
  reachable or wrong.

## Sitemap dates, and the dates on articles

`app/sitemap.ts` emits a REAL `<lastmod>` for every URL, never "now". It is
`force-dynamic` (built on every request) on purpose: as a cached ISR route Vercel
served the deploy-time copy for ten days without regenerating it, freezing every
date - do not make it static again without proving regeneration on the live site.
Price-driven pages use the time of the newest stored price, a finished month
or year uses the time of its last price, and articles and trust pages use the
hand-maintained `updatedAt` in `lib/guide-pages.ts` / `lib/trust-pages.ts`. **Bump
`updatedAt` by hand whenever you edit an article or trust page** - for articles it
also drives the visible "อัปเดตล่าสุด" line and the Article JSON-LD `dateModified`.
Keep meta descriptions at or under 160 characters.

## Homepage data blocks (purity table, comparison, today's summary)

All server-rendered from data already loaded for the page (no extra queries).

- **Official purity table** (`components/OfficialPurityTable.tsx`): GTA's own tax-base
  buy prices for 99.99/96.5/90/80/50/40% ornament gold, per baht-weight and per gram,
  from `gold_prices.ornament_buy_9999/_90/_80/_50/_40` (migration 0011; the 96.5% row
  is `ornament_buy`). Nothing is estimated. They are NOT pro rata (50% is 0.45x and 40%
  is 0.35x of the 96.5% figure), which the last column shows, computed from the data.
  Per gram = per baht-weight / 15.16 (ornament gold), which reproduces GTA's
  `oM*_BuyGPrice` exactly, so per-gram figures are not stored. GTA announces no sell
  prices for other purities and nothing for 75%. Renders nothing when the latest row
  has no purity prices.
- **Estimate table** (`components/PurityPriceTable.tsx`, `lib/purity.ts`), shown under
  the official one: only the 96.5% row is an announced price. Every other row is an
  ESTIMATE of gold-content value, pro rata from the 96.5% bar price (`price x percent /
  96.5`; per gram = `/ 15.244`), and the page says so. Kept because it is the only
  source for sell-side and 75% figures.
- **Comparison box** (`components/PriceComparison.tsx`): latest bar sell vs the daily
  close 1, 7 and 30 calendar days before today, falling back to the nearest earlier
  close and showing its date. Needs the 45 daily rows the homepage loads (the chart
  uses the last 30).
- **Today's summary** (`components/TodaySummary.tsx`): shows GTA's official
  "ประกาศครั้งที่ N" (`LatestGoldPriceRow.announcementSeq`) when the latest announcement
  is today's, plus how many of those changed the price (rows stored today, which can
  be fewer). When the number is unknown it falls back to the row count, labelled as
  recorded price changes and never as the official number.

## Daily report pages (`/รายงานราคาทอง/23-พฤศจิกายน-2569`)

One automatic page per trading day, built only from `gold_prices`. No hand-written
content and no deploy per day.

- **Which days.** A Bangkok calendar day with at least one `gold_prices` row (a price
  change), from `REPORT_START_DATE` = 2026-11-01 (`lib/report-pages.ts`). Same days as
  the `daily_gold_prices` view and the month tables. A day on which GTA only repeated
  the previous prices (most Sundays) has no row and no report; today's report appears
  with the day's first price change, and its URL 404s before that. Older days are
  deliberately not built - do not lower the start date without being asked.
- **Route.** `app/gold-report/[reportSlug]/page.tsx`, ISR 300s, the last 7 days
  prebuilt. Thai public path via a rewrite in `next.config.ts`, like the month pages.
  Slug = day (no leading zero) + Thai month name + Buddhist year; any other spelling
  404s.
- **Figures** (`lib/daily-report.ts`, `buildDailyReport`, pure): every announcement
  with its official number and time, open (first announcement), close (last price),
  high/low of ทองคำแท่ง ขายออก, change vs the previous trading day's close for all four
  prices, and GTA's official purity buy prices at the close. Rows with no
  `announcement_seq` on a day whose other rows have one are prices GTA later withdrew
  and are left out of the report. Known unchanged repeats are listed in grey; only the
  last repeat of each row is stored, so the table can skip numbers and the page says so.
  The count the report states is the number of price changes, which is exact.
- **Text.** The summary paragraph, share text, title and description are templates
  filled from those figures (`buildReportSummary`, `buildReportShareText`, ...).
  **Numbers only: never add reasons, outlook or opinion about why the price moved.**
  A day still in progress says "ราคาล่าสุด" where a finished day says "ปิดที่".
- **Share box** (`components/ShareSummaryBox.tsx`, client component for the copy button
  only; the text is server-rendered). Its link is the short ASCII form `/r/23-11-2569`
  (day-month-Buddhist year), which 308-redirects to the Thai URL through twelve
  redirects generated in `next.config.ts`. It exists because a Thai URL pasted into
  LINE or a blog gets cut off or percent-encoded. Never use it as a canonical or in the
  sitemap.
- **Links in.** Homepage (under today's summary: today's report once it exists, else
  the latest one, labelled with its date), each month page (a list of that month's
  reports), prev/next on every report, and the sitemap (`lastmod` = that day's last
  price).
- **IndexNow.** Nothing special: each report is a new sitemap URL, so the daily job
  submits it once, on the night after its day, when it is complete. Just before
  submitting, the job calls `revalidatePath("/gold-report/[reportSlug]", "page")` so a
  copy cached mid-day is not what a search engine fetches.
- Article + BreadcrumbList JSON-LD; `datePublished` = the day's first announcement,
  `dateModified` = its latest.

## Embeddable widget (`/วิดเจ็ตราคาทอง`, alias `/widget`)

A free gold price widget other sites paste into their pages. Everything about it is
in `lib/widget.ts` (sizes, themes, URLs, the embed code).

- **The widget itself** is `app/embed/gold-price/[variant]/route.ts`, e.g.
  `/embed/gold-price/sidebar-light` (`sidebar|banner|mobile` x `light|dark`; anything
  else 404s). A Route Handler returning one hand-written HTML string, about 4 KB: no
  root layout, no React, no JavaScript, no images, no cookies, no external requests,
  system fonts. A `Content-Security-Policy` of `default-src 'none'` (inline CSS only,
  `frame-ancestors *`) enforces that. `X-Robots-Tag: noindex`. Keep it script-free.
- **Caching.** Dynamic handler with `Cache-Control: public, max-age=60, s-maxage=60`,
  deliberately NOT ISR: ISR serves a stale copy to the first visitor after a quiet
  spell, which for a price on a low-traffic blog could be hours old. A CDN miss costs
  two small reads. The document also reloads itself every 5 minutes (meta refresh).
- **What it shows.** All four prices (never a partial card), ทองคำแท่ง ขายออก against
  the previous price and against the last daily close before today, the latest
  announcement's date and time and its official number
  (`LatestGoldPriceRow.announcementSeq`), and the brand name linking to the homepage.
- **Layouts** follow the iframe's own size: a card (sidebar 300x300, mobile up to
  480x300; type steps down below 280px wide), a one-row banner (728x130), and below
  660px wide a compact table version of the banner in the same height. If you change
  a height in `lib/widget.ts`, change the CSS with it and re-check each size at its
  narrowest width.
- **Embed code** (`buildWidgetEmbedCode`): a wrapper `<div>` with a max-width, the
  `<iframe>` filling it at a fixed height, and a credit line in the HOST page:
  "ราคาทองจาก ThaiGoldTracker", where only the brand name is the link (plain visible
  link to the homepage, `rel="noopener"`). **Keep the anchor branded - never turn it
  into a keyword phrase.** Inline styles only, no `<script>`, so it works in
  WordPress's Custom HTML block and Blogger's HTML/JavaScript gadget. The iframe's
  inline style resets margin, padding, border, max-width and height because themes
  ship global `iframe {}` rules; tested on a plain page with such rules, at desktop
  and phone widths. **Never change the `/embed/gold-price/...` URLs or remove a
  variant** - code already pasted on other people's sites depends on them.
- **Widget page** `app/gold-widget/page.tsx` (static): explanation, the
  `WidgetBuilder` client component (size/theme picker, live preview using the embed
  code's own markup, copy button), install steps, FAQ with FAQPage JSON-LD. Linked
  from the site footer and the homepage, in the sitemap with the hand-maintained
  `WIDGET_PAGE_UPDATED_AT` (bump it when the page's text changes).

## Explicitly out of scope (v2)

LINE integration, user accounts, fuel/currency price tracking. Do not implement these unless asked.
