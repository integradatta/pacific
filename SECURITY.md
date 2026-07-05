# Política de Segurança — Pacific

## Reportar uma vulnerabilidade
Encontrou uma falha de segurança? **Não abra uma issue pública.** Envie um e-mail para
**raylanborgescont@gmail.com** com:
- descrição da vulnerabilidade e impacto potencial;
- passos para reproduzir (PoC, se possível);
- versão/commit afetado.

Responderemos o mais rápido possível e coordenaremos a correção e a divulgação.

## Escopo
Aplicam-se: `packages/api` (backend), `apps/web` (portal/app), `packages/database` (RLS/migrações).
Fora de escopo: dependências de terceiros (reporte upstream), engenharia social, DoS volumétrico.

## Postura de segurança (resumo)
- **Isolamento por tenant:** RLS `FORCE` no Postgres + healthcheck fail-closed no boot (`RLS_STRICT`).
- **Auth:** Supabase (credor/admin, JWT assimétrico via JWKS) + magic link do devedor (HS256, algoritmo
  fixado). Tokens de link são armazenados **hasheados**. Sessões revogáveis (versão do link).
- **Entrada:** `ValidationPipe` estrito (whitelist + forbid non-whitelisted) + limite de body.
- **Injeção:** Prisma parametriza 100% das queries (sem SQL raw em input de usuário). Sem upload de arquivos.
- **Transporte/headers:** helmet + CORS com origem obrigatória em produção.
- **Abuso:** throttler global por IP com storage Redis (correto entre réplicas) + limite estrito no redeem.
- **Logs:** redigidos (`common/log-sanitize.ts`) — nunca vazam segredo/PII. Erros no Sentry.
- **Segredos:** nunca versionados (repo público). Ficam em Railway/Vercel/Supabase + gerenciador de senhas.

Referências: OWASP Top 10, OWASP ASVS. Ver `docs/RLS_RUNBOOK.md` e `CLAUDE.md`.
