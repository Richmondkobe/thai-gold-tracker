import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAllowedPushEndpoint, parsePushSubscription } from "@/lib/push-subscription";

// Saves / removes a browser's Web Push subscription. push_subscriptions has
// RLS fully locked, so (like price_alerts) every write goes through the
// service-role client here. The pushes themselves are sent by the
// fetch-prices Supabase Edge Function, not from Vercel.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/** Enable notifications on this device. Idempotent: re-posting the same endpoint just refreshes its keys. */
export async function POST(request: Request) {
  const body = await readJson(request);
  const subscription = parsePushSubscription(body);
  if (!subscription) {
    return NextResponse.json({ error: "ข้อมูลการแจ้งเตือนไม่ถูกต้อง" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(subscription, { onConflict: "endpoint" });

  if (error) {
    console.error("[push] failed to save subscription:", error.message);
    return NextResponse.json(
      { error: "ไม่สามารถเปิดการแจ้งเตือนได้ กรุณาลองใหม่อีกครั้ง" },
      { status: 500 },
    );
  }

  // Sent by the service worker when the browser swapped an old subscription
  // for this one - drop the dead endpoint straight away.
  const replaces = (body as { replaces?: unknown }).replaces;
  if (isAllowedPushEndpoint(replaces) && replaces !== subscription.endpoint) {
    await supabase.from("push_subscriptions").delete().eq("endpoint", replaces);
  }

  return NextResponse.json({ status: "ok" });
}

/** Turn notifications off on this device. Deleting an unknown endpoint is not an error. */
export async function DELETE(request: Request) {
  const body = await readJson(request);
  const endpoint = (body as { endpoint?: unknown } | null)?.endpoint;
  if (!isAllowedPushEndpoint(endpoint)) {
    return NextResponse.json({ error: "ข้อมูลการแจ้งเตือนไม่ถูกต้อง" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);

  if (error) {
    console.error("[push] failed to delete subscription:", error.message);
    return NextResponse.json(
      { error: "ไม่สามารถปิดการแจ้งเตือนได้ กรุณาลองใหม่อีกครั้ง" },
      { status: 500 },
    );
  }

  return NextResponse.json({ status: "ok" });
}
