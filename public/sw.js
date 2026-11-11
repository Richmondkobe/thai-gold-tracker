// Service worker for ราคาทองวันนี้ (thaigoldtracker.com).
//
// Its ONLY job is Web Push: show the price-change notification and open the
// site when it is tapped. It deliberately has no `fetch` handler and caches
// nothing, so it can never serve a stale price or interfere with how pages
// load. Registered on demand by components/PushNotificationToggle.tsx.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "ราคาทองวันนี้", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      lang: "th",
      // Same tag = a newer price replaces an older notification instead of
      // stacking up; renotify makes the replacement alert again.
      tag: data.tag || "gold-price",
      renotify: true,
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  // Only ever open our own site, whatever the payload says.
  let target = new URL("/", self.location.origin);
  try {
    const requested = new URL(event.notification.data?.url || "/", self.location.origin);
    if (requested.origin === self.location.origin) target = requested;
  } catch {
    // keep the homepage
  }

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if (new URL(client.url).origin !== self.location.origin) continue;
        await client.focus();
        // Reload it so the page shows the price the notification announced.
        if ("navigate" in client) await client.navigate(target.href).catch(() => {});
        return;
      }
      await self.clients.openWindow(target.href);
    })(),
  );
});

// The browser replaced our subscription (rare). Re-subscribe with the same
// key and tell the server, so notifications keep arriving without the user
// having to press the button again.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const old = event.oldSubscription;
      const fresh =
        event.newSubscription ||
        (old && old.options && old.options.applicationServerKey
          ? await self.registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: old.options.applicationServerKey,
            })
          : null);
      if (!fresh) return;
      await fetch("/api/push/subscriptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...fresh.toJSON(), replaces: old ? old.endpoint : undefined }),
      });
    })(),
  );
});
