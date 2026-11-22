import { addDays, toBangkokDateString } from "@/lib/bangkok";
import {
  getDailyCloseOnOrBefore,
  getLatestPrices,
  type LatestGoldPriceRow,
} from "@/lib/gold-price-queries";
import {
  formatThaiAmount,
  formatThaiDateCompact,
  formatThaiPrice,
  formatThaiTime,
} from "@/lib/thai-date";
import { SITE_URL } from "@/lib/site";
import { WIDGET_BRAND, parseWidgetVariant, type WidgetSize, type WidgetTheme } from "@/lib/widget";

// The document inside the embeddable widget's iframe, e.g.
// /embed/gold-price/sidebar-light. Other websites load this, so it is built to
// be as small and as harmless as a page can be:
//
//   - A Route Handler returning one hand-written HTML string, not a page: no
//     root layout (site header/footer, web font), no React, no Next runtime.
//     About 4 KB, one request, system fonts.
//   - No JavaScript at all, no images, no external resources, no cookies, no
//     tracking. The Content-Security-Policy below enforces that rather than
//     promising it.
//   - Cached at the CDN for 60 seconds and NOT served stale after that: a
//     price widget on a quiet blog must not show this morning's price to the
//     first visitor of the afternoon, which is what ISR's
//     stale-while-revalidate would do. So this is a dynamic handler with a
//     plain s-maxage, and a cache miss costs two small reads.
//   - It reloads itself every 5 minutes (meta refresh), so a page left open
//     keeps following GTA's announcements without any script.
//
// Layout follows the iframe's own size, not the host page: the card layout
// for the sidebar and mobile sizes, a single row for the banner, and a dense
// two-row version of the banner when it has been squeezed below 660px wide.
// Every variant shows all four prices - never a partial card.
//
// The price fetcher is not involved: this only reads gold_prices.

export const dynamic = "force-dynamic";

const CACHE_SECONDS = 60;
const REFRESH_SECONDS = 300;

interface WidgetData {
  latest: LatestGoldPriceRow;
  /** ทองคำแท่ง ขายออก against the price before it; null when there is none. */
  vsPrevious: number | null;
  /** ...and against the last daily close before today; null when there is none. */
  vsDayBefore: number | null;
}

async function loadWidgetData(): Promise<WidgetData | null> {
  try {
    const yesterday = toBangkokDateString(addDays(new Date(), -1));
    const [rows, dayBefore] = await Promise.all([
      getLatestPrices(2),
      // Decorative: the widget still shows prices if this one read fails.
      getDailyCloseOnOrBefore(yesterday).catch(() => null),
    ]);
    const [latest, previous] = rows;
    if (!latest) return null;
    return {
      latest,
      vsPrevious: previous ? latest.barSell - previous.barSell : null,
      vsDayBefore: dayBefore ? latest.barSell - dayBefore.barSell : null,
    };
  } catch (err) {
    console.error("[widget] failed to load prices:", err instanceof Error ? err.message : err);
    return null;
  }
}

const PALETTE: Record<WidgetTheme, string> = {
  light:
    "--bg:#ffffff;--fg:#111827;--mut:#6b7280;--bd:#e5e7eb;--cell:#f9fafb;--ac:#b45309;--up:#047857;--dn:#b91c1c",
  dark:
    "--bg:#111827;--fg:#f9fafb;--mut:#9ca3af;--bd:#374151;--cell:#1f2937;--ac:#fbbf24;--up:#34d399;--dn:#f87171",
};

// Sizes in px throughout (no rem): the host page's settings never leak into an
// iframe, but px keeps the fixed-height layouts exact.
//
// Three layouts, chosen by the iframe's own size:
//   card ............. sidebar and mobile sizes: header, 2x2 price cells,
//                      the two changes, the announcement line. Below 280px
//                      wide (a 300px widget in a 250px sidebar) the type
//                      steps down so nothing is cut off; tested to 230px.
//   banner, >= 660px . header with the changes beside it, the four price
//                      cells in one row, the announcement line.
//   banner, < 660px .. the banner squeezed into a narrow column: the cells
//                      are replaced by a compact 2x2 table (.tb) with short
//                      wording (.ls instead of .lf), so all four prices stay
//                      readable in the same fixed height.
// The prices are therefore in the document twice (.g and .tb); exactly one of
// the two is displayed in any layout.
const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%}
body{font-family:system-ui,-apple-system,"Segoe UI","Noto Sans Thai","Leelawadee UI",Thonburi,Tahoma,sans-serif;font-size:13px;line-height:1.35;color:var(--fg);background:var(--bg);-webkit-text-size-adjust:100%;text-size-adjust:100%}
a{color:inherit;text-decoration:none}
i{font-style:normal}
.w{height:100%;display:flex;flex-direction:column;justify-content:space-between;gap:6px;padding:12px 14px;border:1px solid var(--bd);border-radius:12px;overflow:hidden}
.hd{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
.t{font-size:15px;font-weight:700;white-space:nowrap}
.u{font-size:11px;font-weight:400;color:var(--mut)}
.br{font-size:11px;font-weight:600;color:var(--ac);white-space:nowrap}
.g{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.c{background:var(--cell);border-radius:8px;padding:6px 8px;min-width:0}
.l{display:block;font-size:11px;color:var(--mut);white-space:nowrap}
.p{display:block;font-size:17px;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}
.tb,.ls{display:none}
.ch{font-size:12px;color:var(--mut)}
.ch span{display:block}
.ch b{font-weight:600}
.up{color:var(--up)}.dn{color:var(--dn)}
.m{font-size:11px;color:var(--mut)}
.m span{display:block}
.e{margin:auto;text-align:center;font-size:13px;color:var(--mut)}
.e a{color:var(--ac);font-weight:600}
@media (max-width:279px){
.card .w{padding:10px}
.card .t{font-size:14px}
.card .u{display:none}
.card .g{gap:4px}
.card .c{padding:5px 6px}
.card .l{font-size:10px}
.card .p{font-size:14px}
.card .ch{font-size:11px}
.card .m{font-size:10px}
}
.banner .w{display:grid;grid-template-columns:auto 1fr;grid-template-areas:"hd ch" "g g" "m m";align-content:space-between;gap:4px 16px;padding:8px 14px}
.banner .hd{grid-area:hd;justify-content:flex-start;gap:10px}
.banner .ch{grid-area:ch;justify-self:end;text-align:right;white-space:nowrap;min-width:0;max-width:100%;overflow:hidden;text-overflow:ellipsis}
.banner .g{grid-area:g;grid-template-columns:repeat(4,1fr)}
.banner .c{padding:5px 10px}
.banner .p{font-size:16px}
.banner .m{grid-area:m}
.banner .ch span,.banner .m span{display:inline}
.banner .ch span+span:before,.banner .m span+span:before{content:" · "}
.banner .e{grid-column:1/-1}
@media (max-width:659px){
.banner .w{grid-template-columns:1fr;grid-template-areas:"hd" "tb" "ch" "m";gap:3px;padding:7px 10px}
.banner .hd{justify-content:space-between}
.banner .t{font-size:14px}
.banner .g{display:none}
.banner .tb{grid-area:tb;display:grid;grid-template-columns:auto 1fr 1fr;gap:1px 10px;align-items:baseline;font-variant-numeric:tabular-nums}
.banner .tb span{white-space:nowrap}
.banner .tb .h{font-size:10px;color:var(--mut);text-align:right}
.banner .tb .r{font-size:11px;color:var(--mut)}
.banner .tb .v{font-size:14px;font-weight:700;text-align:right}
.banner .ch{justify-self:start;text-align:left;font-size:11px;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.banner .lf{display:none}
.banner .ls{display:inline}
.banner .m{font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.banner .m span+span{display:none}
}
`.replace(/\n/g, "");

/** "▼ 450" in the right colour, or "ไม่เปลี่ยนแปลง" for zero. */
function changeHtml(value: number): string {
  if (value === 0) return "<b>ไม่เปลี่ยนแปลง</b>";
  const up = value > 0;
  return `<b class="${up ? "up" : "dn"}">${up ? "▲" : "▼"} ${formatThaiAmount(Math.abs(value))}</b>`;
}

/** Text with a long form and a short one for the narrow banner. */
function wording(long: string, short: string): string {
  return `<i class="lf">${long}</i><i class="ls">${short}</i>`;
}

function cell(label: string, value: number): string {
  return `<div class="c"><span class="l">${label}</span><span class="p">${formatThaiPrice(value)}</span></div>`;
}

function bodyHtml(data: WidgetData | null): string {
  const home = `${SITE_URL}/`;

  if (!data) {
    return (
      `<div class="w"><p class="e">ขณะนี้ไม่สามารถแสดงราคาทองได้<br>` +
      `<a href="${home}" target="_blank" rel="noopener">ดูราคาทองวันนี้ที่ ${WIDGET_BRAND}</a></p></div>`
    );
  }

  const { latest, vsPrevious, vsDayBefore } = data;
  const when = `${formatThaiDateCompact(latest.announcedAt)} เวลา ${formatThaiTime(latest.announcedAt)}`;
  // The number belongs to the announcement at announcedAt, so it is always
  // printed together with that announcement's date.
  const announcement =
    latest.announcementSeq !== null
      ? `ประกาศครั้งที่ ${latest.announcementSeq} · ${when}`
      : `ประกาศล่าสุด ${when}`;

  const changes = [
    // "ราคาก่อนหน้า", not "ประกาศก่อนหน้า": when the latest announcement only
    // repeated the price, the previous announcement had this same price.
    vsPrevious !== null
      ? `<span>${changeHtml(vsPrevious)} ${wording("จากราคาก่อนหน้า", "จากราคาก่อน")}</span>`
      : "",
    vsDayBefore !== null
      ? `<span>${changeHtml(vsDayBefore)} ${wording("จากราคาปิดวันก่อน", "จากวันก่อน")}</span>`
      : "",
  ].join("");

  const price = (value: number) => `<span class="v">${formatThaiPrice(value)}</span>`;

  return (
    `<div class="w">` +
    `<div class="hd"><p class="t">ราคาทองวันนี้ <span class="u">บาทละ</span></p>` +
    `<a class="br" href="${home}" target="_blank" rel="noopener">${WIDGET_BRAND}</a></div>` +
    `<div class="g">` +
    cell("ทองคำแท่ง รับซื้อ", latest.barBuy) +
    cell("ทองคำแท่ง ขายออก", latest.barSell) +
    cell("ทองรูปพรรณ รับซื้อ", latest.ornamentBuy) +
    cell("ทองรูปพรรณ ขายออก", latest.ornamentSell) +
    `</div>` +
    `<div class="tb"><span></span><span class="h">รับซื้อ</span><span class="h">ขายออก</span>` +
    `<span class="r">ทองคำแท่ง</span>${price(latest.barBuy)}${price(latest.barSell)}` +
    `<span class="r">ทองรูปพรรณ</span>${price(latest.ornamentBuy)}${price(latest.ornamentSell)}</div>` +
    (changes ? `<p class="ch" title="ทองคำแท่งขายออก">${changes}</p>` : "") +
    `<p class="m"><span>${announcement}</span><span>ที่มา สมาคมค้าทองคำ</span></p>` +
    `</div>`
  );
}

function documentHtml(size: WidgetSize, theme: WidgetTheme, data: WidgetData | null): string {
  const layout = size === "banner" ? "banner" : "card";
  return (
    `<!doctype html><html lang="th"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<meta name="robots" content="noindex">` +
    `<meta http-equiv="refresh" content="${REFRESH_SECONDS}">` +
    `<title>ราคาทองวันนี้ - ${WIDGET_BRAND}</title>` +
    `<style>:root{${PALETTE[theme]}}${CSS}</style></head>` +
    `<body class="${layout}">${bodyHtml(data)}</body></html>`
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ variant: string }> },
): Promise<Response> {
  const { variant } = await params;
  const parsed = parseWidgetVariant(variant);
  if (!parsed) {
    return new Response("Not found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex" },
    });
  }

  const data = await loadWidgetData();

  return new Response(documentHtml(parsed.size, parsed.theme, data), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Browser and CDN both keep it for a minute; a failed load is retried sooner.
      "Cache-Control": data
        ? `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}`
        : "public, max-age=15, s-maxage=15",
      // Nothing but inline CSS may load or run, and any site may frame it.
      "Content-Security-Policy":
        "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors *; base-uri 'none'; form-action 'none'",
      // The widget is a fragment of other people's pages, not a page of ours.
      "X-Robots-Tag": "noindex",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
