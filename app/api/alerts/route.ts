import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLatestPrices } from "@/lib/gold-price-queries";
import { formatThaiPrice } from "@/lib/thai-date";
import { sendEmail } from "@/lib/resend";
import { SITE_URL } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_TARGET_PRICE = 1;
const MAX_TARGET_PRICE = 1_000_000;

function directionLabel(direction: "above" | "below") {
  return direction === "above" ? "สูงกว่า" : "ต่ำกว่า";
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  const { email, targetPrice, direction } = (body ?? {}) as Record<string, unknown>;

  if (typeof email !== "string" || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "กรุณากรอกอีเมลให้ถูกต้อง" }, { status: 400 });
  }

  const parsedTargetPrice = typeof targetPrice === "number" ? targetPrice : Number(targetPrice);
  if (
    !Number.isFinite(parsedTargetPrice) ||
    parsedTargetPrice < MIN_TARGET_PRICE ||
    parsedTargetPrice > MAX_TARGET_PRICE
  ) {
    return NextResponse.json({ error: "กรุณากรอกราคาเป้าหมายให้ถูกต้อง" }, { status: 400 });
  }

  if (direction !== "above" && direction !== "below") {
    return NextResponse.json({ error: "กรุณาเลือกทิศทางการแจ้งเตือน" }, { status: 400 });
  }

  // Reject targets the current price has already passed - the alert would
  // otherwise fire (or sit meaninglessly) the moment the trigger runs.
  // Fails open: a price-fetch error must not block signups.
  try {
    const [latest] = await getLatestPrices(1);
    if (latest) {
      const currentBarSell = latest.barSell;
      if (direction === "above" && parsedTargetPrice < currentBarSell) {
        return NextResponse.json(
          {
            error: `ราคาทองคำแท่งขายออกปัจจุบัน (${formatThaiPrice(currentBarSell)} บาท) สูงกว่าราคาเป้าหมายที่ตั้งไว้แล้ว กรุณาตั้งราคาเป้าหมายให้สูงกว่าราคาปัจจุบัน`,
          },
          { status: 400 },
        );
      }
      if (direction === "below" && parsedTargetPrice > currentBarSell) {
        return NextResponse.json(
          {
            error: `ราคาทองคำแท่งขายออกปัจจุบัน (${formatThaiPrice(currentBarSell)} บาท) ต่ำกว่าราคาเป้าหมายที่ตั้งไว้แล้ว กรุณาตั้งราคาเป้าหมายให้ต่ำกว่าราคาปัจจุบัน`,
          },
          { status: 400 },
        );
      }
    }
  } catch (err) {
    console.error(
      "[alerts] price check skipped, failed to load latest price:",
      err instanceof Error ? err.message : err,
    );
  }

  const supabase = createAdminClient();

  const { data: inserted, error: insertError } = await supabase
    .from("price_alerts")
    .insert({ email, target_price: parsedTargetPrice, direction })
    .select("id, token")
    .single();

  if (insertError || !inserted) {
    console.error("[alerts] insert failed:", insertError?.message);
    return NextResponse.json(
      { error: "ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง" },
      { status: 500 },
    );
  }

  const confirmUrl = `${SITE_URL}/alerts/confirm?token=${inserted.token}`;

  try {
    await sendEmail({
      to: email,
      subject: "ยืนยันการแจ้งเตือนราคาทอง - ราคาทองวันนี้",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>ยืนยันการแจ้งเตือนราคาทอง</h2>
          <p>
            คุณได้สมัครรับการแจ้งเตือนเมื่อราคาทองคำแท่งขายออก
            <strong>${directionLabel(direction)} ${parsedTargetPrice.toLocaleString("th-TH")} บาท</strong>
          </p>
          <p>กรุณากดยืนยันเพื่อเริ่มรับการแจ้งเตือน:</p>
          <p>
            <a href="${confirmUrl}" style="display:inline-block;background:#f59e0b;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;">
              ยืนยันการแจ้งเตือน
            </a>
          </p>
          <p style="color:#888;font-size:13px;">หากคุณไม่ได้ทำรายการนี้ กรุณาเพิกเฉยต่ออีเมลฉบับนี้</p>
        </div>
      `,
    });
  } catch (err) {
    console.error("[alerts] email send failed:", err instanceof Error ? err.message : err);
    await supabase.from("price_alerts").delete().eq("id", inserted.id);
    return NextResponse.json(
      { error: "ไม่สามารถส่งอีเมลยืนยันได้ กรุณาลองใหม่อีกครั้ง" },
      { status: 500 },
    );
  }

  return NextResponse.json({ status: "ok" });
}
