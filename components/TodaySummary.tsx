import {
  formatThaiDateCompact,
  formatThaiPrice,
  formatThaiTime,
  getMarketStatus,
} from "@/lib/thai-date";
import type { GoldPriceRow, LatestGoldPriceRow } from "@/lib/gold-price-queries";

/**
 * Pure server-rendered summary of today so far (ทองคำแท่ง ขายออก): how many
 * times the price has changed, today's high and low, and when it last
 * changed.
 *
 * "Changes" are the rows stored today. GTA numbers its announcements
 * officially (ประกาศครั้งที่ N), but that number is not stored, and on a very
 * busy day the 2-minute poll can miss announcements that come closer
 * together - so this is labelled as recorded changes, never as the official
 * announcement number.
 */
export function TodaySummary({
  intraday,
  latest,
}: {
  /** Today's stored price rows (Bangkok day), oldest first. */
  intraday: GoldPriceRow[];
  latest: LatestGoldPriceRow;
}) {
  const prices = intraday.length > 0 ? intraday.map((row) => row.barSell) : [latest.barSell];
  const high = Math.max(...prices);
  const low = Math.min(...prices);
  const changedToday = getMarketStatus(latest.fetchedAt).isToday;

  return (
    <section aria-labelledby="today-summary-heading">
      <h2
        id="today-summary-heading"
        className="text-xl font-bold text-gray-900 dark:text-gray-50"
      >
        สรุปราคาทองวันนี้
      </h2>
      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCell label="เปลี่ยนราคาวันนี้" value={`${intraday.length} ครั้ง`} />
        <SummaryCell label="สูงสุดวันนี้" value={formatThaiPrice(high)} />
        <SummaryCell label="ต่ำสุดวันนี้" value={formatThaiPrice(low)} />
        <SummaryCell
          label="เปลี่ยนราคาล่าสุด"
          value={
            changedToday
              ? formatThaiTime(latest.fetchedAt)
              : `${formatThaiDateCompact(latest.fetchedAt)} ${formatThaiTime(latest.fetchedAt)}`
          }
        />
      </dl>
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        ราคาทองคำแท่งขายออก บาทละ
        {intraday.length === 0 &&
          " วันนี้ราคายังไม่เปลี่ยนแปลง ค่าสูงสุดและต่ำสุดจึงเท่ากับราคาล่าสุด"}{" "}
        จำนวนครั้งนับจากการเปลี่ยนราคาที่ระบบบันทึกได้
        ซึ่งอาจน้อยกว่าจำนวนประกาศของสมาคมค้าทองคำในวันที่ราคาปรับถี่มาก
      </p>
    </section>
  );
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
      <dt className="text-xs text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="mt-1 text-base font-semibold tabular-nums text-gray-900 dark:text-gray-50">
        {value}
      </dd>
    </div>
  );
}
