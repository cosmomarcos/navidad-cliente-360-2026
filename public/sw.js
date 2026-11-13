const CACHE = "navidad-pyme-shell-v2.0.12";
const SHELL = ["/", "/css/styles.css", "/js/app.js", "/js/participants.js", "/manifest.webmanifest", "/icons/icon.svg"];
self.addEventListener("install", event => event.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  await cache.addAll(SHELL);
  await self.skipWaiting();
})()));
self.addEventListener("activate", event => event.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter(key => key.startsWith("navidad-pyme-shell-") && key !== CACHE).map(key => caches.delete(key)));
  await self.clients.claim();
})()));
self.addEventListener("fetch", event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== "GET" || url.pathname.startsWith("/api/") || url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    } catch (error) {
      const cached = await cache.match(request) || await cache.match("/");
      if (cached) return cached;
      throw error;
    }
  })());
});
self.addEventListener("push", event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data?.text() || "" }; }
  event.waitUntil(self.registration.showNotification(data.title || "¡Tienes un mensaje! 🎁", {
    body: data.body || "Tu amigo secreto te envio un mensaje",
    icon: "/icons/icon.svg", badge: "/icons/icon.svg",
    tag: data.tag || "amigo-secreto-pista", renotify: false,
    data: { url: data.url || "/?tab=community" }
  }));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/?tab=community", self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin !== self.location.origin) continue;
      try { await client.navigate(target); } catch {}
      return client.focus();
    }
    return self.clients.openWindow(target);
  })());
});
