"use client";

import { useEffect, useState } from "react";

// One-tap browser push for every price change - no email needed.
// The subscription lives in the browser; this component only mirrors it to
// /api/push/subscriptions. The service worker (public/sw.js) is registered on
// demand, when the user actually turns notifications on.

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const SW_URL = "/sw.js";
const API_URL = "/api/push/subscriptions";
const SYNC_KEY = "push-synced-at";
const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;

type State =
  | "checking" // before the browser has been inspected; rendered like "off"
  | "off"
  | "on"
  | "blocked" // the user (or browser policy) denied notification permission
  | "ios-install" // iPhone/iPad: only allowed once added to the home screen
  | "unsupported";

const CARD_CLASS =
  "rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900";
const NOTE_CLASS = "mt-2 text-sm text-gray-600 dark:text-gray-400";

function urlBase64ToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const raw = window.atob((base64Url + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function isIos(): boolean {
  // iPadOS reports itself as a Mac, but is the only "Mac" with a touch screen.
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isInstalled(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function pushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** True when an existing subscription was made with our current VAPID key. */
function usesCurrentKey(subscription: PushSubscription, key: Uint8Array): boolean {
  const existing = subscription.options.applicationServerKey;
  if (!existing) return false;
  const bytes = new Uint8Array(existing);
  return bytes.length === key.length && bytes.every((b, i) => b === key[i]);
}

async function saveToServer(subscription: PushSubscription): Promise<boolean> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  });
  if (res.ok) {
    try {
      localStorage.setItem(SYNC_KEY, String(Date.now()));
    } catch {
      // private mode etc. - only costs an extra sync later
    }
  }
  return res.ok;
}

async function detectState(): Promise<State> {
  if (!pushSupported()) return isIos() && !isInstalled() ? "ios-install" : "unsupported";
  if (Notification.permission === "denied") return "blocked";

  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription || Notification.permission !== "granted") return "off";

  // Re-send the subscription about once a day so the server heals itself if
  // it ever lost the row. Fire-and-forget; the UI doesn't wait on it.
  let lastSync = 0;
  try {
    lastSync = Number(localStorage.getItem(SYNC_KEY) ?? 0);
  } catch {
    // ignore
  }
  if (Date.now() - lastSync > SYNC_INTERVAL_MS) void saveToServer(subscription).catch(() => {});

  return "on";
}

export function PushNotificationToggle() {
  const [state, setState] = useState<State>("checking");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    detectState()
      .catch((): State => "off")
      .then((next) => {
        if (!cancelled) setState(next);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    setBusy(true);
    setError("");
    try {
      if (!pushSupported()) {
        setState(isIos() && !isInstalled() ? "ios-install" : "unsupported");
        return;
      }

      // Must be the first thing awaited: Safari only shows the permission
      // prompt when it is requested directly from the tap.
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        return;
      }

      const registration = await navigator.serviceWorker.register(SW_URL, {
        scope: "/",
        updateViaCache: "none",
      });
      // Wait for the worker to be active (subscribe() needs it), but never
      // forever - if it doesn't activate, subscribe() below fails and the
      // user gets the normal error message instead of an endless spinner.
      await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((resolve) => setTimeout(resolve, 10_000)),
      ]);

      const key = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      let subscription = await registration.pushManager.getSubscription();
      if (subscription && !usesCurrentKey(subscription, key)) {
        await subscription.unsubscribe();
        subscription = null;
      }
      subscription ??= await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key,
      });

      if (!(await saveToServer(subscription))) {
        setError("ไม่สามารถเปิดการแจ้งเตือนได้ กรุณาลองใหม่อีกครั้ง");
        return;
      }

      setState("on");
      // Instant local confirmation, so the user sees what an alert looks like
      // (and finds out now if the OS itself is hiding this browser's alerts).
      // Deliberately NOT awaited: its promise can stay pending for a long
      // time (seen on macOS Chrome), and waiting on it left the card stuck in
      // its busy state - a disabled "กำลังปิด..." button - until a reload.
      void registration
        .showNotification("เปิดการแจ้งเตือนราคาทองแล้ว", {
          body: "เราจะแจ้งเตือนบนเครื่องนี้ทุกครั้งที่ราคาทองเปลี่ยน",
          icon: "/icons/icon-192.png",
          tag: "gold-price-enabled",
          lang: "th",
        })
        .catch(() => {});
    } catch (err) {
      console.error("[push] enable failed:", err);
      setError("ไม่สามารถเปิดการแจ้งเตือนได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError("");
    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        // Browser first: once this succeeds no more alerts can arrive, even
        // if the server call below fails (the sender then prunes the row
        // itself when the push service reports the endpoint as gone).
        await subscription.unsubscribe();
        await fetch(API_URL, {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        }).catch(() => {});
      }
      setState("off");
    } catch (err) {
      console.error("[push] disable failed:", err);
      setError("ไม่สามารถปิดการแจ้งเตือนได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  // Not configured (no VAPID key at build time): show nothing rather than a
  // button that cannot work.
  if (!VAPID_PUBLIC_KEY) return null;

  return (
    <section aria-labelledby="push-heading" className={CARD_CLASS}>
      <h2 id="push-heading" className="text-lg font-bold text-gray-900 dark:text-gray-50">
        แจ้งเตือนราคาทองบนเครื่องนี้
      </h2>

      {state === "on" ? (
        <>
          <p className="mt-2 flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-400">
            <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" />
            เปิดการแจ้งเตือนบนเครื่องนี้แล้ว
          </p>
          <p className={NOTE_CLASS}>
            เราจะแจ้งเตือนทุกครั้งที่สมาคมค้าทองคำประกาศราคาทองใหม่
          </p>
          <button
            type="button"
            onClick={disable}
            disabled={busy}
            className="mt-4 rounded-full border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 hover:border-gray-400 disabled:opacity-60 dark:border-gray-700 dark:text-gray-300"
          >
            {busy ? "กำลังปิด..." : "ปิดการแจ้งเตือน"}
          </button>
        </>
      ) : state === "ios-install" ? (
        <p className={NOTE_CLASS}>
          บน iPhone และ iPad ต้องเพิ่มเว็บนี้ไว้ที่หน้าจอโฮมก่อน: แตะปุ่มแชร์
          แล้วเลือก “เพิ่มไปยังหน้าจอโฮม” จากนั้นเปิดเว็บจากไอคอนบนหน้าจอโฮม
          แล้วกดปุ่มเปิดการแจ้งเตือนในหน้านี้ (ต้องใช้ iOS 16.4 ขึ้นไป)
        </p>
      ) : state === "unsupported" ? (
        <p className={NOTE_CLASS}>
          เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือน กรุณาใช้ Chrome, Edge, Firefox หรือ
          Safari เวอร์ชันล่าสุด หรือสมัครรับการแจ้งเตือนทางอีเมลด้านล่าง
        </p>
      ) : state === "blocked" ? (
        <p className={NOTE_CLASS}>
          เบราว์เซอร์นี้บล็อกการแจ้งเตือนจากเว็บไซต์ของเราอยู่
          กรุณาอนุญาตการแจ้งเตือนในการตั้งค่าเว็บไซต์ของเบราว์เซอร์
          แล้วโหลดหน้านี้ใหม่อีกครั้ง
        </p>
      ) : (
        <>
          <p className={NOTE_CLASS}>
            รับการแจ้งเตือนทันทีทุกครั้งที่ราคาทองเปลี่ยน ฟรี ไม่ต้องใช้อีเมล
          </p>
          <button
            type="button"
            onClick={enable}
            disabled={busy}
            className="mt-4 w-full rounded-full bg-amber-500 px-6 py-3 text-base font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
          >
            {busy ? "กำลังเปิด..." : "เปิดการแจ้งเตือนราคาทองบนเครื่องนี้"}
          </button>
        </>
      )}

      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </section>
  );
}
