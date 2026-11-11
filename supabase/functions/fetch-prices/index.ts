// Deno edge function - runs on Supabase's infrastructure (not Vercel), scheduled via
// pg_cron. This exists because Vercel's serverless IPs get a Cloudflare JS challenge
// from goldtraders.or.th ("Just a moment..." interstitial) that no header tweaking can
// pass; Supabase Edge Functions run on different infrastructure and aren't challenged.
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically by the Supabase
// Edge Functions runtime - no need to set them manually. CRON_SECRET must be set via
// `supabase secrets set CRON_SECRET=...` or the Dashboard's Edge Functions > Secrets tab.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { type PushStats, sendPushToAll } from "../_shared/push.ts";

const LATEST_URL =
  "https://www.goldtraders.or.th/api/GoldPrices/Latest?readjson=false";

const MIN_SANE_PRICE = 10_000;
const MAX_SANE_PRICE = 100_000;

function isSanePrice(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > MIN_SANE_PRICE &&
    value < MAX_SANE_PRICE
  );
}

// GTA's `asTime` field has no timezone suffix (e.g. "2026-08-04T16:15:00") and is Bangkok local time.
function parseBangkokTime(asTime: unknown): Date | null {
  if (typeof asTime !== "string") return null;
  const date = new Date(`${asTime}+07:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

// ---------------------------------------------------------------------------
// Price alerts. Runs only after a NEW price row is inserted. Needs two extra
// secrets (set like CRON_SECRET, via `supabase secrets set` or the Dashboard):
//   RESEND_API_KEY - without it the block logs and skips; alerts stay armed.
//   SITE_URL       - for email links; falls back to the production domain.
//
// Two kinds of alert (price_alerts.alert_type, migration 0007):
//   'target'       - one-shot. triggered_at is stamped after a successful send
//                    and the alert never fires again; users re-subscribe for a
//                    new target.
//   'every_change' - recurring. Emailed on every new price until the user
//                    unsubscribes; triggered_at is never stamped.
//
// Browser push (push_subscriptions, migration 0009) is a third, separate
// channel: free, no Resend involved. It is sent FIRST, before any email, in its
// own never-throwing block (see sendPricePush), so neither side can hold up or
// break the other.
//
// Resend quota: the free plan has a daily cap. Target alerts are sent FIRST
// because they are one-shot and time-critical; every_change emails only go out
// with whatever quota is left. The moment Resend answers 429 (rate limit or
// daily/monthly quota) we stop sending for this run and log it - hammering a
// capped account achieves nothing. Unsent target alerts stay armed and retry
// on the next price change; unsent every_change emails are simply skipped.

const SITE_URL_FALLBACK = "https://thaigoldtracker.com";
const RESEND_API_URL = "https://api.resend.com/emails";
const RESEND_BATCH_URL = "https://api.resend.com/emails/batch";
// Resend's batch endpoint accepts at most 100 emails per request.
const RESEND_BATCH_SIZE = 100;
// Gap between individual sends, to stay under Resend's per-second rate limit.
const SEND_GAP_MS = 600;
// Safety ceiling on every_change recipients per run (PostgREST caps a response
// at ~1000 rows anyway). Far above what the Resend free plan can deliver.
const MAX_EVERY_CHANGE_RECIPIENTS = 1000;
const FROM_ADDRESS = "alerts@thaigoldtracker.com";

const thaiPriceFormatter = new Intl.NumberFormat("th-TH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// For change amounts: "100" rather than "100.00", but keeps satang if present.
const thaiAmountFormatter = new Intl.NumberFormat("th-TH", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const thaiPercentFormatter = new Intl.NumberFormat("th-TH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const thaiDateFormatter = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
  timeZone: "Asia/Bangkok",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

// "11 พ.ย. 2569" - matches lib/thai-date.ts formatThaiDateCompact.
const thaiShortDateFormatter = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
  timeZone: "Asia/Bangkok",
  day: "numeric",
  month: "short",
  year: "numeric",
});

const thaiTimeFormatter = new Intl.DateTimeFormat("th-TH", {
  timeZone: "Asia/Bangkok",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

// Matches lib/thai-date.ts formatThaiDateLong: "วันอาทิตย์ที่ 30 สิงหาคม พ.ศ. 2569".
function formatThaiDateLong(date: Date): string {
  return thaiDateFormatter
    .formatToParts(date)
    .map((part) => (part.type === "year" ? `พ.ศ. ${part.value}` : part.value))
    .join("");
}

/** Thrown when Resend refuses a send because of a rate limit or a daily /
 *  monthly quota. Callers stop sending for the rest of the run. */
class ResendQuotaError extends Error {}

async function throwResendError(response: Response): Promise<never> {
  const bodySnippet = (await response.text().catch(() => "")).slice(0, 300);
  const message = `Resend API returned HTTP ${response.status}: ${bodySnippet}`;
  // Resend uses 429 for rate_limit_exceeded, daily_quota_exceeded and
  // monthly_quota_exceeded; the body check is a backstop in case a quota
  // error ever arrives under a different status.
  if (response.status === 429 || /quota/i.test(bodySnippet)) {
    throw new ResendQuotaError(message);
  }
  throw new Error(message);
}

interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  headers?: Record<string, string>;
}

// Duplicated from lib/resend.ts, which is Next-server-only and not importable here.
async function sendEmail(apiKey: string, email: OutgoingEmail): Promise<void> {
  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_ADDRESS, ...email }),
  });

  if (!response.ok) await throwResendError(response);
}

/** Sends up to RESEND_BATCH_SIZE separate emails in ONE Resend request (each
 *  recipient gets their own email - nobody sees anyone else's address). */
async function sendEmailBatch(apiKey: string, emails: OutgoingEmail[]): Promise<void> {
  const response = await fetch(RESEND_BATCH_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(emails.map((email) => ({ from: FROM_ADDRESS, ...email }))),
  });

  if (!response.ok) await throwResendError(response);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// The untyped client (no generated Database types in this function).
type Db = SupabaseClient;

/** Everything the alert emails need about the price that was just inserted. */
interface NewPrice {
  barBuy: number;
  barSell: number;
  ornamentBuy: number;
  ornamentSell: number;
  /** GTA's official announcement time (their asTime). */
  fetchedAt: Date;
  /** ทองคำแท่ง ขายออก of the row this one replaced; null on an empty table. */
  previousBarSell: number | null;
}

function announcementLine(fetchedAt: Date): string {
  return `${formatThaiDateLong(fetchedAt)} เวลา ${thaiTimeFormatter.format(fetchedAt)} น.`;
}

interface ArmedAlert {
  id: number;
  email: string;
  target_price: number | string;
  direction: "above" | "below";
  token: string;
}

function alertEmailHtml(opts: {
  alert: ArmedAlert;
  barSell: number;
  fetchedAt: Date;
  siteUrl: string;
}): string {
  const { alert, barSell, fetchedAt, siteUrl } = opts;
  const directionLabel = alert.direction === "above" ? "สูงกว่า" : "ต่ำกว่า";
  const targetText = thaiPriceFormatter.format(Number(alert.target_price));
  const unsubscribeUrl = `${siteUrl}/alerts/unsubscribe?token=${alert.token}`;

  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>ราคาทองถึงเป้าหมายของคุณแล้ว</h2>
      <p>
        ราคาทองคำแท่งขายออกขณะนี้
        <strong>${thaiPriceFormatter.format(barSell)} บาท</strong>
        ตามประกาศของสมาคมค้าทองคำ
        ${announcementLine(fetchedAt)}
      </p>
      <p>
        เป้าหมายที่คุณตั้งไว้: แจ้งเตือนเมื่อราคา<strong>${directionLabel} ${targetText} บาท</strong>
      </p>
      <p>
        <a href="${siteUrl}" style="display:inline-block;background:#f59e0b;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;">
          ดูราคาทองวันนี้
        </a>
      </p>
      <p style="color:#888;font-size:13px;">
        การแจ้งเตือนนี้ส่งให้เพียงครั้งเดียว หากต้องการตั้งเป้าหมายใหม่
        สามารถสมัครรับการแจ้งเตือนได้อีกครั้งที่เว็บไซต์
      </p>
      <p style="font-size:12px;">
        <a href="${unsubscribeUrl}" style="color:#888;">ยกเลิกการแจ้งเตือน</a>
      </p>
    </div>
  `;
}

/** "ราคาทองขึ้น 100 บาท" / "ราคาทองลง 50 บาท" - shared by the push title and the
 *  every_change email. bar_sell can stay flat while another of the four prices
 *  moves (still a new announcement), and there is no previous price on an
 *  empty table, so both of those get neutral wording. */
function changeHeading(barSell: number, previousBarSell: number | null): string {
  const diff = previousBarSell === null ? 0 : barSell - previousBarSell;
  if (diff === 0) return "ราคาทองอัปเดตใหม่";
  return `ราคาทอง${diff > 0 ? "ขึ้น" : "ลง"} ${thaiAmountFormatter.format(Math.abs(diff))} บาท`;
}

/** Browser push to every subscribed device. Never throws; sendPushToAll also
 *  prunes subscriptions the push service reports as gone (404/410). */
async function sendPricePush(supabase: Db, price: NewPrice): Promise<PushStats> {
  try {
    const stats = await sendPushToAll(supabase, {
      title: changeHeading(price.barSell, price.previousBarSell),
      body:
        `ทองคำแท่งขายออก ${thaiPriceFormatter.format(price.barSell)} บาท\n` +
        `ประกาศ ${thaiShortDateFormatter.format(price.fetchedAt)} เวลา ${thaiTimeFormatter.format(price.fetchedAt)} น.`,
      url: "/",
      tag: "gold-price",
    });
    console.log(`[push] done: ${JSON.stringify(stats)}`);
    return stats;
  } catch (err) {
    console.error("[push] failed:", err instanceof Error ? err.message : err);
    return { sent: 0, gone: 0, failed: 0, skipped: "error" };
  }
}

interface EveryChangeSubscriber {
  id: number;
  email: string;
  token: string;
}

/** Subject + a per-recipient HTML builder for the "ทุกครั้งที่ราคาเปลี่ยน" email.
 *  Everything except the unsubscribe link is identical for every recipient. */
function everyChangeEmail(price: NewPrice, previousBarSell: number, siteUrl: string) {
  const diff = price.barSell - previousBarSell;
  const pct = previousBarSell !== 0 ? (diff / previousBarSell) * 100 : 0;
  const absDiff = thaiAmountFormatter.format(Math.abs(diff));
  const absPct = thaiPercentFormatter.format(Math.abs(pct));
  const newText = thaiPriceFormatter.format(price.barSell);
  const previousText = thaiPriceFormatter.format(previousBarSell);

  const heading = changeHeading(price.barSell, previousBarSell);
  let changeLine: string;
  let color: string;
  if (diff > 0) {
    changeLine = `▲ ขึ้น ${absDiff} บาท (+${absPct}%)`;
    color = "#16a34a";
  } else if (diff < 0) {
    changeLine = `▼ ลง ${absDiff} บาท (-${absPct}%)`;
    color = "#dc2626";
  } else {
    changeLine = "ราคาทองคำแท่งขายออกไม่เปลี่ยนแปลง (0.00%)";
    color = "#6b7280";
  }

  const cell = "padding:8px 0;border-bottom:1px solid #eee;";
  const row = (label: string, value: number) => `
          <tr>
            <td style="${cell}color:#555;">${label}</td>
            <td style="${cell}text-align:right;font-weight:600;">${thaiPriceFormatter.format(value)}</td>
          </tr>`;

  const html = (token: string) => `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>${heading}</h2>
      <p>
        ทองคำแท่งขายออก <strong>${newText} บาท</strong><br>
        <span style="color:#555;">ราคาก่อนหน้า ${previousText} บาท</span><br>
        <strong style="color:${color};">${changeLine}</strong>
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tbody>${row("ทองคำแท่ง รับซื้อ", price.barBuy)}${row("ทองคำแท่ง ขายออก", price.barSell)}${row("ทองรูปพรรณ รับซื้อ (ฐานภาษี)", price.ornamentBuy)}${row("ทองรูปพรรณ ขายออก", price.ornamentSell)}
        </tbody>
      </table>
      <p style="color:#555;font-size:13px;">
        ราคาบาทละ (บาท) ตามประกาศของสมาคมค้าทองคำ<br>
        ${announcementLine(price.fetchedAt)}
      </p>
      <p>
        <a href="${siteUrl}" style="display:inline-block;background:#f59e0b;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;">
          ดูราคาทองวันนี้
        </a>
      </p>
      <p style="color:#888;font-size:13px;">
        คุณได้รับอีเมลนี้เพราะสมัครรับการแจ้งเตือนทุกครั้งที่ราคาทองเปลี่ยน
      </p>
      <p style="font-size:12px;">
        <a href="${siteUrl}/alerts/unsubscribe?token=${token}" style="color:#888;">ยกเลิกการแจ้งเตือน</a>
      </p>
    </div>
  `;

  return { subject: `${heading} ทองคำแท่งขายออก ${newText} บาท`, html };
}

interface AlertStats {
  /** Target alerts sent (and stamped as triggered). */
  fired: number;
  /** Target alerts that failed to send; they stay armed. */
  failed: number;
  everyChangeSent: number;
  everyChangeFailed: number;
  /** True when Resend returned 429 / a quota error and sending was cut short. */
  quotaHit: boolean;
}

/** One-shot target alerts. Returns false when Resend's quota was hit. */
async function sendTargetAlerts(
  supabase: Db,
  apiKey: string,
  siteUrl: string,
  price: NewPrice,
  stats: AlertStats,
): Promise<boolean> {
  const { barSell, fetchedAt } = price;

  // 'above' fires when bar_sell >= target (target <= bar_sell); mirrored for
  // 'below'. barSell is our own sanity-checked number, safe to interpolate.
  const { data, error } = await supabase
    .from("price_alerts")
    .select("id, email, target_price, direction, token")
    .eq("alert_type", "target")
    .eq("confirmed", true)
    .is("triggered_at", null)
    .or(
      `and(direction.eq.above,target_price.lte.${barSell}),and(direction.eq.below,target_price.gte.${barSell})`,
    );

  if (error) {
    console.error("[alerts] failed to query armed target alerts:", error.message);
    return true;
  }

  const alerts = (data ?? []) as unknown as ArmedAlert[];
  for (const [index, alert] of alerts.entries()) {
    if (index > 0) await delay(SEND_GAP_MS);

    // Send first, stamp second: a send failure leaves the row armed to retry
    // next cycle; a stamp failure risks one duplicate email, never a lost one.
    try {
      await sendEmail(apiKey, {
        to: alert.email,
        subject: "ราคาทองถึงเป้าหมายของคุณแล้ว - ราคาทองวันนี้",
        html: alertEmailHtml({ alert, barSell, fetchedAt, siteUrl }),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (err instanceof ResendQuotaError) {
        const unsent = alerts.length - index;
        stats.failed += unsent;
        console.error(
          `[alerts] RESEND QUOTA/RATE LIMIT HIT - stopped sending for this run. ` +
            `${unsent} target alert(s) not sent (they stay armed and retry on the next price change); ` +
            `every_change emails skipped. ${message}`,
        );
        return false;
      }
      stats.failed++;
      console.error(`[alerts] send failed for target alert ${alert.id}:`, message);
      continue;
    }

    const { error: stampError } = await supabase
      .from("price_alerts")
      .update({ triggered_at: new Date().toISOString() })
      .eq("id", alert.id)
      .is("triggered_at", null);

    if (stampError) {
      console.error(
        `[alerts] sent but failed to stamp triggered_at for alert ${alert.id}:`,
        stampError.message,
      );
    }
    stats.fired++;
  }
  return true;
}

/** Recurring every_change emails. Never stamps triggered_at. */
async function sendEveryChangeAlerts(
  supabase: Db,
  apiKey: string,
  siteUrl: string,
  price: NewPrice,
  stats: AlertStats,
): Promise<void> {
  if (price.previousBarSell === null) {
    console.log("[alerts] no previous price to compare against; skipping every_change emails");
    return;
  }

  const { data, error } = await supabase
    .from("price_alerts")
    .select("id, email, token")
    .eq("alert_type", "every_change")
    .eq("confirmed", true)
    .order("id", { ascending: true })
    .limit(MAX_EVERY_CHANGE_RECIPIENTS);

  if (error) {
    console.error("[alerts] failed to query every_change subscribers:", error.message);
    return;
  }

  const subscribers = (data ?? []) as unknown as EveryChangeSubscriber[];
  if (subscribers.length === 0) return;

  const { subject, html } = everyChangeEmail(price, price.previousBarSell, siteUrl);

  for (let i = 0; i < subscribers.length; i += RESEND_BATCH_SIZE) {
    if (i > 0) await delay(SEND_GAP_MS);
    const chunk = subscribers.slice(i, i + RESEND_BATCH_SIZE);

    try {
      await sendEmailBatch(
        apiKey,
        chunk.map((subscriber) => ({
          to: subscriber.email,
          subject,
          html: html(subscriber.token),
          // Lets mail clients show their own "unsubscribe" link for this
          // recurring email; it opens our confirm-by-button page.
          headers: {
            "List-Unsubscribe": `<${siteUrl}/alerts/unsubscribe?token=${subscriber.token}>`,
          },
        })),
      );
      stats.everyChangeSent += chunk.length;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (err instanceof ResendQuotaError) {
        const unsent = subscribers.length - i;
        stats.everyChangeFailed += unsent;
        stats.quotaHit = true;
        console.error(
          `[alerts] RESEND QUOTA/RATE LIMIT HIT - stopped sending for this run. ` +
            `${unsent} of ${subscribers.length} every_change email(s) not sent for this price change. ${message}`,
        );
        return;
      }
      stats.everyChangeFailed += chunk.length;
      console.error(`[alerts] every_change batch of ${chunk.length} failed:`, message);
    }
  }
}

/** Sends alerts for a freshly inserted price: target alerts first, then
 *  every_change. Never throws: the price upsert is the function's primary job
 *  and must not fail because of alerts. */
async function fireAlerts(supabase: Db, price: NewPrice): Promise<AlertStats> {
  const stats: AlertStats = {
    fired: 0,
    failed: 0,
    everyChangeSent: 0,
    everyChangeFailed: 0,
    quotaHit: false,
  };

  const siteUrl = Deno.env.get("SITE_URL") ?? SITE_URL_FALLBACK;
  console.log(
    `[alerts] SITE_URL resolved to ${siteUrl} (${Deno.env.get("SITE_URL") ? "secret" : "fallback"})`,
  );

  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    console.error("[alerts] RESEND_API_KEY not set; skipping alerts (target alerts stay armed)");
    return stats;
  }

  // Separate try blocks: an unexpected failure in one kind of alert must not
  // stop the other from being attempted.
  let quotaOk = true;
  try {
    quotaOk = await sendTargetAlerts(supabase, apiKey, siteUrl, price, stats);
  } catch (err) {
    console.error("[alerts] target alert block failed:", err instanceof Error ? err.message : err);
  }

  if (!quotaOk) {
    stats.quotaHit = true;
    return stats;
  }

  try {
    await sendEveryChangeAlerts(supabase, apiKey, siteUrl, price, stats);
  } catch (err) {
    console.error(
      "[alerts] every_change alert block failed:",
      err instanceof Error ? err.message : err,
    );
  }

  console.log(`[alerts] done: ${JSON.stringify(stats)}`);
  return stats;
}

Deno.serve(async (req) => {
  const authHeader = req.headers.get("authorization");
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const response = await fetch(LATEST_URL, {
      headers: { accept: "application/json" },
    });

    if (!response.ok) {
      const bodySnippet = (await response.text().catch(() => "")).slice(0, 300);
      throw new Error(`goldtraders API returned HTTP ${response.status}: ${bodySnippet}`);
    }

    const raw = await response.json();
    const barBuy = raw.bL_BuyPrice;
    const barSell = raw.bL_SellPrice;
    const ornamentBuy = raw.oM965_BuyPrice;
    const ornamentSell = raw.oM965_SellPrice;

    const prices = { barBuy, barSell, ornamentBuy, ornamentSell };
    const invalid = Object.entries(prices).filter(([, v]) => !isSanePrice(v));
    if (invalid.length > 0) {
      throw new Error(
        `parsed prices failed sanity check (expected ${MIN_SANE_PRICE}-${MAX_SANE_PRICE}): ${JSON.stringify(prices)}`,
      );
    }

    const fetchedAt = parseBangkokTime(raw.asTime);
    if (!fetchedAt) {
      throw new Error(`missing/invalid asTime: ${JSON.stringify(raw.asTime)}`);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: latestRow, error: selectError } = await supabase
      .from("gold_prices")
      .select("id, fetched_at, last_announced_at, bar_buy, bar_sell, ornament_buy, ornament_sell")
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (selectError) throw new Error(`failed to read latest row: ${selectError.message}`);

    const fetchedAtIso = fetchedAt.toISOString();

    if (
      latestRow &&
      Number(latestRow.bar_buy) === barBuy &&
      Number(latestRow.bar_sell) === barSell &&
      Number(latestRow.ornament_buy) === ornamentBuy &&
      Number(latestRow.ornament_sell) === ornamentSell
    ) {
      // Same four prices as the row we already have: no new row, no alerts.
      // But if GTA has issued a NEWER announcement repeating these prices,
      // record its time on the existing row so the site's "อัปเดตล่าสุด"
      // matches the official one (migration 0008 explains why it's a column
      // and not a new row). Off-hours polls see the same asTime again and
      // write nothing.
      const lastKnownMs = new Date(
        latestRow.last_announced_at ?? latestRow.fetched_at,
      ).getTime();
      let announcementTimeUpdated = false;
      if (fetchedAt.getTime() > lastKnownMs) {
        const { error: stampError } = await supabase
          .from("gold_prices")
          .update({ last_announced_at: fetchedAtIso })
          .eq("id", latestRow.id);
        if (stampError) {
          // Cosmetic only - never fail the run over the display timestamp.
          console.error(
            "[fetch-prices] failed to update last_announced_at:",
            stampError.message,
          );
        } else {
          announcementTimeUpdated = true;
        }
      }

      return new Response(
        JSON.stringify({
          status: "skipped",
          reason: "unchanged",
          fetchedAt: fetchedAtIso,
          announcementTimeUpdated,
        }),
        { headers: { "content-type": "application/json" } },
      );
    }

    // Upsert (not plain insert): gold_prices.fetched_at has a unique constraint
    // (migrations/0004_gold_prices_unique_fetched_at.sql), shared with
    // scripts/backfill-history.ts. The price-comparison check above already
    // catches the common case, but this makes the insert itself idempotent at
    // the DB level too, instead of throwing a constraint-violation 500 if this
    // exact timestamp somehow already exists.
    const { error: upsertError, count } = await supabase
      .from("gold_prices")
      .upsert(
        {
          fetched_at: fetchedAtIso,
          bar_buy: barBuy,
          bar_sell: barSell,
          ornament_buy: ornamentBuy,
          ornament_sell: ornamentSell,
          source: "goldtraders",
        },
        { onConflict: "fetched_at", ignoreDuplicates: true, count: "exact" },
      );

    if (upsertError) throw new Error(`upsert failed: ${upsertError.message}`);

    const inserted = Boolean(count && count > 0);

    // Only a genuinely new price notifies anyone, and the row is already
    // safely stored by this point. Browser push goes first (free, fast, no
    // Resend quota), then the emails; neither function ever throws, so one
    // channel failing cannot affect the other or the stored price.
    const newPrice: NewPrice = {
      barBuy,
      barSell,
      ornamentBuy,
      ornamentSell,
      fetchedAt,
      previousBarSell: latestRow ? Number(latestRow.bar_sell) : null,
    };
    const pushStats = inserted ? await sendPricePush(supabase, newPrice) : undefined;
    const alertStats = inserted ? await fireAlerts(supabase, newPrice) : undefined;

    return new Response(
      JSON.stringify({
        status: inserted ? "inserted" : "skipped",
        reason: inserted ? undefined : "duplicate fetched_at",
        fetchedAt: fetchedAtIso,
        push: pushStats,
        alerts: alertStats,
      }),
      { headers: { "content-type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[fetch-prices]", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
});
