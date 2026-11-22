import { formatThaiWholeNumber } from "@/lib/thai-date";
import { BAHT_TO_GRAM_BAR } from "@/lib/gold-weight";
import {
  PURITY_LEVELS,
  REFERENCE_PURITY,
  estimatePriceByPurity,
  pricePerGram,
} from "@/lib/purity";
import type { GoldPriceRow } from "@/lib/gold-price-queries";

/**
 * Pure server-rendered table: estimated prices by gold purity, worked out
 * from the latest official 96.5% bar price. Only the 96.5% row is an
 * announced price; the text underneath says so and shows the arithmetic.
 */
export function PurityPriceTable({ latest }: { latest: GoldPriceRow }) {
  const exampleSell = estimatePriceByPurity(latest.barSell, 90);

  return (
    <section aria-labelledby="purity-heading">
      <h2 id="purity-heading" className="text-xl font-bold text-gray-900 dark:text-gray-50">
        ราคาทองตามเปอร์เซ็นต์ (ประมาณการ)
      </h2>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        มูลค่าทองคำแต่ละเปอร์เซ็นต์โดยประมาณ คิดจากราคาทองคำแท่ง 96.5%
        ที่สมาคมค้าทองคำประกาศล่าสุด หน่วยเป็นบาท
      </p>

      {/* Sized to fit a phone without sideways scrolling (smaller text, two-line
          headers); `relative` + overflow-x-auto is only a safety net for very
          narrow screens (see MonthDailyTable for why `relative` matters). */}
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
                ขายออก
                <span className="block font-normal">บาทละ</span>
              </th>
              <th scope="col" className="py-2 pr-1 text-right font-medium">
                รับซื้อ
                <span className="block font-normal">กรัมละ</span>
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                ขายออก
                <span className="block font-normal">กรัมละ</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {PURITY_LEVELS.map((level) => {
              const isReference = level.percent === REFERENCE_PURITY;
              const buy = estimatePriceByPurity(latest.barBuy, level.percent);
              const sell = estimatePriceByPurity(latest.barSell, level.percent);
              return (
                <tr
                  key={level.percent}
                  className={`border-b border-gray-100 tabular-nums last:border-0 dark:border-gray-900 ${
                    isReference ? "bg-amber-50 dark:bg-amber-950/30" : ""
                  }`}
                >
                  <th
                    scope="row"
                    className="py-2 pr-1 text-left font-medium text-gray-900 dark:text-gray-50"
                  >
                    ทอง {level.percent}%
                    {(level.note || isReference) && (
                      <span className="block text-xs font-normal text-gray-500 dark:text-gray-400">
                        {level.note}
                        {isReference && " (ราคาประกาศ)"}
                      </span>
                    )}
                  </th>
                  <td className="py-2 pr-1 text-right">{formatThaiWholeNumber(buy)}</td>
                  <td className="py-2 pr-1 text-right">{formatThaiWholeNumber(sell)}</td>
                  <td className="py-2 pr-1 text-right">
                    {formatThaiWholeNumber(pricePerGram(buy))}
                  </td>
                  <td className="py-2 text-right">{formatThaiWholeNumber(pricePerGram(sell))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-col gap-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">ตัวเลขในตารางคิดอย่างไร</h3>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>
            แถวทอง 96.5% คือราคาทองคำแท่งรับซื้อและขายออกตามประกาศของสมาคมค้าทองคำโดยตรง
            ไม่ได้ผ่านการประมาณ
          </li>
          <li>
            เปอร์เซ็นต์อื่นคิดตามสัดส่วนเนื้อทอง คือนำราคาทอง 96.5% คูณด้วยเปอร์เซ็นต์ทองที่ต้องการ
            แล้วหารด้วย 96.5 เช่น ทอง 90% ขายออก = {formatThaiWholeNumber(latest.barSell)} × 90 ÷
            96.5 ≈ {formatThaiWholeNumber(exampleSell)} บาทต่อน้ำหนักทอง 1 บาท
          </li>
          <li>
            ราคาต่อกรัมได้จากการนำราคาต่อน้ำหนักทอง 1 บาท หารด้วย {BAHT_TO_GRAM_BAR}{" "}
            ซึ่งเป็นน้ำหนักเป็นกรัมของทองคำแท่ง 1 บาท เช่น {formatThaiWholeNumber(exampleSell)} ÷{" "}
            {BAHT_TO_GRAM_BAR} ≈ {formatThaiWholeNumber(pricePerGram(exampleSell))} บาทต่อกรัม
          </li>
        </ul>
        <p>
          <strong className="font-semibold text-gray-900 dark:text-gray-100">
            ตัวเลขเหล่านี้เป็นเพียงการประมาณการ ไม่ใช่ราคาประกาศ
          </strong>{" "}
          (ยกเว้นแถว 96.5%) เป็นการประเมินมูลค่าเนื้อทองเท่านั้น
          ร้านทองและโรงหลอมแต่ละแห่งอาจรับซื้อหรือขายในราคาที่ต่างจากนี้
          โดยเฉพาะทองเปอร์เซ็นต์ต่ำซึ่งมักถูกหักค่าหลอม ค่าตรวจสอบเนื้อทอง และส่วนต่างของร้าน
          เงินที่ได้รับจริงจึงมักน้อยกว่าตัวเลขในตาราง ควรสอบถามราคาจากร้านก่อนซื้อขายทุกครั้ง
        </p>
      </div>
    </section>
  );
}
