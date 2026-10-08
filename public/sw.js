// Service worker do Prumo (spec 001, FR-020; visual da 003): garante a página "sem conexão".
// Não guarda dados financeiros em cache (Constitution II): só a página offline, o ícone e os
// arquivos estáticos com hash de CSS e fontes (imutáveis), para a página offline sair estilizada.
const CACHE = "prumo-shell-v2";
const OFFLINE_URL = "/~offline";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png"];
const STATIC_ASSETS = /^\/_next\/static\/(css|media)\//;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // Cache-first para CSS e fontes com hash (mesma origem).
  if (url.origin === self.location.origin && STATIC_ASSETS.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  if (request.mode !== "navigate") return;
  event.respondWith(
    fetch(request).catch(async () => (await caches.match(OFFLINE_URL)) ?? Response.error()),
  );
});
