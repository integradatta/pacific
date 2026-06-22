# Plano — App nativo do devedor + Módulo de Localização (consentido)

> Fase iniciada em 2026-06-21. Branch: `feat/location-consent-backend`.
> **Não mergeado / não deployado** — `main` (prod) intacta. Migração `5_location_consent`
> NÃO aplicada em prod ainda (só será necessária quando a fase for ao ar).

## Escopo e ética (definido pelo usuário)
Finalidade **acadêmica/demonstrativa**. Modelo de **compartilhamento CONSENTIDO** (estilo
Life360 / "compartilhar localização" do Google), **não** vigilância:
- Só compartilha com **consentimento explícito**: permissões de localização do SO (APIs
  oficiais Android/iOS) **+** adesão voluntária a um **grupo privado**.
- Demonstra: tempo real, histórico de trajetos, geofencing, locais frequentes, mapa.
- Participante vê as permissões, sabe que compartilha e **interrompe quando quiser**.
- No Pacific: "grupo privado" = tenant do credor; membros = devedores que optam por
  participar; "painel administrativo" = visão do credor.

## Arquitetura
Implementa os contratos que já existiam em `@pacific/shared/location` (`LocationConsent`,
`LivePosition`, `Geofence`, `LocationEvent`, `LocationService`). Reaproveita API NestJS +
RLS + multi-tenancy. O app nativo é só mais um cliente da API.

## ✅ Increment 1 — Backend spine (FEITO nesta branch, validado)
- **Dados:** `enum ConsentState {NEVER,GRANTED,REVOKED}`; `Debtor.locationConsent/`
  `locationConsentAt/locationRevokedAt`; tabela **`LocationPing`** (lat/lng/accuracy/
  battery/recordedAt) com FK composta de paridade de tenant. Migração `5_location_consent`
  (aditiva/idempotente). **RLS** forced + policy em `LocationPing` (`rls.sql`).
- **API (`/location`)** — devedor (próprio): `GET/POST self/consent`, `POST self/ping`
  (só com consent GRANTED, senão 403), `GET self/history`. Credor (admin): `GET positions`
  (só quem compartilha), `GET :debtorId/consent`, `GET :debtorId/history`.
- **Salvaguardas:** ping recusado sem consentimento; revogar interrompe (histórico preservado);
  tudo tenant-scoped; posição marcada `online` se < 5 min.
- **Validação:** typecheck ✓ · `LocationService` 9 testes ✓ (api total 81) · RLS e2e 6/6 ✓ ·
  magic-link 7/7 ✓.

## 🔜 Próximos increments (backend)
2. **Geofencing:** tabela `Geofence` (por tenant), CRUD do credor, detecção ARRIVAL/DEPARTURE
   no `recordPing` → emite `LocationEvent` (+ opcional Notification).
3. **Locais frequentes:** agregação do histórico (clustering simples por raio/tempo).
4. **Tempo real:** preferir **Supabase Realtime** na tabela `LocationPing` (já usamos Supabase)
   para o painel do credor; alternativa: SSE/WebSocket no Nest. Avaliar custo de pings.
5. **Retenção/privacidade:** TTL/expurgo de histórico; endpoint do devedor para apagar seus
   dados; rever textos "inerte/simulado" em `LocationPanel` e contratos.

## 🔜 App nativo do devedor (precisa de device/simulador — não validável neste sandbox)
- **Stack sugerida:** Expo (React Native) + `react-native-maps` (Google/Apple) +
  `expo-location` (permissões + background). Pacote novo no monorepo (`apps/mobile`).
- **Auth:** mesmo magic-link/`APP_JWT` do fluxo web do devedor (deep link `/d/[token]` →
  troca por sessão); reusar `@pacific/shared`.
- **Telas:** onboarding de consentimento (explica e pede permissão), toggle de
  compartilhamento, mapa com a própria posição/trajeto, tela de "minha dívida" (já existe na
  API), configurações (revogar, ver permissões).
- **Envio de posição:** `expo-location` → `POST /location/self/ping` (foreground; background
  opcional com aviso claro). Respeitar a revogação localmente também.
- **Painel do credor (web):** tela de mapa consumindo `GET /location/positions` +
  `:debtorId/history` (incremento web, fora do app nativo).

## Notas de deploy (quando a fase for ao ar)
- Aplicar `5_location_consent` em prod (`prisma migrate deploy`) e re-aplicar `rls.sql`
  (policy nova de `LocationPing`) **antes** do deploy da API que lê essas colunas.
- CORS: requests autenticadas de browser só do `WEB_ORIGIN` (Vercel).
