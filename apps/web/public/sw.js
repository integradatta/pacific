// Service worker mínimo do PWA Pacific. Estratégia conservadora:
// - API e cross-origin (Supabase/Railway): SEMPRE rede (nunca cacheia dados/auth).
// - Mesma origem (assets/páginas Next): network-first com fallback ao cache (offline básico).
// IMPORTANTE: o fallback é a RAIZ "/" (entrada roteada por papel), NUNCA "/me" — senão uma
// falha de rede jogaria padrinho/admin no app do sobrinho. Bump de versão limpa o cache antigo.
const CACHE = 'pacific-v2';

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', '/icon.svg']).catch(() => undefined)));
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
      .catch(() => caches.match(req).then((hit) => hit || caches.match('/'))),
  );
});
