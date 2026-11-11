// Sends ONE test push to ONE subscription - for proving that Web Push works
// from the Supabase Edge runtime without waiting for a real price change.
// It can never broadcast: it needs either a stored subscription's `id` or a
// full `subscription` object in the request body.
//
// Auth: `Authorization: Bearer <a service_role key for this project>`. Deploy
// with `--no-verify-jwt` (the check below replaces the gateway's JWT check).
// The key is verified by USING it against the Auth admin API, which only
// accepts service_role - a plain string comparison with the runtime's
// SUPABASE_SERVICE_ROLE_KEY fails, because that injected value is not
// byte-identical to the dashboard's service_role key.
//
//   POST { "id": 12 }
//   POST { "subscription": { "endpoint": "...", "keys": { "p256dh": "...", "auth": "..." } } }
// Optional: "title", "body".

import { createClient } from "npm:@supabase/supabase-js@2";
import { createPushServer, sendPush } from "../_shared/push.ts";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function isServiceRoleKey(key: string): Promise<boolean> {
  try {
    const probe = createClient(Deno.env.get("SUPABASE_URL")!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await probe.auth.admin.listUsers({ page: 1, perPage: 1 });
    return !error;
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  const bearer = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!bearer || !(await isServiceRoleKey(bearer))) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await req.json().catch(() => ({}));

    let target: { endpoint: string; p256dh: string; auth: string } | null = null;
    if (body.subscription?.endpoint && body.subscription?.keys) {
      target = {
        endpoint: body.subscription.endpoint,
        p256dh: body.subscription.keys.p256dh,
        auth: body.subscription.keys.auth,
      };
    } else if (typeof body.id === "number") {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const { data, error } = await supabase
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth")
        .eq("id", body.id)
        .maybeSingle();
      if (error) return json({ error: error.message }, 500);
      target = data;
    }
    if (!target) return json({ error: "Provide a stored subscription id or a subscription object" }, 400);

    const server = await createPushServer();
    if (!server) return json({ error: "VAPID keys not configured" }, 500);

    const result = await sendPush(server, target, {
      title: typeof body.title === "string" ? body.title : "ทดสอบการแจ้งเตือนราคาทอง",
      body:
        typeof body.body === "string"
          ? body.body
          : "นี่คือการแจ้งเตือนทดสอบจากราคาทองวันนี้ (thaigoldtracker.com)",
      url: "/",
      tag: "gold-price-test",
    });
    return json({ pushService: new URL(target.endpoint).hostname, ...result });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
