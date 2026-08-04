const BANGKOK_TZ = "Asia/Bangkok";

const longDateFormatter = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
  timeZone: BANGKOK_TZ,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const shortDateFormatter = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
  timeZone: BANGKOK_TZ,
  day: "numeric",
  month: "short",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("th-TH", {
  timeZone: BANGKOK_TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const numberFormatter = new Intl.NumberFormat("th-TH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const changeNumberFormatter = new Intl.NumberFormat("th-TH", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** e.g. "วันอังคารที่ 4 สิงหาคม พ.ศ. 2569" */
export function formatThaiDateLong(date: Date): string {
  const parts = longDateFormatter.formatToParts(date);
  return parts
    .map((part) => (part.type === "year" ? `พ.ศ. ${part.value}` : part.value))
    .join("");
}

/** e.g. "4 ส.ค. 2569" */
export function formatThaiDateShort(date: Date): string {
  const parts = shortDateFormatter.formatToParts(date);
  return parts
    .map((part) => (part.type === "year" ? `พ.ศ. ${part.value}` : part.value))
    .join("");
}

/** e.g. "16:15 น." */
export function formatThaiTime(date: Date): string {
  return `${timeFormatter.format(date)} น.`;
}

/** e.g. "64,150.00" */
export function formatThaiPrice(value: number): string {
  return numberFormatter.format(value);
}

/** e.g. "+100.00" / "-50.00" / "0.00" */
export function formatThaiChange(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${changeNumberFormatter.format(Math.abs(value))}`;
}
