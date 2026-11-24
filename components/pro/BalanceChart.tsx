"use client";

import { useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { formatBahtWhole, formatDateString } from "@/lib/pro/format";

// Line chart of account balances over time, for /pro/backtest.
//
// The lines are an SVG stretched to the box (non-scaling strokes), while every
// piece of text is ordinary HTML positioned by percentage - so labels stay a
// readable size on a phone instead of shrinking with the drawing.
// Hover, touch or the arrow keys move a crosshair that reads out every line
// at that date. The same numbers are in the results table on the page.

export type ChartColor = "blue" | "orange" | "aqua" | "yellow";

export interface ChartSeries {
  name: string;
  color: ChartColor;
  /** One balance per entry of `dates`. */
  values: number[];
}

// Fixed colour per strategy everywhere on the page (light / dark steps of the
// same hues; checked for colour-blind separation as a set).
const COLOR_CLASSES: Record<ChartColor, { stroke: string; bg: string }> = {
  blue: { stroke: "stroke-[#2a78d6] dark:stroke-[#3987e5]", bg: "bg-[#2a78d6] dark:bg-[#3987e5]" },
  orange: { stroke: "stroke-[#eb6834] dark:stroke-[#d95926]", bg: "bg-[#eb6834] dark:bg-[#d95926]" },
  aqua: { stroke: "stroke-[#1baf7a] dark:stroke-[#199e70]", bg: "bg-[#1baf7a] dark:bg-[#199e70]" },
  yellow: { stroke: "stroke-[#eda100] dark:stroke-[#c98500]", bg: "bg-[#eda100] dark:bg-[#c98500]" },
};

const VIEW = 1000;

/** A round step (1, 2, 2.5 or 5 x a power of ten) giving about `target` gridlines. */
function niceStep(range: number, target: number): number {
  const rough = range / target;
  const power = 10 ** Math.floor(Math.log10(rough));
  const unit = rough / power;
  const nice = unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 2.5 ? 2.5 : unit <= 5 ? 5 : 10;
  return nice * power;
}

/** "฿150k" / "฿1.2M" for the axis. */
function formatAxisBaht(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `฿${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) < 1000) return `฿${Math.round(value)}`;
  return `฿${Math.round(value / 1000)}k`;
}

export function BalanceChart({
  dates,
  series,
  label,
}: {
  /** "YYYY-MM-DD", oldest first. */
  dates: string[];
  series: ChartSeries[];
  /** Read out by screen readers in place of the drawing. */
  label: string;
}) {
  const [active, setActive] = useState<number | null>(null);

  const count = dates.length;
  if (count < 2 || series.length === 0) return null;
  const lastIndex = count - 1;

  let min = Infinity;
  let max = -Infinity;
  for (const s of series) {
    for (const v of s.values) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  // The plot hugs the data (plus a little air); gridlines sit on the round
  // values that fall inside it.
  const range = max - min || 1;
  const low = min - range * 0.06;
  const high = max + range * 0.06;
  const span = high - low;

  const step = niceStep(range, 4);
  const ticks: number[] = [];
  for (let t = Math.ceil(low / step) * step; t <= high; t += step) ticks.push(t);

  const xPercent = (i: number) => (i / lastIndex) * 100;
  const yPercent = (v: number) => (1 - (v - low) / span) * 100;

  const paths = series.map((s) =>
    s.values
      .map(
        (v, i) =>
          `${i === 0 ? "M" : "L"}${((i / lastIndex) * VIEW).toFixed(1)},${((yPercent(v) / 100) * VIEW).toFixed(1)}`,
      )
      .join(" "),
  );

  // One x label per calendar year, at that year's first point.
  const yearTicks: { year: string; index: number }[] = [];
  for (let i = 0; i < count; i++) {
    const year = dates[i].slice(0, 4);
    if (i > 0 && year !== dates[i - 1].slice(0, 4)) yearTicks.push({ year, index: i });
  }

  function indexFromPointer(event: PointerEvent<HTMLDivElement>): number {
    const box = event.currentTarget.getBoundingClientRect();
    const fraction = (event.clientX - box.left) / box.width;
    return Math.min(lastIndex, Math.max(0, Math.round(fraction * lastIndex)));
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const current = active ?? lastIndex;
    const jump = Math.max(1, Math.round(count / 20));
    let next: number;
    if (event.key === "ArrowLeft") next = current - 1;
    else if (event.key === "ArrowRight") next = current + 1;
    else if (event.key === "PageUp") next = current - jump;
    else if (event.key === "PageDown") next = current + jump;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = lastIndex;
    else if (event.key === "Escape") {
      setActive(null);
      return;
    } else return;
    event.preventDefault();
    setActive(Math.min(lastIndex, Math.max(0, next)));
  }

  const tooltipOnLeft = active !== null && xPercent(active) > 55;

  return (
    <figure>
      {/* Legend: always shown for two or more lines; names stay in text colour. */}
      {series.length > 1 && (
        <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
          {series.map((s) => (
            <li key={s.name} className="flex items-center gap-1.5">
              <span aria-hidden="true" className={`inline-block h-0.5 w-4 rounded-full ${COLOR_CLASSES[s.color].bg}`} />
              {s.name}
            </li>
          ))}
        </ul>
      )}

      <div
        role="img"
        aria-label={label}
        tabIndex={0}
        onPointerMove={(e) => setActive(indexFromPointer(e))}
        onPointerDown={(e) => setActive(indexFromPointer(e))}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") setActive(null);
        }}
        onFocus={() => setActive((current) => current ?? lastIndex)}
        onBlur={() => setActive(null)}
        onKeyDown={onKeyDown}
        className="relative h-56 touch-pan-y select-none rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-amber-500 sm:h-72"
      >
        {/* Gridlines and their value labels */}
        {ticks.map((t) => (
          <div
            key={t}
            aria-hidden="true"
            className="absolute inset-x-0 border-t border-gray-200 dark:border-gray-800"
            style={{ top: `${yPercent(t)}%` }}
          >
            <span className="absolute left-0 top-0.5 text-[10px] leading-none text-gray-500 dark:text-gray-400">
              {formatAxisBaht(t)}
            </span>
          </div>
        ))}

        <svg
          aria-hidden="true"
          viewBox={`0 0 ${VIEW} ${VIEW}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full overflow-visible"
        >
          {paths.map((d, i) => (
            <path
              key={series[i].name}
              d={d}
              fill="none"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              className={COLOR_CLASSES[series[i].color].stroke}
            />
          ))}
        </svg>

        {active !== null && (
          <>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 w-px bg-gray-400 dark:bg-gray-500"
              style={{ left: `${xPercent(active)}%` }}
            />
            {series.map((s) => (
              <span
                key={s.name}
                aria-hidden="true"
                className={`pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white dark:ring-gray-900 ${COLOR_CLASSES[s.color].bg}`}
                style={{ left: `${xPercent(active)}%`, top: `${yPercent(s.values[active])}%` }}
              />
            ))}
            <div
              aria-live="polite"
              className={`pointer-events-none absolute top-0 z-10 w-max max-w-[70%] rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-md dark:border-gray-700 dark:bg-gray-900 ${
                tooltipOnLeft ? "-translate-x-full" : ""
              }`}
              style={{
                left: `calc(${xPercent(active)}% ${tooltipOnLeft ? "- 10px" : "+ 10px"})`,
              }}
            >
              <p className="mb-1 text-gray-500 dark:text-gray-400">{formatDateString(dates[active])}</p>
              <ul className="flex flex-col gap-0.5">
                {series.map((s) => (
                  <li key={s.name} className="flex items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className={`inline-block h-0.5 w-3 shrink-0 rounded-full ${COLOR_CLASSES[s.color].bg}`}
                    />
                    <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-50">
                      {formatBahtWhole(s.values[active])}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">{s.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>

      {/* Year labels (every second one on a phone, to avoid crowding) */}
      <div aria-hidden="true" className="relative mt-1 h-4 text-[10px] text-gray-500 dark:text-gray-400">
        {yearTicks.map((tick, i) => (
          <span
            key={tick.year}
            className={`absolute -translate-x-1/2 ${i % 2 === 1 ? "hidden sm:inline" : ""}`}
            style={{ left: `${xPercent(tick.index)}%` }}
          >
            {tick.year}
          </span>
        ))}
      </div>
    </figure>
  );
}
