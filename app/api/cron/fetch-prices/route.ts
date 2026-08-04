import { NextResponse } from "next/server";
import { fetchLatestGoldPrice, GoldPriceFetchError } from "@/lib/goldtraders";
import { insertIfChanged } from "@/lib/gold-price-store";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const snapshot = await fetchLatestGoldPrice();
    const supabase = createAdminClient();
    const result = await insertIfChanged(supabase, snapshot);
    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof GoldPriceFetchError || err instanceof Error
        ? err.message
        : "Unknown error";
    console.error("[fetch-prices]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
