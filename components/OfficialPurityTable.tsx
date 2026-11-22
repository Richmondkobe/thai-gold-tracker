import { formatThaiDateCompact, formatThaiPrice, formatThaiTime } from "@/lib/thai-date";
import { BAHT_TO_GRAM_ORNAMENT } from "@/lib/gold-weight";
import { REFERENCE_PURITY } from "@/lib/purity";
import type { OfficialPurityBuy } from "@/lib/gold-price-queries";

/** "90", "45", "103.6" - at most one decimal, none when it is a whole number. */
function formatShare(value: number): string {
  return String(Math.round(value * 10) / 10);
}

/**
 * Pure server-rendered table of the buy prices GTA itself announces for
 * ornament gold of each purity (tax base, per baht-weight and per gram).
 * Unlike PurityPriceTable underneath it, nothing here is estimated: every
 * figure is stored from GTA's feed (gold_prices.ornament_buy_*, migration
 * 0011), and the 96.5% row is the same ทองรูปพรรณ รับซื้อ (ฐานภาษี) the price
 * card shows. Per gram is per baht-weight / 15.16, which reproduces GTA's own
 * per-gram figure exactly.
 *
 * Renders nothing when the row has no official purity prices (rows stored
 * before the migration), so the page never shows an empty table.
 *
 * Used on the homepage (the current price, default wording) and on the daily
 * report pages (a day's closing price): `intro` replaces the sentence under
 * the heading, and `estimateTableBelow` says whether PurityPriceTable follows.
 */
export function OfficialPurityTable({
  latest,
  intro,
  estimateTableBelow = true,
}: {
  /** Structurally satisfied by LatestGoldPriceRow. */
  latest: { ornamentBuy: number; officialPurityBuy: OfficialPurityBuy | null; announcedAt: Date };
  intro?: string;
  estimateTableBelow?: boolean;
}) {
  const official = latest.officialPurityBuy;
  if (!official) return null;

  const rows = [
    { percent: 99.99, note: "ทองคำบริสุทธิ์ 24K", buy: official.buy9999 },
    { percent: REFERENCE_PURITY, note: "มาตรฐานทองไทย", buy: latest.ornamentBuy },
    { percent: 90, note: undefined, buy: official.buy90 },
    { percent: 80, note: undefined, buy: official.buy80 },
    { percent: 50, note: "ทอง 12K", buy: official.buy50 },
    { percent: 40, note: undefined, buy: official.buy40 },
  ].filter((row): row is { percent: number; note: string | undefined; buy: number } => row.buy !== null);

  const share = (buy: number) => (buy / latest.ornamentBuy) * 100;

  return (
    <section aria-labelledby="official-purity-heading">
      <h2
        id="official-purity-heading"
        className="text-xl font-bold text-gray-900 dark:text-gray-50"
      >
        ราคารับซื้อทองตามเปอร์เซ็นต์ ตามประกาศสมาคมค้าทองคำ
      </h2>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {intro ??
          `ราคารับซื้อทองรูปพรรณ (ฐานภาษี) แต่ละเปอร์เซ็นต์ที่สมาคมค้าทองคำประกาศล่าสุด เมื่อ ${formatThaiDateCompact(latest.announcedAt)} เวลา ${formatThaiTime(latest.announcedAt)} หน่วยเป็นบาท`}
      </p>

      {/* Same sizing approach as PurityPriceTable: fits a phone without
          sideways scrolling; overflow-x-auto is only a safety net. */}
      <div className="relative mt-3 overflow-x-auto">
        <table className="w-full text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left align-bottom text-gray-500 dark:border-gray-800 dark:text-gray-400">
              <th scope="col" className="py-2 pr-1 font-medium">
                เปอร์เซ็นต์ทอง
              </th>
              <th scope="col" className="py-2 pr-1 text-right font-medium">
                รับซื้อ
                <span className="block font-normal">บาทละ</span>
              </th>
              <th scope="col" className="py-2 pr-1 text-right font-medium">
                รับซื้อ
                <span className="block font-normal">กรัมละ</span>
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                เทียบกับ
                <span className="block font-normal">ทอง {REFERENCE_PURITY}%</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.percent}
                className={`border-b border-gray-100 tabular-nums last:border-0 dark:border-gray-900 ${
                  row.percent === REFERENCE_PURITY ? "bg-amber-50 dark:bg-amber-950/30" : ""
                }`}
              >
                <th
                  scope="row"
                  className="py-2 pr-1 text-left font-medium text-gray-900 dark:text-gray-50"
                >
                  ทอง {row.percent}%
                  {row.note && (
                    <span className="block text-xs font-normal text-gray-500 dark:text-gray-400">
                      {row.note}
                    </span>
                  )}
                </th>
                <td className="py-2 pr-1 text-right">{formatThaiPrice(row.buy)}</td>
                <td className="py-2 pr-1 text-right">
                  {formatThaiPrice(row.buy / BAHT_TO_GRAM_ORNAMENT)}
                </td>
                <td className="py-2 text-right">{formatShare(share(row.buy))}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="mt-3 flex list-disc flex-col gap-1 pl-5 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
        <li>
          ทุกตัวเลขในตารางนี้เป็นราคาที่สมาคมค้าทองคำประกาศ ไม่ใช่การประมาณการ
          เป็นราคารับซื้อทองรูปพรรณ (ฐานภาษี) ต่อน้ำหนักทอง 1 บาท และราคาต่อกรัมคิดจากทองรูปพรรณ 1
          บาท หนัก {BAHT_TO_GRAM_ORNAMENT} กรัม
        </li>
        <li>
          คอลัมน์สุดท้ายแสดงว่าราคาของทองแต่ละเปอร์เซ็นต์คิดเป็นร้อยละเท่าใดของราคารับซื้อทอง{" "}
          {REFERENCE_PURITY}% ซึ่งไม่ได้เท่ากับสัดส่วนเนื้อทองเสมอไป
          {official.buy50 !== null &&
            ` เช่น ทอง 50% สมาคมประกาศรับซื้อที่ร้อยละ ${formatShare(share(official.buy50))} ของราคาทอง ${REFERENCE_PURITY}%`}
        </li>
        <li>
          สมาคมค้าทองคำไม่ได้ประกาศราคาขายออกของทองเปอร์เซ็นต์อื่น และไม่มีราคาสำหรับทอง 75% (18K)
          {estimateTableBelow && " ดูมูลค่าโดยประมาณได้จากตารางถัดไป"}
        </li>
        <li>
          ร้านทองแต่ละแห่งอาจรับซื้อในราคาที่ต่างจากราคาประกาศ ควรสอบถามราคาจากร้านก่อนขายทุกครั้ง
        </li>
      </ul>
    </section>
  );
}
