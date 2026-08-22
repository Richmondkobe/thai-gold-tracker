// Thai Gold Traders Association (สมาคมค้าทองคำ) has no official public API.
// Their homepage (Next.js, goldtraders.or.th) fetches prices client-side from
// these internal, undocumented JSON endpoints. Verified 2026-08-04: a plain
// server-to-server request (no cookies, no browser) returns clean JSON with
// no Cloudflare challenge. This can change without notice — if it starts
// returning HTML, a 403, or a differently-shaped JSON body, the sanity
// checks below will throw and the cron route will fail loudly (500 + log)
// instead of inserting bad data.
const LATEST_URL =
  "https://www.goldtraders.or.th/api/GoldPrices/Latest?readjson=false";

export const MIN_SANE_PRICE = 10_000;
export const MAX_SANE_PRICE = 100_000;

export class GoldPriceFetchError extends Error {}

export interface GoldPriceSnapshot {
  /** When GTA published this update (source's local Bangkok time, converted to an absolute instant). */
  fetchedAt: Date;
  barBuy: number;
  barSell: number;
  ornamentBuy: number;
  ornamentSell: number;
}

/** Shared with scripts/backfill-history.ts, which hits a different GTA endpoint with the same field shape. */
export function isSanePrice(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > MIN_SANE_PRICE &&
    value < MAX_SANE_PRICE
  );
}

/** GTA's `asTime` field has no timezone suffix (e.g. "2026-08-04T16:15:00") and is Bangkok local time. */
export function parseBangkokTime(asTime: unknown): Date | null {
  if (typeof asTime !== "string") return null;
  const date = new Date(`${asTime}+07:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function fetchLatestGoldPrice(): Promise<GoldPriceSnapshot> {
  let response: Response;
  try {
    response = await fetch(LATEST_URL, {
      headers: {
        accept: "application/json",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        referer: "https://www.goldtraders.or.th/",
      },
      cache: "no-store",
    });
  } catch (err) {
    throw new GoldPriceFetchError(
      `network error fetching goldtraders API: ${(err as Error).message}`,
    );
  }

  if (!response.ok) {
    const cfRay = response.headers.get("cf-ray");
    const server = response.headers.get("server");
    const bodySnippet = (await response.text().catch(() => "")).slice(0, 300);
    throw new GoldPriceFetchError(
      `goldtraders API returned HTTP ${response.status} (server=${server}, cf-ray=${cfRay}): ${bodySnippet}`,
    );
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new GoldPriceFetchError(
      "goldtraders API returned a non-JSON body (endpoint shape may have changed)",
    );
  }

  if (typeof data !== "object" || data === null) {
    throw new GoldPriceFetchError("goldtraders API returned an unexpected shape");
  }

  const raw = data as Record<string, unknown>;
  const barBuy = raw.bL_BuyPrice;
  const barSell = raw.bL_SellPrice;
  const ornamentBuy = raw.oM965_BuyPrice;
  const ornamentSell = raw.oM965_SellPrice;

  const prices = { barBuy, barSell, ornamentBuy, ornamentSell };
  const invalid = Object.entries(prices).filter(([, v]) => !isSanePrice(v));
  if (invalid.length > 0) {
    throw new GoldPriceFetchError(
      `parsed prices failed sanity check (expected ${MIN_SANE_PRICE}-${MAX_SANE_PRICE}): ${JSON.stringify(prices)}`,
    );
  }

  const fetchedAt = parseBangkokTime(raw.asTime);
  if (!fetchedAt) {
    throw new GoldPriceFetchError(
      `goldtraders API response missing/invalid asTime: ${JSON.stringify(raw.asTime)}`,
    );
  }

  return {
    fetchedAt,
    barBuy: barBuy as number,
    barSell: barSell as number,
    ornamentBuy: ornamentBuy as number,
    ornamentSell: ornamentSell as number,
  };
}
