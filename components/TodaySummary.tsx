import {
  formatThaiDateCompact,
  formatThaiPrice,
  formatThaiTime,
  getMarketStatus,
} from "@/lib/thai-date";
import type { GoldPriceRow, LatestGoldPriceRow } from "@/lib/gold-price-queries";

/**
 * Pure server-rendered summary of today so far (ทองคำแท่ง ขายออก): GTA's latest
 * announcement number, today's high and low, and when the price last changed.
 *
 * "ประกาศครั้งที่ N" is GTA's own number for its latest announcement today
 * (LatestGoldPriceRow.announcementSeq, migration 0011). It is not the number
 * of rows stored today: an announcement that repeats the previous prices is
 * numbered by GTA but never becomes a row, so the count of price changes is
 * shown separately and can be lower.
 *
 * When the number is unknown (no announcement yet today, or the row predates
 * the migration) this falls back to counting the rows stored today, labelled
 * as recorded price changes and never as the official number.
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
  // Only a number that belongs to TODAY's latest announcement is shown.
  const officialSeq = getMarketStatus(latest.announcedAt).isToday ? latest.announcementSeq : null;
  const changes = intraday.length;

  return (
    <section aria-labelledby="today-summary-heading">
      <h2
        id="today-summary-heading"
        className="text-xl font-bold text-gray-900 dark:text-gray-50"
      >
        สรุปราคาทองวันนี้
      </h2>
      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {officialSeq !== null ? (
          <SummaryCell label="ประกาศล่าสุดวันนี้" value={`ครั้งที่ ${officialSeq}`} />
        ) : (
          <SummaryCell label="เปลี่ยนราคาวันนี้" value={`${changes} ครั้ง`} />
        )}
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
        ราคาทองคำแท่งขายออก บาทละ{" "}
        {officialSeq !== null ? (
          <>
            วันนี้สมาคมค้าทองคำประกาศราคาทองแล้ว {officialSeq} ครั้ง ประกาศครั้งที่ {officialSeq}{" "}
            เป็นครั้งล่าสุด
            {changes === 0
              ? " โดยราคายังไม่เปลี่ยนแปลงจากประกาศครั้งก่อน ค่าสูงสุดและต่ำสุดจึงเท่ากับราคาล่าสุด"
              : // More rows than announcements would mean a row GTA has since
                // withdrawn; say nothing rather than print a contradiction.
                changes <= officialSeq && ` โดยราคาเปลี่ยนแปลง ${changes} ครั้ง`}
          </>
        ) : (
          <>
            {changes === 0 && "วันนี้ราคายังไม่เปลี่ยนแปลง ค่าสูงสุดและต่ำสุดจึงเท่ากับราคาล่าสุด "}
            จำนวนครั้งนับจากการเปลี่ยนราคาที่ระบบบันทึกได้
            ซึ่งอาจต่างจากจำนวนประกาศของสมาคมค้าทองคำ
          </>
        )}
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
