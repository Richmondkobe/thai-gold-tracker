import { NextResponse } from "next/server";
import { getDailyCloseOnOrBefore } from "@/lib/gold-price-queries";
import { toBangkokDateString } from "@/lib/bangkok";

// Serves the profit calculator's purchase-date lookup. Public data
// (daily_gold_prices is anon-readable); past closes never change, so
// historical dates get a long cache.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATA_START = "2016-01-02";

export async function GET(request: Request) {
  const date = new URL(request.url).searchParams.get("date");

  if (!date || !DATE_RE.test(date)) {
    return NextResponse.json(
      { error: "กรุณาระบุวันที่ในรูปแบบ YYYY-MM-DD" },
      { status: 400 },
    );
  }

  const todayBangkok = toBangkokDateString(new Date());
  if (date > todayBangkok) {
    return NextResponse.json(
      { error: "ไม่สามารถเลือกวันที่ในอนาคตได้" },
      { status: 400 },
    );
  }
  if (date < DATA_START) {
    return NextResponse.json(
      { error: `มีข้อมูลราคาทองย้อนหลังตั้งแต่วันที่ ${DATA_START} เป็นต้นไป` },
      { status: 404 },
    );
  }

  try {
    const row = await getDailyCloseOnOrBefore(date);
    if (!row) {
      return NextResponse.json({ error: "ไม่พบข้อมูลราคาทองในช่วงวันที่ดังกล่าว" }, { status: 404 });
    }

    return NextResponse.json(
      {
        requestedDate: date,
        priceDate: row.priceDate,
        fetchedAt: row.fetchedAt.toISOString(),
        barSell: row.barSell,
        ornamentSell: row.ornamentSell,
      },
      {
        headers: {
          // A past day's close is immutable; today's close can still move.
          "cache-control":
            date < todayBangkok
              ? "public, s-maxage=604800, max-age=86400"
              : "public, s-maxage=300, max-age=60",
        },
      },
    );
  } catch (err) {
    console.error("[daily-price]", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง" },
      { status: 500 },
    );
  }
}
