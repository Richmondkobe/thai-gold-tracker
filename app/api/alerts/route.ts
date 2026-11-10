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
/** Postgres unique_violation - here, the one-every_change-per-email index (migration 0007). */
const UNIQUE_VIOLATION = "23505";

type Direction = "above" | "below";

const ALREADY_SUBSCRIBED_MESSAGE =
  "อีเมลนี้สมัครรับการแจ้งเตือนทุกครั้งที่ราคาเปลี่ยนไว้แล้ว";

function directionLabel(direction: Direction) {
  return direction === "above" ? "สูงกว่า" : "ต่ำกว่า";
}

function confirmationEmailHtml(opts: { summaryHtml: string; token: string }) {
  const confirmUrl = `${SITE_URL}/alerts/confirm?token=${opts.token}`;
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>ยืนยันการแจ้งเตือนราคาทอง</h2>
      <p>${opts.summaryHtml}</p>
      <p>กรุณากดยืนยันเพื่อเริ่มรับการแจ้งเตือน:</p>
      <p>
        <a href="${confirmUrl}" style="display:inline-block;background:#f59e0b;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;">
          ยืนยันการแจ้งเตือน
        </a>
      </p>
      <p style="color:#888;font-size:13px;">หากคุณไม่ได้ทำรายการนี้ กรุณาเพิกเฉยต่ออีเมลฉบับนี้</p>
    </div>
  `;
}

const EVERY_CHANGE_SUMMARY_HTML = `
  คุณได้สมัครรับการแจ้งเตือน<strong>ทุกครั้งที่ราคาทองเปลี่ยน</strong>
  ตามประกาศของสมาคมค้าทองคำ เราจะส่งอีเมลให้ทุกครั้งที่มีประกาศราคาใหม่
  และคุณยกเลิกได้ทุกเมื่อจากลิงก์ท้ายอีเมล
`;

const EMAIL_FAILED_RESPONSE = () =>
  NextResponse.json(
    { error: "ไม่สามารถส่งอีเมลยืนยันได้ กรุณาลองใหม่อีกครั้ง" },
    { status: 500 },
  );

const SAVE_FAILED_RESPONSE = () =>
  NextResponse.json(
    { error: "ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง" },
    { status: 500 },
  );

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  const {
    email: rawEmail,
    targetPrice,
    direction,
    alertType: rawAlertType,
  } = (body ?? {}) as Record<string, unknown>;

  // Stored lower-cased so "one every_change alert per email" can't be dodged
  // (or tripped over) by a difference in capitalisation.
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "กรุณากรอกอีเมลให้ถูกต้อง" }, { status: 400 });
  }

  // Older clients send no alertType at all - that is a 'target' signup.
  const alertType = rawAlertType ?? "target";
  if (alertType !== "target" && alertType !== "every_change") {
    return NextResponse.json({ error: "กรุณาเลือกประเภทการแจ้งเตือน" }, { status: 400 });
  }

  if (alertType === "every_change") {
    return subscribeEveryChange(email);
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
    .insert({ email, alert_type: "target", target_price: parsedTargetPrice, direction })
    .select("id, token")
    .single();

  if (insertError || !inserted) {
    console.error("[alerts] insert failed:", insertError?.message);
    return SAVE_FAILED_RESPONSE();
  }

  try {
    await sendEmail({
      to: email,
      subject: "ยืนยันการแจ้งเตือนราคาทอง - ราคาทองวันนี้",
      html: confirmationEmailHtml({
        token: inserted.token,
        summaryHtml: `
          คุณได้สมัครรับการแจ้งเตือนเมื่อราคาทองคำแท่งขายออก
          <strong>${directionLabel(direction)} ${parsedTargetPrice.toLocaleString("th-TH")} บาท</strong>
        `,
      }),
    });
  } catch (err) {
    console.error("[alerts] email send failed:", err instanceof Error ? err.message : err);
    await supabase.from("price_alerts").delete().eq("id", inserted.id);
    return EMAIL_FAILED_RESPONSE();
  }

  return NextResponse.json({ status: "ok" });
}

/**
 * "ทุกครั้งที่ราคาเปลี่ยน" signup: no target, no direction, and at most one per
 * email address.
 *   - already subscribed and confirmed -> rejected (409)
 *   - signed up before but never confirmed -> the confirmation email is sent
 *     again for the existing row, so a lost email isn't a dead end
 *   - otherwise -> new row + confirmation email
 */
async function subscribeEveryChange(email: string) {
  const supabase = createAdminClient();

  const { data: existing, error: lookupError } = await supabase
    .from("price_alerts")
    .select("id, token, confirmed")
    .eq("alert_type", "every_change")
    .eq("email", email)
    .limit(1)
    .maybeSingle();

  if (lookupError) {
    console.error("[alerts] every_change lookup failed:", lookupError.message);
    return SAVE_FAILED_RESPONSE();
  }

  if (existing?.confirmed) {
    return NextResponse.json({ error: ALREADY_SUBSCRIBED_MESSAGE }, { status: 409 });
  }

  let row = existing;
  const isNewRow = !existing;

  if (!row) {
    const { data: inserted, error: insertError } = await supabase
      .from("price_alerts")
      .insert({ email, alert_type: "every_change" })
      .select("id, token, confirmed")
      .single();

    if (insertError?.code === UNIQUE_VIOLATION) {
      // Lost a race with a simultaneous signup for the same address.
      return NextResponse.json({ error: ALREADY_SUBSCRIBED_MESSAGE }, { status: 409 });
    }
    if (insertError || !inserted) {
      console.error("[alerts] every_change insert failed:", insertError?.message);
      return SAVE_FAILED_RESPONSE();
    }
    row = inserted;
  }

  try {
    await sendEmail({
      to: email,
      subject: "ยืนยันการแจ้งเตือนทุกครั้งที่ราคาทองเปลี่ยน - ราคาทองวันนี้",
      html: confirmationEmailHtml({ token: row.token, summaryHtml: EVERY_CHANGE_SUMMARY_HTML }),
    });
  } catch (err) {
    console.error("[alerts] email send failed:", err instanceof Error ? err.message : err);
    // Only roll back a row this request created - never delete an earlier
    // pending signup just because a re-send failed.
    if (isNewRow) await supabase.from("price_alerts").delete().eq("id", row.id);
    return EMAIL_FAILED_RESPONSE();
  }

  return NextResponse.json({ status: "ok" });
}
