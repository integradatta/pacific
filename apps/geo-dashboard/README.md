# geo-dashboard — Painel web (Next + MapLibre)

Dashboard administrativo do módulo de geolocalização. Consome o `geo-api` (REST + WebSocket).
Mapas via **MapLibre GL JS + tiles do OpenStreetMap** (gratuito, sem API key).

## Arquitetura
- **`lib/map/MapProvider.ts`** — interface de abstração de mapas (spec). Toda interação com o
  MapLibre passa por aqui → trocar para Google/Mapbox sem mexer na lógica.
  - `MapLibreProvider` (concreto, padrão), `GoogleMapsProvider`/`MapboxProvider` (stubs).
  - `createMapProvider(kind)` (fábrica).
- **`lib/api.ts`** — cliente REST do geo-api (Bearer JWT; token de demo em `localStorage.geo_token`).
- **`lib/realtime.ts`** — socket.io-client no `/ws/locations` (entra na room do grupo; recebe
  `location_update`/`status_change`/`geofence_alert`).
- **Telas:** `/` (grupos) · `/groups/[id]` (mapa com posições ao vivo + geofences + lista de quem
  compartilha). Reverse geocoding via Nominatim (em prod, rotear pelo geo-api p/ throttle+cache).

## Env
- `NEXT_PUBLIC_GEO_API_URL` — base do geo-api (default `http://localhost:3334`).

## Status
`next build` ✓ (type-check + lint). Funcional de verdade requer o `geo-api` rodando + dados +
um JWT válido com `tenant_id` — validação ponta a ponta depois, junto do backend.
