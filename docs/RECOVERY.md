# RECOVERY — recuperar o Pacific do zero (perda da máquina)

Objetivo: colocar o projeto de volta em uma máquina nova, ou reconstruir produção, **sem depender de
uma única cópia local**. Complementa `DR_RUNBOOK.md` (foco em banco/Supabase).

## Onde vive cada coisa (nunca só na máquina)
| Ativo | Fonte de verdade | Backup |
|---|---|---|
| Código | GitHub `integradatta/pacific` (`main`) | clones locais + o próprio GitHub |
| Histórico/decisões | commits + PRs + `docs/HANDOFF.md` | GitHub |
| Migrações do banco | `packages/database/migrations/` (versionado) | GitHub |
| Dados de produção | Supabase (Postgres) | backups do Supabase (ver `DR_RUNBOOK.md`) |
| Segredos (envs) | Railway (API) + Vercel (web) + gerenciador de senhas | **NÃO** no git (repo público) |
| Chaves VAPID / keystore Android | gerenciador de senhas / handoff local | — |

> ⚠️ O repositório é **público** — nenhum segredo é versionado. Os valores reais das envs ficam nos
> dashboards de deploy (Railway/Vercel/Supabase) e num gerenciador de senhas. Guarde-os lá **antes** de
> qualquer incidente.

## 1. Recuperar o código (máquina nova)
```bash
git clone https://github.com/integradatta/pacific.git
cd pacific
nvm use            # versão em .nvmrc (Node >=20)
npm ci
npm run db:generate
```

## 2. Restaurar as variáveis de ambiente
1. Copie `.env.example` → `.env` (raiz/API) e `apps/web/.env.local` (web).
2. Preencha com os valores de:
   - **Railway** (API): `DATABASE_URL`, `APP_JWT_SECRET`, `SUPABASE_*`, `REDIS_URL`, `WEB_ORIGIN`,
     `VAPID_*`, `RLS_STRICT=on`, `SENTRY_DSN`.
   - **Vercel** (web): `NEXT_PUBLIC_*`.
   - **Supabase** → `packages/database/.env` com `DIRECT_URL` (conexão dona, só para migrações/RLS).
3. Sem o valor num dashboard? Regerar: `APP_JWT_SECRET` (`openssl rand -base64 48`) e VAPID
   (`npx web-push generate-vapid-keys`) — trocar invalida sessões/subscriptions existentes.

## 3. Restaurar o banco
Produção segue no Supabase — normalmente **não** precisa restaurar. Para um ambiente novo ou desastre,
ver `DR_RUNBOOK.md`. Em resumo: provisionar Postgres → aplicar `migrations/` em ordem no SQL Editor
(ou `npm run db:release` com `DIRECT_URL`) → `npm run db:rls` → confirmar `RLS_STRICT`.

## 4. Redeploy
- **API (Railway):** conectar ao repo, setar envs, deploy. Conferir no log: `RLS verificada… (FORCE)` +
  `GET /health/ready` = 200. Detalhes e ordem de migração em `DEPLOY_RUNBOOK.md`.
- **Web (Vercel):** conectar ao repo, setar `NEXT_PUBLIC_*`, deploy.
- **Mobile:** ver `apps/mobile/DEPLOY_MOBILE.md` (roda no Mac; keystore no gerenciador de senhas).

## 5. Garantir redundância (fazer periodicamente)
- Manter ao menos **2 clones** do repo (máquina + GitHub já garante o remoto).
- Confirmar que os **backups automáticos do Supabase** estão ativos (Point-in-Time Recovery no plano pago).
- Exportar as envs do Railway/Vercel para o gerenciador de senhas após qualquer mudança.
- Tags de versão (`git tag`) marcam pontos de restauração conhecidos — ver histórico com `git tag`.
