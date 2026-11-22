import { changeWord, formatThaiChange, formatThaiPrice, formatThaiTime } from "@/lib/thai-date";
import type { ReportAnnouncement } from "@/lib/daily-report";

/**
 * Pure server-rendered table of one day's announcements, oldest first: GTA's
 * official number, the time, all four prices, and the change in ทองคำแท่ง
 * ขายออก against the announcement before it. Lines where GTA repeated the
 * previous prices are shown in grey with "คงเดิม" instead of a change.
 */
export function ReportAnnouncementTable({ announcements }: { announcements: ReportAnnouncement[] }) {
  return (
    // `relative` matters: the sr-only spans in the last column are absolutely
    // positioned, and without a positioned ancestor they escape this scroll
    // box and make the whole PAGE scroll sideways on phones (see MonthDailyTable).
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[620px] text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-800 dark:text-gray-400">
            <th scope="col" className="py-2 pr-2 font-medium">
              ครั้งที่
            </th>
            <th scope="col" className="py-2 pr-2 font-medium">
              เวลา
            </th>
            <th scope="col" className="py-2 pr-2 text-right font-medium">
              แท่ง รับซื้อ
            </th>
            <th scope="col" className="py-2 pr-2 text-right font-medium">
              แท่ง ขายออก
            </th>
            <th scope="col" className="py-2 pr-2 text-right font-medium">
              รูปพรรณ รับซื้อ
            </th>
            <th scope="col" className="py-2 pr-2 text-right font-medium">
              รูปพรรณ ขายออก
            </th>
            <th scope="col" className="py-2 text-right font-medium">
              เปลี่ยนแปลง
            </th>
          </tr>
        </thead>
        <tbody>
          {announcements.map((a) => {
            const colorClass =
              a.change === null || a.change === 0
                ? "text-gray-500 dark:text-gray-400"
                : a.change > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400";
            return (
              <tr
                key={a.time.toISOString()}
                className={`border-b border-gray-100 tabular-nums last:border-0 dark:border-gray-900 ${
                  a.unchanged ? "text-gray-500 dark:text-gray-400" : ""
                }`}
              >
                <td className="py-2 pr-2 font-medium text-gray-900 dark:text-gray-50">
                  {a.seq ?? "–"}
                </td>
                <td className="py-2 pr-2 text-gray-700 dark:text-gray-300">
                  {formatThaiTime(a.time)}
                </td>
                <td className="py-2 pr-2 text-right">{formatThaiPrice(a.barBuy)}</td>
                <td className="py-2 pr-2 text-right">{formatThaiPrice(a.barSell)}</td>
                <td className="py-2 pr-2 text-right">{formatThaiPrice(a.ornamentBuy)}</td>
                <td className="py-2 pr-2 text-right">{formatThaiPrice(a.ornamentSell)}</td>
                <td className={`py-2 text-right font-medium ${colorClass}`}>
                  {a.unchanged ? (
                    "คงเดิม"
                  ) : a.change === null ? (
                    "–"
                  ) : (
                    <>
                      <span className="sr-only">{changeWord(a.change)} </span>
                      {formatThaiChange(a.change)}
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
