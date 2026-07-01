# Runbook — Backup & Disaster Recovery (A2)

> Objetivo: ter **RPO/RTO definidos** e um **restore testado** — não confiar em "tem backup" sem
> nunca ter restaurado. Banco: PostgreSQL gerenciado (Supabase). Migrations versionadas no repo.

## Metas (propostas)
- **RPO** (perda máxima aceitável): ≤ 5 min com PITR (plano Supabase Pro+); ou ≤ 24h só com backup diário.
- **RTO** (tempo p/ voltar): ≤ 1h (restore PITR + redeploy).

## Camadas de proteção
1. **Backup gerenciado do Supabase** (automático). Verifique o plano: *Dashboard → Database → Backups*.
   - Plano **Pro+**: ativa **PITR (Point-in-Time Recovery)** — confirme que está LIGADO.
   - Plano Free: apenas backup diário (RPO de até 24h). Para produção real, subir para Pro+.
2. **Backup lógico próprio** (belt-and-suspenders): `packages/database/scripts/backup.sh`
   - `DIRECT_URL=postgres://... ./packages/database/scripts/backup.sh` → gera `pacific-<ts>.dump`.
   - Guarde os dumps fora do Supabase (ex.: storage/objeto). Rode **antes de toda migration destrutiva**.
3. **Migrations versionadas** (Git) + `prisma migrate deploy` no boot que **aborta** se a migration falhar
   (o container não sobe quebrado). `rls.sql` também versionado.

## Antes de uma migration arriscada (destrutiva)
1. Rode `backup.sh` (dump lógico) e guarde o arquivo.
2. (Pro+) anote o timestamp atual para PITR.
3. Aplique a migration. Se algo der errado → ver "Restaurar" abaixo.

## Restaurar
### Opção A — PITR (Supabase Pro+) — preferida
1. *Dashboard → Database → Backups → Point in Time* → escolha o instante (logo antes do incidente).
2. Confirme o restore (cria um novo estado do banco).
3. Atualize `DATABASE_URL`/`DIRECT_URL` se o host mudar; **redeploy** a API.

### Opção B — Restaurar de um dump lógico
```bash
pg_restore --clean --if-exists --no-owner -d "$DIRECT_URL" pacific-<timestamp>.dump
psql "$DIRECT_URL" -f packages/database/src/rls.sql   # reaplica as policies RLS, se necessário
```

## ✅ Teste de restore (FAZER UMA VEZ — vira "DR comprovado")
1. Crie um **projeto Supabase de teste** (ou um banco descartável).
2. Rode `backup.sh` no banco real → gere um `.dump`.
3. `pg_restore` o dump no banco de teste (Opção B). Confirme contagens (`SELECT count(*) FROM "Debt";`, etc.).
4. Aponte uma instância local da API para o banco de teste e faça um smoke (login, dashboard).
5. Anote tempo gasto = seu **RTO real**. Documente a data do último teste.

## Checklist de go-live
- [ ] PITR confirmado LIGADO (ou aceitar RPO de 24h e documentar).
- [ ] `backup.sh` rodado com sucesso ao menos uma vez (dump guardado fora do Supabase).
- [ ] **Restore testado** num banco descartável (passos acima) — data: ____________.
- [ ] Hábito: `backup.sh` antes de cada migration destrutiva.
