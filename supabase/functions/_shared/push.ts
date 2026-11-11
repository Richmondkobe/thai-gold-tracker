// Web Push sending, shared by the fetch-prices and push-test Edge Functions.
//
// Library: jsr:@negrel/webpush - pure Web Crypto + fetch (RFC 8291 payload
// encryption, RFC 8292 VAPID), so it runs natively in the Supabase Edge (Deno)
// runtime. The usual `web-push` npm package depends on Node's crypto/https
// modules instead. Pinned to an exact version; proven with a real push from
// this runtime to a real browser (see CLAUDE.md "Browser push notifications").
//
// Secrets (set with `supabase secrets set`, same pair as .env.local):
//   VAPID_PUBLIC_KEY  - base64url, 65-byte uncompressed P-256 point. Identical
//                       to NEXT_PUBLIC_VAPID_PUBLIC_KEY on Vercel.
//   VAPID_PRIVATE_KEY - base64url, 32 bytes. Secret. Never regenerate the pair:
//                       every existing browser subscription is bound to it.

import {
  ApplicationServer,
  importVapidKeys,
  PushMessageError,
  Urgency,
} from "jsr:@negrel/webpush@0.5.0";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

// VAPID "sub" claim: how a push service can reach the sender. Must be a plain
// mailto:/https: URL (Apple rejects anything else). Public contact address.
const VAPID_CONTACT = "mailto:contact@thaigoldtracker.com";

// How long a push service keeps an undelivered price alert for an offline
// device. A price from hours ago is noise, not news.
const PUSH_TTL_SECONDS = 2 * 60 * 60;
// With the same Topic, a newer undelivered push REPLACES the older one at the
// push service, so a phone coming back online gets the latest price only.
const PUSH_TOPIC = "gold-price";
const SEND_TIMEOUT_MS = 10_000;
const SEND_CONCURRENCY = 20;
const PAGE_SIZE = 1000;
const WRITE_CHUNK = 200;

export interface StoredSubscription {
  id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** What public/sw.js reads from the push event. */
export interface PushPayload {
  title: string;
  body: string;
  /** Same-origin path opened when the notification is tapped. */
  url: string;
  tag: string;
}

export interface PushResult {
  /** sent = accepted by the push service; gone = subscription no longer exists (404/410). */
  outcome: "sent" | "gone" | "failed";
  status?: number;
  detail?: string;
}

export interface PushStats {
  sent: number;
  /** Dead subscriptions removed from the table. */
  gone: number;
  failed: number;
  /** Set when nothing was attempted, e.g. the VAPID secrets are missing. */
  skipped?: string;
}

function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function bytesToBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Builds the sender from the VAPID secrets, or null (with a log) if they are missing/invalid. */
export async function createPushServer(): Promise<ApplicationServer | null> {
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!publicKey || !privateKey) {
    console.error("[push] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not set; skipping push");
    return null;
  }

  // Standard VAPID keys are raw base64url; Web Crypto wants JWK. The public
  // key is 0x04 || X (32 bytes) || Y (32 bytes).
  const point = base64UrlToBytes(publicKey);
  if (point.length !== 65 || point[0] !== 4) {
    console.error("[push] VAPID_PUBLIC_KEY is not a 65-byte uncompressed P-256 key; skipping push");
    return null;
  }
  const jwk = {
    kty: "EC",
    crv: "P-256",
    x: bytesToBase64Url(point.slice(1, 33)),
    y: bytesToBase64Url(point.slice(33, 65)),
  };

  const vapidKeys = await importVapidKeys({
    publicKey: jwk,
    privateKey: { ...jwk, d: privateKey.replace(/=+$/, "") },
  });
  return await ApplicationServer.new({ contactInformation: VAPID_CONTACT, vapidKeys });
}

/** Sends one push. Never throws. */
export async function sendPush(
  server: ApplicationServer,
  subscription: Pick<StoredSubscription, "endpoint" | "p256dh" | "auth">,
  payload: PushPayload,
): Promise<PushResult> {
  let timer: number | undefined;
  try {
    const subscriber = server.subscribe({
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth },
    });
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("timed out")), SEND_TIMEOUT_MS);
    });
    await Promise.race([
      subscriber.pushTextMessage(JSON.stringify(payload), {
        urgency: Urgency.High,
        ttl: PUSH_TTL_SECONDS,
        topic: PUSH_TOPIC,
      }),
      timeout,
    ]);
    return { outcome: "sent" };
  } catch (err) {
    if (err instanceof PushMessageError) {
      const status = err.response.status;
      const detail = (await err.response.text().catch(() => "")).slice(0, 200);
      // 404/410: the browser unsubscribed, was uninstalled, or the
      // subscription expired. It will never work again.
      if (status === 404 || status === 410) return { outcome: "gone", status, detail };
      return { outcome: "failed", status, detail };
    }
    return { outcome: "failed", detail: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

/**
 * Sends `payload` to every stored subscription, deletes the ones the push
 * service reports as gone, and stamps last_success_at on the rest.
 * Never throws - callers treat push as strictly best-effort.
 */
export async function sendPushToAll(
  supabase: SupabaseClient,
  payload: PushPayload,
): Promise<PushStats> {
  const stats: PushStats = { sent: 0, gone: 0, failed: 0 };
  try {
    // Read everything first (PostgREST caps a response at ~1000 rows), so the
    // deletes below can't shift rows between pages mid-read.
    const subscriptions: StoredSubscription[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth")
        .order("id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) {
        console.error("[push] failed to read subscriptions:", error.message);
        if (subscriptions.length === 0) return { ...stats, skipped: "read failed" };
        break;
      }
      subscriptions.push(...((data ?? []) as StoredSubscription[]));
      if (!data || data.length < PAGE_SIZE) break;
    }
    if (subscriptions.length === 0) return stats;

    const server = await createPushServer();
    if (!server) return { ...stats, skipped: "VAPID keys not configured" };

    const sentIds: number[] = [];
    const goneIds: number[] = [];
    for (const group of chunk(subscriptions, SEND_CONCURRENCY)) {
      const results = await Promise.all(group.map((s) => sendPush(server, s, payload)));
      results.forEach((result, i) => {
        const subscription = group[i];
        if (result.outcome === "sent") {
          sentIds.push(subscription.id);
        } else if (result.outcome === "gone") {
          goneIds.push(subscription.id);
        } else {
          stats.failed++;
          console.error(
            `[push] send failed for subscription ${subscription.id} (${new URL(subscription.endpoint).hostname}): ` +
              `${result.status ?? ""} ${result.detail ?? ""}`,
          );
        }
      });
    }
    stats.sent = sentIds.length;

    for (const ids of chunk(goneIds, WRITE_CHUNK)) {
      const { error } = await supabase.from("push_subscriptions").delete().in("id", ids);
      if (error) console.error("[push] failed to delete gone subscriptions:", error.message);
      else stats.gone += ids.length;
    }

    const now = new Date().toISOString();
    for (const ids of chunk(sentIds, WRITE_CHUNK)) {
      const { error } = await supabase
        .from("push_subscriptions")
        .update({ last_success_at: now })
        .in("id", ids);
      if (error) console.error("[push] failed to stamp last_success_at:", error.message);
    }
  } catch (err) {
    console.error("[push] push block failed:", err instanceof Error ? err.message : err);
  }
  return stats;
}
