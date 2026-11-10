import { formatThaiDateLong, formatThaiTime, getMarketStatus } from "@/lib/thai-date";

/** "อัปเดตล่าสุด HH:mm น." when the announcement is from today (Bangkok),
 *  otherwise a ตลาดปิด label with the full date/time of the last announcement.
 *  Pass LatestGoldPriceRow.announcedAt - the latest official announcement
 *  time, which can be later than when the price last changed. */
export function MarketStatusLine({ announcedAt }: { announcedAt: Date }) {
  const { isToday } = getMarketStatus(announcedAt);

  if (isToday) {
    return (
      <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
        อัปเดตล่าสุด {formatThaiTime(announcedAt)}
      </p>
    );
  }

  return (
    <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
      <p className="font-medium">ตลาดปิด</p>
      <p>
        ราคาล่าสุดจากประกาศ{formatThaiDateLong(announcedAt)} เวลา{" "}
        {formatThaiTime(announcedAt)}
      </p>
    </div>
  );
}
