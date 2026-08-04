import { formatThaiDateShort, formatThaiPrice } from "@/lib/thai-date";
import type { DailyGoldPriceRow } from "@/lib/gold-price-queries";

const WIDTH = 600;
const HEIGHT = 220;
const PADDING_X = 8;
const PADDING_TOP = 16;
const PADDING_BOTTOM = 28;

/** Pure server-rendered inline SVG line chart — no client JS, no charting library. */
export function PriceChart({
  rows,
  title,
  metric = "barSell",
}: {
  rows: DailyGoldPriceRow[];
  title: string;
  metric?: "barSell" | "ornamentSell";
}) {
  if (rows.length < 2) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        ยังไม่มีข้อมูลย้อนหลังเพียงพอสำหรับแสดงกราฟ
      </p>
    );
  }

  const value = (row: DailyGoldPriceRow) => row[metric];
  const prices = rows.map(value);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  const plotHeight = HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  const plotWidth = WIDTH - PADDING_X * 2;

  const points = rows.map((row, i) => {
    const x = PADDING_X + (i / (rows.length - 1)) * plotWidth;
    const y = PADDING_TOP + plotHeight - ((value(row) - min) / range) * plotHeight;
    return { x, y, row };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1].x.toFixed(1)},${HEIGHT - PADDING_BOTTOM} L${points[0].x.toFixed(1)},${HEIGHT - PADDING_BOTTOM} Z`;

  const first = rows[0];
  const last = rows[rows.length - 1];

  return (
    <figure>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`${title}: จาก ${formatThaiPrice(value(first))} เมื่อ ${formatThaiDateShort(first.fetchedAt)} ถึง ${formatThaiPrice(value(last))} เมื่อ ${formatThaiDateShort(last.fetchedAt)} บาทต่อบาททองคำ`}
        className="w-full text-amber-500 dark:text-amber-400"
      >
        <path d={areaPath} fill="currentColor" opacity="0.12" stroke="none" />
        <path d={linePath} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <text
          x={PADDING_X}
          y={HEIGHT - 8}
          fontSize="11"
          className="fill-gray-500 dark:fill-gray-400"
        >
          {formatThaiDateShort(first.fetchedAt)}
        </text>
        <text
          x={WIDTH - PADDING_X}
          y={HEIGHT - 8}
          fontSize="11"
          textAnchor="end"
          className="fill-gray-500 dark:fill-gray-400"
        >
          {formatThaiDateShort(last.fetchedAt)}
        </text>
      </svg>
      <figcaption className="mt-2 flex justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>ต่ำสุด {formatThaiPrice(min)}</span>
        <span>สูงสุด {formatThaiPrice(max)}</span>
      </figcaption>
    </figure>
  );
}
