// Service worker mínimo do PWA Pacific. Estratégia conservadora:
// - API e cross-origin (Supabase/Railway): SEMPRE rede (nunca cacheia dados/auth).
// - Mesma origem (assets/páginas Next): network-first com fallback ao cache (offline básico).
const CACHE = 'pacific-v1';

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/me', '/icon.svg']).catch(() => undefined)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  // Só intercepta GET de mesma origem; resto (API, POST, cross-origin) vai direto pra rede.
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => undefined);
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('/me'))),
  );
});
