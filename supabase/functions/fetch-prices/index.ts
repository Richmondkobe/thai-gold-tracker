// Deno edge function - runs on Supabase's infrastructure (not Vercel), scheduled via
// pg_cron. This exists because Vercel's serverless IPs get a Cloudflare JS challenge
// from goldtraders.or.th ("Just a moment..." interstitial) that no header tweaking can
// pass; Supabase Edge Functions run on different infrastructure and aren't challenged.
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically by the Supabase
// Edge Functions runtime - no need to set them manually. CRON_SECRET must be set via
// `supabase secrets set CRON_SECRET=...` or the Dashboard's Edge Functions > Secrets tab.

import { createClient } from "npm:@supabase/supabase-js@2";

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
// One-shot semantics: triggered_at is stamped after a successful send and the
// alert never fires again; users re-subscribe for a new target.

const SITE_URL_FALLBACK = "https://thaigoldtracker.com";
const RESEND_API_URL = "https://api.resend.com/emails";
const FROM_ADDRESS = "alerts@thaigoldtracker.com";

const thaiPriceFormatter = new Intl.NumberFormat("th-TH", {
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

// Duplicated from lib/resend.ts, which is Next-server-only and not importable here.
async function sendEmail(
  apiKey: string,
  opts: { to: string; subject: string; html: string },
): Promise<void> {
  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    }),
  });

  if (!response.ok) {
    const bodySnippet = (await response.text().catch(() => "")).slice(0, 300);
    throw new Error(`Resend API returned HTTP ${response.status}: ${bodySnippet}`);
  }
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
        ${formatThaiDateLong(fetchedAt)} เวลา ${thaiTimeFormatter.format(fetchedAt)} น.
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

/** Fires armed alerts for a freshly inserted price. Never throws: the price
 *  upsert is the function's primary job and must not fail because of alerts. */
async function fireAlerts(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  barSell: number,
  fetchedAt: Date,
): Promise<{ fired: number; failed: number }> {
  const stats = { fired: 0, failed: 0 };
  try {
    const siteUrl = Deno.env.get("SITE_URL") ?? SITE_URL_FALLBACK;
    console.log(
      `[alerts] SITE_URL resolved to ${siteUrl} (${Deno.env.get("SITE_URL") ? "secret" : "fallback"})`,
    );

    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) {
      console.error("[alerts] RESEND_API_KEY not set; skipping alerts (they stay armed)");
      return stats;
    }

    // 'above' fires when bar_sell >= target (target <= bar_sell); mirrored for
    // 'below'. barSell is our own sanity-checked number, safe to interpolate.
    const { data, error } = await supabase
      .from("price_alerts")
      .select("id, email, target_price, direction, token")
      .eq("confirmed", true)
      .is("triggered_at", null)
      .or(
        `and(direction.eq.above,target_price.lte.${barSell}),and(direction.eq.below,target_price.gte.${barSell})`,
      );

    if (error) {
      console.error("[alerts] failed to query armed alerts:", error.message);
      return stats;
    }

    for (const alert of (data ?? []) as ArmedAlert[]) {
      // Send first, stamp second: a send failure leaves the row armed to retry
      // next cycle; a stamp failure risks one duplicate email, never a lost one.
      try {
        await sendEmail(apiKey, {
          to: alert.email,
          subject: "ราคาทองถึงเป้าหมายของคุณแล้ว - ราคาทองวันนี้",
          html: alertEmailHtml({ alert, barSell, fetchedAt, siteUrl }),
        });
      } catch (err) {
        stats.failed++;
        console.error(
          `[alerts] send failed for alert ${alert.id}:`,
          err instanceof Error ? err.message : err,
        );
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
  } catch (err) {
    console.error("[alerts] alert block failed:", err instanceof Error ? err.message : err);
  }
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
      .select("bar_buy, bar_sell, ornament_buy, ornament_sell")
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
      return new Response(
        JSON.stringify({ status: "skipped", reason: "unchanged", fetchedAt: fetchedAtIso }),
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

    // Only a genuinely new price can fire alerts; fireAlerts never throws.
    const alertStats = inserted
      ? await fireAlerts(supabase, barSell, fetchedAt)
      : undefined;

    return new Response(
      JSON.stringify({
        status: inserted ? "inserted" : "skipped",
        reason: inserted ? undefined : "duplicate fetched_at",
        fetchedAt: fetchedAtIso,
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
