// Validation for browser push subscriptions posted to /api/push/subscriptions.
// No "server-only" import: pure functions, safe anywhere.

export interface PushSubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Push services we accept endpoints for. The fetch-prices Edge Function POSTs
 * to whatever endpoint is stored, so without this list anyone could make it
 * send requests to an arbitrary URL on every price change.
 *   fcm.googleapis.com          Chrome, Edge (Android), Brave, Opera, Samsung Internet
 *   *.push.services.mozilla.com Firefox
 *   *.push.apple.com            Safari (macOS, and iOS home-screen apps)
 *   *.notify.windows.com        Edge on Windows
 */
const ALLOWED_PUSH_HOSTS = [
  "fcm.googleapis.com",
  ".push.services.mozilla.com",
  ".push.apple.com",
  ".notify.windows.com",
];

const MAX_ENDPOINT_LENGTH = 2048;
const BASE64URL_RE = /^[A-Za-z0-9_-]+={0,2}$/;

export function isAllowedPushEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== "string" || endpoint.length > MAX_ENDPOINT_LENGTH) return false;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.port !== "" || url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  return ALLOWED_PUSH_HOSTS.some((allowed) =>
    allowed.startsWith(".") ? host.endsWith(allowed) : host === allowed,
  );
}

function decodedLength(value: string): number {
  const unpadded = value.replace(/=+$/, "");
  return Math.floor((unpadded.length * 3) / 4);
}

/** Accepts the shape of PushSubscription.toJSON(); returns null when anything is off. */
export function parsePushSubscription(body: unknown): PushSubscriptionInput | null {
  if (typeof body !== "object" || body === null) return null;
  const { endpoint, keys } = body as { endpoint?: unknown; keys?: unknown };
  if (!isAllowedPushEndpoint(endpoint)) return null;
  if (typeof keys !== "object" || keys === null) return null;

  const { p256dh, auth } = keys as { p256dh?: unknown; auth?: unknown };
  // p256dh: uncompressed P-256 public key (65 bytes). auth: 16-byte secret.
  if (typeof p256dh !== "string" || !BASE64URL_RE.test(p256dh) || decodedLength(p256dh) !== 65) {
    return null;
  }
  if (typeof auth !== "string" || !BASE64URL_RE.test(auth) || decodedLength(auth) !== 16) {
    return null;
  }
  return { endpoint, p256dh, auth };
}
