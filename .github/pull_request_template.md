## O que muda
<!-- Descreva a mudança e o porquê (1–3 linhas). -->

## Tipo
- [ ] feat  - [ ] fix  - [ ] refactor  - [ ] chore/docs  - [ ] security

## Checklist
- [ ] `npm run lint` verde
- [ ] `npm run test` verde
- [ ] `npm run build` verde
- [ ] Sem segredos no diff (repo é público)
- [ ] Se mexeu em `schema.prisma`: migração **aditiva/idempotente** criada e citada no PR (aplicar ANTES do deploy — ver `docs/DEPLOY_RUNBOOK.md`)
- [ ] Se mexeu em RLS/tabela nova: `src/rls.sql` atualizado e `RLS_STRICT` considerado
- [ ] Se tocou no app do sobrinho (`/d`, `/me`): mantém white-label (sem "Pacific"/termos de dívida)

## Impacto no deploy
<!-- Migração? Nova env var? Passo manual? Se nada, escreva "nenhum". -->
