// Dhandha phone app service worker: an offline page, cached icons, and notifications.
const CACHE = "dhandha-v1";
const SHELL = ["/offline.html", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Pages always come fresh from the network (they hold live data); only when that fails, the offline page.
self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.method !== "GET") return;
  if (r.mode === "navigate") { e.respondWith(fetch(r).catch(() => caches.match("/offline.html"))); return; }
  if (new URL(r.url).pathname.startsWith("/icons/")) e.respondWith(caches.match(r).then((hit) => hit || fetch(r)));
});

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: "Dhandha", body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || "Dhandha", {
    body: d.body || "", tag: d.tag || undefined, renotify: !!d.tag, data: { url: d.url || "/app" },
    icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", vibrate: [80, 40, 80],
  }));
});

// Tapping a notification opens (or focuses) Dhandha on the right page.
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || "/app", self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const c of list) if (c.url.startsWith(self.location.origin)) { c.focus(); return c.navigate(url); }
    return self.clients.openWindow(url);
  }));
});
