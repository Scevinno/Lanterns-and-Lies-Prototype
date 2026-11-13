// Lanterns & Lies service worker (12 Nov): fast reopening and push notifications.
// Built files have hashed names, so they never change: cache first. Pictures and fonts keep their names, so they
// are served from the cache at once and refreshed in the background. The page itself always tries the network first.
const CACHE = "lnl-v4"; // v4: new Coroner picture (13 Nov)
const SCOPE = self.registration.scope;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));

const isHashed = (u) => u.pathname.includes("/assets/");
const isStatic = (u) => /\/(roles|bg|fonts)\/|(icon|favicon)-[\w-]+\.png$|lantern-loading\.webp$|manifest\.webmanifest$/.test(u.pathname);

self.addEventListener("fetch", (e) => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url); if (!url.href.startsWith(SCOPE)) return; // Supabase and other sites go straight to the network
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      try { const res = await fetch(req); const c = await caches.open(CACHE); c.put(SCOPE, res.clone()); return res; }
      catch { return (await caches.match(SCOPE)) ?? Response.error(); }
    })());
    return;
  }
  if (isHashed(url)) {
    e.respondWith((async () => (await caches.match(req)) ?? (async () => { const res = await fetch(req); if (res.ok) (await caches.open(CACHE)).put(req, res.clone()); return res; })())());
    return;
  }
  if (isStatic(url)) {
    e.respondWith((async () => {
      const c = await caches.open(CACHE); const hit = await c.match(req);
      const fresh = fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => null);
      if (hit) { e.waitUntil(fresh); return hit; }
      return (await fresh) ?? Response.error();
    })());
  }
});

// Push: the game server sends { title, body, url, tag }. Nothing shows while the game is open on screen.
self.addEventListener("push", (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch { d = { title: "Lanterns & Lies", body: e.data?.text() ?? "" }; }
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    if (wins.some((w) => w.visibilityState === "visible" && w.focused)) return;
    await self.registration.showNotification(d.title || "Lanterns & Lies", {
      body: d.body || "", tag: d.tag || "lnl", renotify: true, icon: SCOPE + "icon-192.png", badge: SCOPE + "badge-96.png", data: { url: d.url || SCOPE }, vibrate: [180, 80, 180],
    });
  })());
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close(); const url = e.notification.data?.url || SCOPE;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const w = wins.find((x) => x.url.startsWith(SCOPE));
    if (w) { await w.focus(); try { await w.navigate(url); } catch { /* cross-origin or blocked */ } return; }
    await self.clients.openWindow(url);
  })());
});
