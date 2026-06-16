# Pacific — Design / Especificação

**Data:** 2026-06-16
**Status:** aprovado para implementação (formato com localização simulada)
**Natureza:** projeto acadêmico fictício. Escala pequena (~30 credores, ~30 devedores).

---

## 1. Visão

Pacific é uma plataforma **premium de monitoramento e gestão de empréstimos privados** — não um sistema de cobrança. O credor cadastra dívidas e o sistema automatiza cálculos, juros, vencimentos, alertas, priorização e visualização da saúde da carteira, reduzindo ao máximo o trabalho manual.

Dois ambientes:

- **Portal Web do Credor** — multi-tenant; cada credor só vê seus próprios dados.
- **App Mobile do Devedor** — o devedor acompanha a própria dívida, evolução, vencimentos, projeções e notificações.

Fora de escopo (por decisão de produto): chat, negociação, parcelamento, CRM, propostas.

---

## 2. Decisão de design crítica — Módulo de Localização (SIMULADO)

O módulo de localização é implementado como **simulação com dados sintéticos**, não como rastreamento real de pessoas:

- O app mobile **não captura nem transmite GPS real** do dono do dispositivo para o credor.
- As posições, rotas, locais frequentes, status online/offline, bateria e linha do tempo são **geradas pelo backend** (seed + simulador de movimento) para devedores fictícios.
- O fluxo de **consentimento** (opt-in voluntário, revogável, com registro de auditoria) é implementado de verdade como UX/feature, operando sobre os dados simulados.
- Todo o front-end (mapa em tempo real via WebSocket, heat map por urgência, locais salvos, alertas de chegada/saída, timeline, indicadores operacionais, painel de localização do credor) é construído integralmente, alimentado pelo simulador.

**Motivo:** preserva 100% das competências técnicas avaliáveis (Mapbox GL, React Native Maps, realtime, geoviz) e a experiência "centro de comando", sem produzir uma ferramenta operacional de vigilância de pessoas reais. É também mais reprodutível e sem PII real — adequado a um projeto acadêmico.

---

## 3. Arquitetura

Monorepo **Turborepo** com a estrutura de pastas definida no briefing:

```
Pacific/
├── apps/web        → Next.js 14 (App Router, TS estrito) — portal do credor
├── apps/mobile     → React Native + Expo SDK 51 — app do devedor
├── packages/api    → NestJS (auth, tenants, debts, financial-engine,
│                     alerts, notifications, location, scores)
├── packages/database → Prisma schema, migrations, seed
└── packages/shared  → tipos e utils compartilhados (financial, date, location)
```

### Stack (fixa, conforme briefing)

- **Web:** Next.js 14, Tailwind + shadcn/ui, TanStack Query v5, Recharts, Mapbox GL JS, Zustand.
- **Mobile:** React Native + Expo SDK 51, Expo Location (apenas para o app do próprio devedor / consentimento; sem envio ao credor), React Native Maps, Expo Notifications.
- **Backend:** NestJS, Prisma, PostgreSQL (Supabase), Socket.io, BullMQ (Redis), node-cron.
- **Infra:** Supabase (DB/Auth/Storage/RLS), OneSignal (push), Mapbox, Vercel (web), Expo EAS (mobile), Docker (dev local).

### Multi-tenancy

- **Tenant = Credor.** Toda entidade de negócio carrega `tenantId`.
- Isolamento em duas camadas: (1) escopo obrigatório por `tenantId` em todos os queries/guards do NestJS; (2) **Row-Level Security** no Supabase com policies por tenant.
- Auth via **Supabase Auth**. JWT com claim de `tenantId` (credor) ou vínculo de devedor. Guards no NestJS validam tenant em cada request.

---

## 4. Modelo de dados (entidades principais)

- **Tenant** — o credor (carteira). Possui `walletCode` único.
- **User** — conta de acesso (role: `CREDITOR` | `DEBTOR`), vinculada a Supabase Auth.
- **Debtor** — pessoa devedora (pertence a um tenant). Pode ter um `User` mobile vinculado.
- **Debt** — dívida: principal, taxa, data de início, vencimento, status, moeda. Pertence a tenant + devedor.
- **LedgerEntry** — histórico financeiro (lançamentos: acréscimo de juros, pagamento, ajuste).
- **DebtSnapshot** — evolução diária (saldo, juros acumulados) para gráficos.
- **Alert** — alertas gerados (tipo, destinatário, canal, status de envio).
- **Notification** — registro de notificações enviadas (central de notificações).
- **LocationConsent** — registro de consentimento (estado, timestamps, auditoria).
- **LocationPing** — posição simulada (lat, lng, timestamp, bateria, online, accuracy).
- **SavedPlace** — locais salvos (casa/trabalho/outros) — simulados.
- **GeoEvent** — eventos de chegada/saída (timeline de movimentação).
- **Score** — recuperabilidade e temperatura por dívida (snapshot recalculável).

Enums: `DebtStatus` (semáforo), `AlertType`, `UserRole`, `ConsentState`, `LedgerEntryType`.

---

## 5. Motor financeiro

- **Decimal.js** em todos os valores monetários — nunca float.
- **Juros compostos.** Taxa armazenada como taxa ao mês (`ratePerMonth`). Saldo atualizado:
  `saldo(t) = principal × (1 + i)^(diasCorridos/30)`, com `i = ratePerMonth`, calculado com Decimal.js e arredondamento monetário (2 casas) só na borda de apresentação.
- **Juros acumulados** = `saldo(t) − principal`.
- **Dias restantes** = `vencimento − hoje` (negativo ⇒ dias em atraso).
- **Projeções** para horizontes hoje / 30 / 90 / 180 / 365 dias (mesma fórmula com `t` futuro).
- **Evolução** = série de `DebtSnapshot` (recalculável a partir dos parâmetros, determinística).

### Semáforo de status

- 🟢 **Verde:** mais de 30 dias até o vencimento.
- 🟡 **Amarelo:** 30 dias ou menos.
- 🟠 **Laranja:** 7 dias ou menos.
- 🔴 **Vermelho:** vencido.

### Score de Recuperabilidade (0–100)

Potencial de recuperação. Combinação ponderada (determinística, documentada no código):
- proporção principal/saldo (quanto maior o saldo sobre o principal, menor) ;
- dias em atraso (mais atraso ⇒ menor);
- histórico de pagamentos no ledger (pagamentos parciais ⇒ maior);
- tempo de relacionamento. Normalizado para 0–100.

### Score de Temperatura (0–100)

Urgência temporal: função decrescente de `diasRestantes` (vencido ⇒ próximo de 100; muito longe ⇒ próximo de 0), com degraus alinhados ao semáforo.

---

## 6. Backend, realtime e automação

- **APIs REST** (NestJS) para todos os recursos, com **class-validator** em todas as entradas e tratamento de erro padronizado (filtro global, formato de erro único).
- **WebSocket (Socket.io):** namespaces por tenant; emite atualizações de carteira, scores e posições simuladas em tempo real.
- **BullMQ (Redis):** filas para cálculo de snapshots/scores e para disparo de alertas.
- **node-cron:** agenda recálculo diário e varredura de vencimentos.
- **Alertas** (credor e devedor): 30 / 15 / 7 / 3 / 1 dia, vencimento e atraso. Geram `Alert` + `Notification`; push via **OneSignal** (chaves opcionais — degrada para registro interno se ausentes).
- **Simulador de localização:** job periódico move os `LocationPing` dos devedores fictícios e emite via WebSocket; gera `GeoEvent` (chegada/saída) ao cruzar `SavedPlace`.

---

## 7. Portal Web do Credor (telas)

`(auth)` login/register · `dashboard` (torre de controle + KPIs) · `portfolio` (heat map de cards) · `portfolio/[id]` (painel individual do caso) · `control-tower` · `alerts` (radar de vencimentos + central de notificações) · `location` (mapa em tempo real de todos os devedores, cores/urgência, painel de localização).

Padrões: loading / empty / error states em todas as telas; responsivo; estética de centro de comando (não-CRM); gráficos Recharts; mapa Mapbox GL.

## 8. App Mobile do Devedor (telas)

`(auth)` · `debt` (valor atual, vencimento, dias restantes, status, histórico, projeções) · `notifications` (central) · `location` (consentimento opt-in voluntário/revogável, status de compartilhamento, permissões ativas, histórico de consentimento — sobre dados simulados).

---

## 9. Plano de fases (ordem de execução)

1. **Fase 1** — Setup monorepo, schema do banco, autenticação e multi-tenancy (+ RLS).
2. **Fase 2** — Motor financeiro: saldo, juros, projeções, scores, semáforo.
3. **Fase 3** — Backend: REST, WebSocket, jobs BullMQ/cron, alertas, simulador de localização.
4. **Fase 4** — Portal web do credor: telas, dashboards, heat map, torre de controle, mapa.
5. **Fase 5** — App mobile do devedor: telas, notificações, consentimento de localização.

Cada fase só avança após a anterior concluída. Entregáveis transversais (seed realista, docker-compose, `.env.example`, README) acompanham as fases.

---

## 10. Padrões de qualidade (obrigatórios)

- TypeScript **estrito**, **proibido `any`**.
- Validação de entrada em todos os endpoints (class-validator).
- RLS no Supabase + escopo de tenant no NestJS — isolamento total entre credores.
- Tratamento de erro padronizado.
- Decimal.js para todo valor monetário.
- Loading / empty / error states em todas as telas; web responsivo.
- Estética premium, nenhuma tela com cara de CRM tradicional.

---

## 11. Decisões técnicas assumidas (autonomia)

- Taxa de juros interpretada como **ao mês**, capitalização composta diária fracionada.
- Auth única via Supabase; papel diferencia portal (credor) de app (devedor).
- Redis necessário para BullMQ — incluído no docker-compose.
- OneSignal e Mapbox por variáveis de ambiente; ausência degrada graciosamente (push vira log interno; mapa exige token para render).
- Localização 100% simulada (Seção 2).
- Docker não está instalado na máquina atual: `docker-compose.yml` é entregue, mas subir o stack local depende de instalar o Docker; o caminho oficial de DB é o Supabase.
