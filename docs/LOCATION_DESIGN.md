# Módulo de Localização — Desenho Técnico (pré-implementação)

> Status: **plano**. Nada aqui está implementado. Base para a próxima sessão.
> Princípio inegociável: **localização real, porém consentida, transparente e revogável** (estilo
> Life360 / Google Location Sharing). Nunca rastreamento oculto. Finalidade acadêmica/demonstrativa.

Mapeamento de domínio: **tenant = grupo privado**, **sobrinho (devedor) = membro que opta por
participar**, **padrinho (credor) = painel que vê as posições dos membros que consentiram**.

---

## 0. Pré-requisitos e decisões que travam o resto

### 0.1 Plataforma de captura (DECISÃO CRÍTICA — definir antes de codar)
GPS **em background** (continuar enviando posição com o app fechado) **não funciona** num PWA/webview
puro. Isso obriga uma das opções:

- **A. Capacitor + plugin nativo de background geolocation** (ex.: `@capacitor-community/background-geolocation`).
  Reaproveita o front web atual dentro do app Capacitor (`apps/mobile` já existe como casca). **Recomendado** —
  menor retrabalho, mantém Next.js.
- **B. App nativo dedicado (Expo/React Native + react-native-maps)**. Mais controle/bateria, mas reescreve a UI do sobrinho.

> Recomendação: **A (Capacitor + plugin)** para o MVP. A captura em background e a permissão "Always"
> exigem justificativa nas lojas (ver §8). O painel do padrinho é **web** (Next.js) em qualquer caso.

### 0.2 Conformidade (LGPD) — bloqueante para dados reais de pessoas
Posição em tempo real de pessoas é **dado pessoal sensível**. Antes de coletar em produção:
- Texto de **consentimento versionado** + registro de aceite (quem, quando, qual versão).
- Base legal = **consentimento explícito**; coleta só de quem está `GRANTED`.
- **Minimização** + **retenção curta** do histórico (default 30 dias, configurável).
- **Revogação** a qualquer momento (para a coleta e, opcionalmente, purga o histórico).
- Transparência: o sobrinho vê o próprio estado e **quem** o vê.

---

## 1. Regras de produto (dadas pelo usuário)
1. Compartilhamento é **voluntário no primeiro uso** (opt-in na instalação do app).
2. Uma vez ligado, **permanece ativo** até o usuário **desligar manualmente** OU **desinstalar**.
3. Após o opt-in, o desligamento fica **só nas Configurações** do app (sem toggle solto).
4. Se o sobrinho **recusar** a localização, o **padrinho é notificado**.
5. Participante vê as permissões concedidas e **pode interromper a qualquer momento** (nas Configurações).

### 1.1 Máquina de estados do consentimento
```
NEVER ──(aceita no 1º uso)──▶ GRANTED ──(desliga nas Configurações / revoga permissão do SO)──▶ REVOKED
  │                                                   ▲
  └──(recusa no 1º uso)──▶ DECLINED ──(aceita depois)─┘
                              │
                       (notifica o padrinho)
```
- `NEVER`: nunca decidiu.
- `DECLINED`: recusou no opt-in → **dispara notificação ao padrinho** (regra #4).
- `GRANTED`: compartilhando; envia pings.
- `REVOKED`: parou (manual ou permissão do SO removida).
- **Desinstalação não é detectável diretamente** no servidor. Tratamos por **heartbeat**: sem ping há
  `> X` (ex.: 1h) → posição marcada `online=false` ("Sem atualização recente"); sem ping há `> Y` dias →
  estado de exibição "Inativo" (não confundir com REVOKED). Isso cobre desinstalar/desligar o celular.

---

## 2. Modelo de dados (Prisma) — todas tenant-scoped + RLS FORCE

Reaproveita os contratos já existentes em `@pacific/shared/location` (`ConsentState`, `LivePosition`,
`Geofence`, `LocationEvent`).

```prisma
enum LocationConsentState { NEVER  DECLINED  GRANTED  REVOKED }

model LocationConsent {            // 1 por devedor
  debtorId    String   @id
  tenantId    String
  state       LocationConsentState @default(NEVER)
  consentText String?              // versão do texto aceito
  grantedAt   DateTime?
  revokedAt   DateTime?
  declinedAt  DateTime?
  updatedAt   DateTime @updatedAt
  @@index([tenantId, state])
}

model DebtorPosition {            // ÚLTIMA posição conhecida (1 por devedor) — leitura barata do mapa
  debtorId   String   @id
  tenantId   String
  lat        Decimal  @db.Decimal(9,6)
  lng        Decimal  @db.Decimal(9,6)
  accuracy   Int?                 // metros
  battery    Int?                 // 0-100
  recordedAt DateTime
  @@index([tenantId])
}

model LocationPing {              // HISTÓRICO (trajeto) — alto volume → retenção curta
  id         String   @id @default(uuid())
  tenantId   String
  debtorId   String
  lat        Decimal  @db.Decimal(9,6)
  lng        Decimal  @db.Decimal(9,6)
  accuracy   Int?
  battery    Int?
  recordedAt DateTime
  @@index([tenantId, debtorId, recordedAt])
}

model Geofence {                  // locais frequentes / cercas (por tenant)
  id        String   @id @default(uuid())
  tenantId  String
  label     String
  lat       Decimal  @db.Decimal(9,6)
  lng       Decimal  @db.Decimal(9,6)
  radiusM   Int
  createdAt DateTime @default(now())
  @@index([tenantId])
}

model GeofenceEvent {             // entrada/saída (derivado dos pings)
  id         String   @id @default(uuid())
  tenantId   String
  debtorId   String
  geofenceId String
  type       String   // ARRIVAL | DEPARTURE
  occurredAt DateTime @default(now())
  @@index([tenantId, debtorId, occurredAt])
}
```
- `Debtor.lastLocation` (coluna legada, nunca usada) → **descartar** em favor de `DebtorPosition`.
- Migration nova + **políticas RLS** (mesmo padrão `FORCE` + `USING tenantId = current_setting(...)`) em
  `rls.sql` para cada tabela acima.
- Novo `PlatformEventType`: `LOCATION_CONSENT` (registra GRANTED/DECLINED/REVOKED no feed/auditoria).

---

## 3. Backend (NestJS) — registrar o `LocationModule` (o seam já existe)

### 3.1 Endpoints do SOBRINHO (auth = magic-link JWT, `@Roles('DEBTOR')`, sob `TenantGuard`)
- `GET  /debtor/me/location/consent` → estado atual.
- `POST /debtor/me/location/consent` `{ state: 'GRANTED'|'DECLINED'|'REVOKED', consentText? }`
  - `DECLINED`/`REVOKED` quando recusa/desliga; `GRANTED` no opt-in.
  - Em `DECLINED` → cria evento + **notifica o padrinho** (§5).
- `POST /debtor/me/location/ping` `{ points: [{lat,lng,accuracy,battery,recordedAt}] }` (lote)
  - Só aceita se `consent.state === 'GRANTED'` (senão 403/ignora).
  - Atualiza `DebtorPosition` (upsert) + insere em `LocationPing` + avalia geofences → `GeofenceEvent`.

### 3.2 Endpoints do PADRINHO (auth Supabase, `@Roles('CREDITOR')`, `TenantGuard`)
- `GET /location/positions` → última posição de **cada devedor `GRANTED`** do tenant (alimenta o mapa).
- `GET /location/debtors/:id/history?from&to` → trajeto (paginado, da `LocationPing`).
- `GET /location/debtors/:id/consent` → estado/última atualização.
- `GET /location/geofences` · `POST /location/geofences` · `DELETE /location/geofences/:id`.
- (admin/super-admin herda via RolesGuard se necessário.)

### 3.3 Serviço
- `LocationService` implementa os ports `LocationProvider`/`LocationHistory` dos contratos.
- Tudo dentro de `withTenant(tenantId)` (RLS + escopo por código, como o resto).
- Geofencing: ao gravar ping, compara com `Geofence` do tenant (Haversine) e gera `ARRIVAL`/`DEPARTURE`
  comparando com o último estado conhecido daquele devedor×cerca.

### 3.4 Retenção
- `RetentionScheduler` ganha a poda de `LocationPing` e `GeofenceEvent` além de
  `LOCATION_RETENTION_DAYS` (default 30), **por tenant** (RLS — mesmo padrão do soft-delete).

---

## 4. App do SOBRINHO (Capacitor — nativo)

Telas (a tab bar e a aba de Localização **não** entraram no reskin de 2026-06-30 — entram aqui):
- **Tab bar (2 abas):** `Sua ajuda` (a tela atual, já reskinada) + `Localização`.
- **Opt-in (1º uso):** tela explicando o compartilhamento voluntário → botão **"Compartilhar localização"**
  (pede permissão do SO) ou **"Agora não"** (→ `DECLINED`, notifica padrinho). Tom calmo, sem pressão.
- **Aba Localização:**
  - Estado **ON** (GRANTED): card "Compartilhando minha localização" (verde, pulso), mapa com a própria posição,
    e o aviso de que **só o padrinho** vê. Botão de desligar **leva às Configurações** (regra #3).
  - Estado **OFF/permissão negada:** estado vazio amigável (sem urgência) + "Abrir Configurações".
- **Configurações:** o **único** lugar com o toggle de desligar (revoga → `REVOKED`, para os pings).
- Captura: plugin de background geolocation → buffer local → `POST .../ping` em lote (ex.: a cada 1–5 min,
  ou por deslocamento mínimo). Respeita bateria (distância mínima, intervalo adaptativo).

Copy (do brief): "Compartilhar localização" (não "rastrear"), "Compartilhando" (não "ativo"),
"Última atualização" (não "última vez visto"). Verde = compartilhando; **nada de vermelho** na tela de localização.

---

## 5. Notificação ao padrinho (regra #4) — recusa de localização
Reusar o que já existe:
- Grava `PlatformEvent { type: 'LOCATION_CONSENT', detail: { state: 'DECLINED' }, actorType: 'DEBTOR' }`.
- Superfície para o padrinho: um **banner** no dashboard do padrinho (mesmo padrão do `PendingClaims` que já
  construímos) listando "Sobrinhos que recusaram compartilhar localização", e/ou uma entrada na lista de
  notificações do padrinho. (Decisão de UI a confirmar; o mecanismo é o mesmo já usado.)
- Idem opcional para `REVOKED` ("deixou de compartilhar"), se o padrinho quiser saber.

---

## 6. Painel do PADRINHO (web — substitui o `LocationPanel` inerte)
- **Mapa** (recomendo **Leaflet + OpenStreetMap** no MVP: grátis, sem chave; trocável por Mapbox/Google depois)
  com um marcador por devedor `GRANTED` (pulso), nome, "Última atualização há X".
- Lista lateral: devedores com **badge de consentimento** (Compartilhando / Recusou / Parou / Sem atualização).
- Por devedor: **histórico/trajeto** (linha no mapa), **geofences** (criar/remover), entradas/saídas.
- "Locais frequentes": derivados de clusters de pings (v2).
- Nunca mostra quem **não** consentiu.

---

## 7. Tempo real
- **MVP:** polling do `GET /location/positions` (30–60s) no painel + envio em lote do app. Simples, sem infra nova.
- **v2:** Supabase Realtime ou WebSocket/SSE para push de posição. (Liga com o item de escala/Redis do audit —
  não fazer antes de sair do estado in-memory single-instance.)

---

## 8. Riscos / bloqueios
- **Lojas (Apple/Google):** permissão de **localização em background ("Always")** exige justificativa clara na
  revisão e **política de privacidade publicada**; uso "de vigilância" é reprovado. O enquadramento
  **consentido/voluntário/revogável** é o que viabiliza a aprovação. Tratar cedo.
- **Bateria/precisão:** background geolocation drena bateria — usar distância mínima e intervalo adaptativo.
- **LGPD:** §0.2. Sem consentimento versionado + retenção + revogação, **não** coletar dado real.
- **Detecção de desinstalação:** impossível direto → usar heartbeat/staleness (§1.1).
- **Custo/volume:** pings são alto volume → retenção curta + índice por `(tenant, debtor, recordedAt)`.

---

## 9. Fases de entrega (ordem sugerida para implementar)
**Fase 1 — Backend de consentimento + posição (validável 100% neste repo, sem device):**
1. Schema + migration + RLS (`LocationConsent`, `DebtorPosition`, `LocationPing`, `Geofence`, `GeofenceEvent`)
   + `LOCATION_CONSENT` no enum + shared type.
2. Registrar `LocationModule` no `AppModule`; `LocationService` + endpoints do sobrinho e do padrinho.
3. Notificação ao padrinho na recusa (PlatformEvent + banner, padrão `PendingClaims`).
4. Retenção de pings no `RetentionScheduler`. Testes unitários (consent state machine, ping gating, geofence).

**Fase 2 — Painel do padrinho (web):**
5. Mapa Leaflet + posições ao vivo (polling) + badges de consentimento + histórico/trajeto + geofences.
6. Substituir o `LocationPanel` placeholder.

**Fase 3 — App do sobrinho (Capacitor nativo):**
7. Decisão de plataforma (§0.1) + plugin de background geolocation.
8. Tab bar + opt-in + aba Localização + Configurações (desligar) + envio de pings em lote.
9. Texto de consentimento versionado + política de privacidade.

**Fase 4 — v2:** tempo real (Realtime/WS), locais frequentes, refinamentos de bateria.

> Trabalhar em **branch de feature** (existe `feat/geo-module` com um protótipo isolado — avaliar reaproveitar
> ou recomeçar limpo sobre o core atual). Não mexer na `main` (deploy automático).
