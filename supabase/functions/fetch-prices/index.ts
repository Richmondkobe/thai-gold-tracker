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
import {
  type Announcement,
  bangkokDay,
  insertColumns,
  parseAnnouncement,
  planAnnouncements,
  type Reannouncement,
} from "../_shared/announcements.ts";

// The cheap poll, every run: GTA's current price as one small JSON object.
const LATEST_URL =
  "https://www.goldtraders.or.th/api/GoldPrices/Latest?readjson=false";

// Every announcement in a date range (the endpoint behind GTA's own
// "ราคาทองย้อนหลัง" page, also used by scripts/backfill-history.ts). Fetched for
// ONE day, and only on a run where /Latest shows an announcement we have not
// seen: GTA can announce several times inside one 2-minute polling gap (90
// announcements on 2026-11-20, 14 of them never seen by /Latest polling), and
// this list is what recovers the ones in between. Most runs never call it.
const HISTORY_URL = "https://www.goldtraders.or.th/api/GoldPricesDaily/pricechanges";
const HISTORY_TIMEOUT_MS = 10_000;

/** All of one Bangkok day's announcements. Throws on any failure - the caller
 *  falls back to storing just the latest price. */
async function fetchDayAnnouncements(day: string): Promise<Announcement[]> {
  const response = await fetch(`${HISTORY_URL}?StartDate=${day}&EndDate=${day}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(HISTORY_TIMEOUT_MS),
  });
  if (!response.ok) {
    const bodySnippet = (await response.text().catch(() => "")).slice(0, 200);
    throw new Error(`history endpoint returned HTTP ${response.status}: ${bodySnippet}`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error(`history endpoint returned ${typeof data}, expected an array`);
  }

  const announcements: Announcement[] = [];
  let rejected = 0;
  for (const raw of data) {
    const announcement = parseAnnouncement(raw);
    // The day check guards against the endpoint ever ignoring the date range.
    if (announcement && bangkokDay(announcement.time) === day) announcements.push(announcement);
    else rejected++;
  }
  if (rejected > 0) {
    console.error(`[fetch-prices] history for ${day}: ${rejected} row(s) failed validation and were ignored`);
  }
  return announcements;
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

/** The stored columns the run needs from a gold_prices row. */
interface StoredRow {
  id: number;
  fetched_at: string;
  last_announced_at: string | null;
  last_announced_seq: number | null;
  bar_buy: number | string;
  bar_sell: number | string;
  ornament_buy: number | string;
  ornament_sell: number | string;
}

const STORED_ROW_COLUMNS =
  "id, fetched_at, last_announced_at, last_announced_seq, bar_buy, bar_sell, ornament_buy, ornament_sell";

/**
 * Records, on the row whose prices it repeats, a later announcement that left
 * them unchanged (migration 0008 explains why that is a column and not a new
 * row; 0011 adds the announcement number). Only ever moves the time forward.
 * Never throws: it is the displayed "อัปเดตล่าสุด" time and announcement number,
 * not a price, and must not fail a run. Returns true when something was written.
 */
async function stampReannouncement(
  supabase: Db,
  fetchedAtIso: string,
  reannouncement: Reannouncement,
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("gold_prices")
      .select("id, last_announced_at, last_announced_seq")
      .eq("fetched_at", fetchedAtIso)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return false;

    const storedMs = data.last_announced_at ? new Date(data.last_announced_at).getTime() : -Infinity;
    const newMs = reannouncement.at.getTime();
    const isNewer = newMs > storedMs;
    // Same announcement, stamped before the number was stored: add the number.
    const fillsSeq =
      newMs === storedMs && data.last_announced_seq === null && reannouncement.seq !== null;
    if (!isNewer && !fillsSeq) return false;

    const { error: updateError } = await supabase
      .from("gold_prices")
      .update({
        last_announced_at: reannouncement.at.toISOString(),
        last_announced_seq: reannouncement.seq,
      })
      .eq("id", data.id);
    if (updateError) throw new Error(updateError.message);
    return true;
  } catch (err) {
    console.error(
      "[fetch-prices] failed to record the re-announcement:",
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const authHeader = req.headers.get("authorization");
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return json({ error: "Unauthorized" }, 401);
  }

  // Manual repair hook, never used by the cron job: ?day=YYYY-MM-DD stores
  // every announcement of that Bangkok day, whether or not /Latest has moved.
  // It goes through exactly the same steps as a normal run, so it cannot
  // notify anyone about an old price (see isNewLatestPrice below).
  const dayParam = new URL(req.url).searchParams.get("day");
  if (dayParam !== null && !/^\d{4}-\d{2}-\d{2}$/.test(dayParam)) {
    return json({ error: "day must be YYYY-MM-DD" }, 400);
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
    const latest = parseAnnouncement(raw);
    if (!latest) {
      throw new Error(
        `latest price failed validation (four prices within the sane range, valid asTime): ${
          JSON.stringify({
            bL_BuyPrice: raw?.bL_BuyPrice,
            bL_SellPrice: raw?.bL_SellPrice,
            oM965_BuyPrice: raw?.oM965_BuyPrice,
            oM965_SellPrice: raw?.oM965_SellPrice,
            asTime: raw?.asTime,
          })
        }`,
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: latestData, error: selectError } = await supabase
      .from("gold_prices")
      .select(STORED_ROW_COLUMNS)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (selectError) throw new Error(`failed to read latest row: ${selectError.message}`);
    const latestRow = latestData as StoredRow | null;

    const latestIso = latest.time.toISOString();

    // The newest announcement we already know about: the latest row's own
    // time, or the time of a later announcement that repeated its prices.
    const knownMs = latestRow
      ? new Date(latestRow.last_announced_at ?? latestRow.fetched_at).getTime()
      : -Infinity;

    if (latest.time.getTime() <= knownMs && dayParam === null) {
      // Nothing announced since the last run - the case for almost every
      // poll, and all of them off-hours. One request to GTA, one read, no
      // writes, no notifications.
      return json({
        status: "skipped",
        reason: "unchanged",
        fetchedAt: latestIso,
        announcementTimeUpdated: false,
      });
    }

    // GTA has announced something new. Fetch the whole day's list, so that
    // announcements made between two polls are stored too, not just the one
    // /Latest happens to show now. If the list cannot be had, carry on with
    // the latest announcement alone: that is exactly what this function did
    // before the list existed, and a missed intermediate price must never
    // cost us the current one.
    const day = dayParam ?? bangkokDay(latest.time);
    let announcements: Announcement[] = [latest];
    let history: { status: "ok"; day: string; announcements: number } | {
      status: "failed";
      error: string;
    };
    try {
      const list = await fetchDayAnnouncements(day);
      // The list can lag /Latest by a moment; never lose the price in hand.
      if (dayParam === null && !list.some((a) => a.time.getTime() === latest.time.getTime())) {
        list.push(latest);
      }
      announcements = list;
      history = { status: "ok", day, announcements: list.length };
    } catch (err) {
      // An explicit repair run has nothing to fall back to.
      if (dayParam !== null) throw err;
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[fetch-prices] could not fetch the announcement list for ${day}; storing the latest price only: ${message}`,
      );
      history = { status: "failed", error: message };
    }

    if (announcements.length === 0) {
      return json({ status: "skipped", reason: "no announcements", fetchedAt: latestIso, history });
    }

    // The price in force just before the first announcement being processed:
    // what that announcement is compared against to tell a price change from
    // an unchanged repeat.
    const firstMs = Math.min(...announcements.map((a) => a.time.getTime()));
    const { data: baselineData, error: baselineError } = await supabase
      .from("gold_prices")
      .select(STORED_ROW_COLUMNS)
      .lt("fetched_at", new Date(firstMs).toISOString())
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (baselineError) throw new Error(`failed to read baseline row: ${baselineError.message}`);
    const baselineRow = baselineData as StoredRow | null;

    const plan = planAnnouncements(
      announcements,
      baselineRow
        ? {
          barBuy: Number(baselineRow.bar_buy),
          barSell: Number(baselineRow.bar_sell),
          ornamentBuy: Number(baselineRow.ornament_buy),
          ornamentSell: Number(baselineRow.ornament_sell),
        }
        : null,
    );

    // Upsert (not plain insert): gold_prices.fetched_at has a unique constraint
    // (migrations/0004_gold_prices_unique_fetched_at.sql), so the rows of the
    // day that are already stored are skipped at the DB level and only the
    // genuinely new ones come back from .select().
    const insertedMs = new Set<number>();
    if (plan.rows.length > 0) {
      const { data: insertedRows, error: upsertError } = await supabase
        .from("gold_prices")
        .upsert(plan.rows.map(insertColumns), { onConflict: "fetched_at", ignoreDuplicates: true })
        .select("fetched_at");

      if (upsertError) throw new Error(`upsert failed: ${upsertError.message}`);
      for (const row of insertedRows ?? []) insertedMs.add(new Date(row.fetched_at).getTime());
    }

    // If the newest announcement only repeated the newest price, record its
    // time and number on that price's row, so the site's "อัปเดตล่าสุด" and
    // "ประกาศครั้งที่" match the official ones. (A row inserted just now already
    // carries them.)
    const newest = plan.rows[plan.rows.length - 1];
    let announcementTimeUpdated = false;
    if (newest) {
      if (newest.reannouncement && !insertedMs.has(newest.announcement.time.getTime())) {
        announcementTimeUpdated = await stampReannouncement(
          supabase,
          newest.announcement.time.toISOString(),
          newest.reannouncement,
        );
      }
    } else if (plan.baselineReannouncement && baselineRow) {
      announcementTimeUpdated = await stampReannouncement(
        supabase,
        new Date(baselineRow.fetched_at).toISOString(),
        plan.baselineReannouncement,
      );
    }

    // Notify once per run at most, and only for a genuinely new CURRENT
    // price: the newest price change was inserted by this run and is newer
    // than anything stored before it. Older announcements recovered from the
    // list are stored silently - nobody wants five pushes for prices that
    // have already been replaced. The rows are safely stored by this point.
    // Browser push goes first (free, fast, no Resend quota), then the emails;
    // neither function ever throws, so one channel failing cannot affect the
    // other or the stored prices.
    const isNewLatestPrice = newest !== undefined &&
      insertedMs.has(newest.announcement.time.getTime()) &&
      (!latestRow ||
        newest.announcement.time.getTime() > new Date(latestRow.fetched_at).getTime());

    let pushStats: PushStats | undefined;
    let alertStats: AlertStats | undefined;
    if (newest && isNewLatestPrice) {
      // "Previous" is the official previous price change - the same figure the
      // homepage shows as "เทียบกับประกาศก่อนหน้า" - not the last price we
      // happened to notify about.
      const before = plan.rows[plan.rows.length - 2];
      const newPrice: NewPrice = {
        barBuy: newest.announcement.barBuy,
        barSell: newest.announcement.barSell,
        ornamentBuy: newest.announcement.ornamentBuy,
        ornamentSell: newest.announcement.ornamentSell,
        fetchedAt: newest.announcement.time,
        previousBarSell: before
          ? before.announcement.barSell
          : baselineRow
          ? Number(baselineRow.bar_sell)
          : null,
      };
      pushStats = await sendPricePush(supabase, newPrice);
      alertStats = await fireAlerts(supabase, newPrice);
    }

    const inserted = insertedMs.size;
    return json({
      status: inserted > 0 ? "inserted" : "skipped",
      reason: inserted > 0 ? undefined : plan.rows.length > 0 ? "already stored" : "unchanged",
      fetchedAt: latestIso,
      inserted,
      priceChanges: plan.rows.length,
      announcementTimeUpdated,
      notified: isNewLatestPrice,
      history,
      push: pushStats,
      alerts: alertStats,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[fetch-prices]", message);
    return json({ error: message }, 500);
  }
});
