# geo-mobile — App do participante (Expo / React Native)

App nativo do módulo de geolocalização consentida. Consome o `geo-api`. Mapas via
**MapLibre Native** (OSM, sem API key).

## ⚠️ Status: SCAFFOLD (validação só em device)
Este app **não é compilado/testado neste repositório de CI** — RN/Expo exigem device ou
simulador e build nativo. A **lógica pura** (intervalo adaptativo, fila offline, backoff,
indisponibilidade) vive em `@pacific/geo-shared` e **é coberta por testes** (46 no total).
As telas/serviços abaixo são o ponto de partida, a validar rodando no device.

## Setup (na sua máquina)
```bash
cd apps/geo-mobile
npx expo install        # resolve as versões nativas corretas do SDK
# defina a base do geo-api:
echo "EXPO_PUBLIC_GEO_API_URL=https://<seu-geo-api>" > .env
npx expo run:android    # ou run:ios (precisa de Xcode/Android Studio)
```
O token JWT da plataforma (com claim `tenant_id`) deve ser gravado em `SecureStore` como
`geo_token` pelo fluxo de login (pré-requisito de integração).

## Estrutura
- `src/lib/api.ts` — cliente REST (Bearer via SecureStore).
- `src/lib/queue.ts` — fila offline (AsyncStorage) + sync em lote com backoff (`@pacific/geo-shared`).
- `src/lib/location.ts` — tarefa de background (`expo-location` + `expo-task-manager`), intervalo
  adaptativo, foreground service no Android, fallback offline → fila.
- `src/screens/ConsentScreen.tsx` — onboarding de consentimento (permissão do SO + opt-in).
- `src/screens/MapScreen.tsx` — mapa do grupo (MapLibre + OSM) com posições.
- `src/screens/SettingsScreen.tsx` — pausar/retomar/encerrar compartilhamento + ver permissões.

## Conformidade com a spec
Consentimento explícito e revogável (§1.2), background iOS/Android com foreground service e
degradação (§1.8), fila local com batch + backoff (§1.8), intervalo adaptativo p/ bateria (§2.4),
MapLibre/OSM custo zero. Push (FCM) entra no Increment 7.
