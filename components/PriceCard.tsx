import {
  formatThaiDateLong,
  formatThaiPrice,
  formatThaiTime,
  getMarketStatus,
} from "@/lib/thai-date";
import { ChangeIndicator } from "@/components/ChangeIndicator";
import type { DailyGoldPriceRow, GoldPriceRow } from "@/lib/gold-price-queries";

export function PriceCard({
  latest,
  previous,
  yesterday,
  emphasis = "bar",
}: {
  latest: GoldPriceRow;
  previous: GoldPriceRow | null;
  yesterday: DailyGoldPriceRow | null;
  /** Which price headlines the card (the rest are always shown below regardless). */
  emphasis?: "bar" | "ornament";
}) {
  const headlineLabel =
    emphasis === "ornament" ? "ทองรูปพรรณ 96.5% ขายออก" : "ทองคำแท่ง 96.5% ขายออก";
  const headlineValue = emphasis === "ornament" ? latest.ornamentSell : latest.barSell;
  const previousValue = previous
    ? emphasis === "ornament"
      ? previous.ornamentSell
      : previous.barSell
    : null;
  const yesterdayValue = yesterday
    ? emphasis === "ornament"
      ? yesterday.ornamentSell
      : yesterday.barSell
    : null;

  const vsPrevious = previousValue !== null ? headlineValue - previousValue : null;
  const vsYesterday = yesterdayValue !== null ? headlineValue - yesterdayValue : null;
  const { isToday } = getMarketStatus(latest.fetchedAt);

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{headlineLabel}</p>
          <p className="text-4xl font-bold tabular-nums text-gray-900 dark:text-gray-50 sm:text-5xl">
            {formatThaiPrice(headlineValue)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">บาทละ (THB)</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {vsPrevious !== null && (
            <ChangeIndicator value={vsPrevious} label="เทียบกับประกาศก่อนหน้า" />
          )}
          {vsYesterday !== null && (
            <ChangeIndicator value={vsYesterday} label="เทียบกับเมื่อวาน" />
          )}
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <PriceCell label="ทองคำแท่ง รับซื้อ" value={latest.barBuy} />
        <PriceCell label="ทองคำแท่ง ขายออก" value={latest.barSell} />
        <PriceCell label="ทองรูปพรรณ รับซื้อ (ฐานภาษี)" value={latest.ornamentBuy} />
        <PriceCell label="ทองรูปพรรณ ขายออก" value={latest.ornamentSell} />
      </dl>

      {isToday ? (
        <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
          อัปเดตล่าสุด {formatThaiTime(latest.fetchedAt)}
        </p>
      ) : (
        <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
          <p className="font-medium">ตลาดปิด</p>
          <p>
            ราคาล่าสุดจากประกาศ{formatThaiDateLong(latest.fetchedAt)} เวลา{" "}
            {formatThaiTime(latest.fetchedAt)}
          </p>
        </div>
      )}
    </section>
  );
}

function PriceCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
      <dt className="text-xs text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums text-gray-900 dark:text-gray-50">
        {formatThaiPrice(value)}
      </dd>
    </div>
  );
}
