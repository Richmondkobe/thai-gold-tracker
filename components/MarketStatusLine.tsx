import { formatThaiDateLong, formatThaiTime, getMarketStatus } from "@/lib/thai-date";

/** "อัปเดตล่าสุด HH:mm น." when the announcement is from today (Bangkok),
 *  otherwise a ตลาดปิด label with the full date/time of the last announcement. */
export function MarketStatusLine({ fetchedAt }: { fetchedAt: Date }) {
  const { isToday } = getMarketStatus(fetchedAt);

  if (isToday) {
    return (
      <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
        อัปเดตล่าสุด {formatThaiTime(fetchedAt)}
      </p>
    );
  }

  return (
    <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
      <p className="font-medium">ตลาดปิด</p>
      <p>
        ราคาล่าสุดจากประกาศ{formatThaiDateLong(fetchedAt)} เวลา{" "}
        {formatThaiTime(fetchedAt)}
      </p>
    </div>
  );
}
