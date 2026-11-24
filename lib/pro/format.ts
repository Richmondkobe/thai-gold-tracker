// Number and date formatting for the private /pro area. It is an English-only
// tool for the site owner, so - unlike the public Thai pages - it uses plain
// English dates with Gregorian years (the backtest is read year by year
// against "2016 to today").

const BANGKOK_TZ = "Asia/Bangkok";

const moneyFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const wholeFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

const weightFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: BANGKOK_TZ,
  day: "numeric",
  month: "short",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: BANGKOK_TZ,
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** "฿123,456.78" (or "-฿123.00"). */
export function formatBaht(value: number): string {
  const text = moneyFormatter.format(Math.abs(value));
  return `${value < 0 ? "-" : ""}฿${text}`;
}

/** "฿123,457" - whole baht, for large balances and prices. */
export function formatBahtWhole(value: number): string {
  const text = wholeFormatter.format(Math.abs(value));
  return `${value < 0 ? "-" : ""}฿${text}`;
}

/** "+฿1,234.50" / "-฿1,234.50" (plain "฿0.00" for zero), for profit and loss. */
export function formatSignedBaht(value: number): string {
  const text = moneyFormatter.format(Math.abs(value));
  if (text === "0.00") return "฿0.00";
  return `${value > 0 ? "+" : "-"}฿${text}`;
}

/** "+12.3%" / "-4.5%". */
export function formatSignedPercent(value: number, digits = 1): string {
  const text = Math.abs(value).toFixed(digits);
  if (Number(text) === 0) return `${text}%`;
  return `${value > 0 ? "+" : "-"}${text}%`;
}

/** Gold weight in baht-weight, 4 decimals: "1.7094". */
export function formatWeight(value: number): string {
  return weightFormatter.format(value);
}

/** "24 Nov 2026" from a Date (Bangkok time). */
export function formatDate(date: Date): string {
  return dateFormatter.format(date);
}

/** "24 Nov 2026" from a "YYYY-MM-DD" calendar date. */
export function formatDateString(dateStr: string): string {
  return dateFormatter.format(new Date(`${dateStr}T12:00:00+07:00`));
}

/** "24 Nov 2026, 11:48" (Bangkok time). */
export function formatDateTime(date: Date): string {
  return dateTimeFormatter.format(date);
}
