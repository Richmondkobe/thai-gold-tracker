// Thailand has a single fixed UTC+7 offset year-round (no DST), so this
// arithmetic is safe without a full timezone library.
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Start of the Bangkok calendar day (00:00 Asia/Bangkok) containing `date`, as a UTC instant. */
export function startOfBangkokDay(date: Date): Date {
  const shifted = new Date(date.getTime() + BANGKOK_OFFSET_MS);
  const startShifted = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
  );
  return new Date(startShifted - BANGKOK_OFFSET_MS);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/** "YYYY-MM-DD" for the Bangkok calendar day containing `date` (matches Postgres `date` columns). */
export function toBangkokDateString(date: Date): string {
  const shifted = new Date(date.getTime() + BANGKOK_OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
