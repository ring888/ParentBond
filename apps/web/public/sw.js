const CACHE_NAME = "parentbond-shell-v20260701b";
const SHELL_URLS = ["/manifest.webmanifest", "/icon.svg"];
const OFFLINE_HTML = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>ParentBond</title>
    <style>
      html,body{margin:0;min-height:100%;background:#0d1b3e;color:#f8f4ee;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Microsoft YaHei",sans-serif}
      main{min-height:100vh;display:grid;place-items:center;padding:24px;text-align:center;background:radial-gradient(circle at 70% 10%,rgba(245,200,66,.18),transparent 240px),#0d1b3e}
      section{max-width:320px;border:1px solid rgba(255,255,255,.12);border-radius:22px;padding:24px;background:rgba(26,58,107,.58)}
      h1{margin:0 0 8px;font-size:22px}
      p{margin:0;color:#c8c2b8;line-height:1.7}
    </style>
  </head>
  <body>
    <main><section><h1>ParentBond 暂时离线</h1><p>请检查网络后重新打开。应用数据不会丢失。</p></section></main>
  </body>
</html>`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/uploads/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => response)
        .catch(() => new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } })),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const fresh = fetch(request, { cache: "no-store" })
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);

      return cached || fresh;
    }),
  );
});
