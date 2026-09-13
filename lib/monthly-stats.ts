import type { DailyGoldPriceRow } from "@/lib/gold-price-queries";

export interface MonthlyStat {
  /** 1-12 */
  month: number;
  open: number;
  close: number;
  high: number;
  low: number;
  changeBaht: number;
  changePercent: number;
}

/**
 * Groups one year's ascending daily rows by calendar month, deriving
 * open/close/high/low/change per month. Only months actually present in
 * `yearRows` appear (e.g. the current year only has months up to today).
 */
export function computeMonthlyStats(yearRows: DailyGoldPriceRow[]): MonthlyStat[] {
  const byMonth = new Map<number, DailyGoldPriceRow[]>();
  for (const row of yearRows) {
    const month = Number(row.priceDate.slice(5, 7));
    const list = byMonth.get(month);
    if (list) list.push(row);
    else byMonth.set(month, [row]);
  }

  return [...byMonth.entries()]
    .sort(([a], [b]) => a - b)
    .map(([month, rows]) => {
      const open = rows[0].barSell;
      const close = rows[rows.length - 1].barSell;
      let high = rows[0].barSell;
      let low = rows[0].barSell;
      for (const row of rows) {
        if (row.barSell > high) high = row.barSell;
        if (row.barSell < low) low = row.barSell;
      }
      return {
        month,
        open,
        close,
        high,
        low,
        changeBaht: close - open,
        changePercent: open !== 0 ? ((close - open) / open) * 100 : 0,
      };
    });
}
