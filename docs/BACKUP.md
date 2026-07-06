# BACKUP do banco — sem Supabase Pro

O plano Pro dá backup **gerenciado** (diário + PITR). **Sem ele, você faz backup lógico com `pg_dump`** —
funciona em qualquer plano. Este doc cobre as duas formas + restauração. Complementa `RECOVERY.md`.

> 🔴 **REGRA DE OURO:** o dump contém **todos os dados (PII)**. O repositório é **PÚBLICO** →
> **NUNCA** commite um dump, e **NUNCA** o suba como *artifact* de workflow (artifacts de repo público são
> baixáveis por qualquer um). Guarde só em **destino privado** (bucket com credenciais, disco cifrado).
> O `.gitignore` já bloqueia `backups/`, `*.sql.gz` e `*.dump`.

## O que preciso
- `pg_dump` **≥ 15** (o Supabase roda PG15). Instale o client do Postgres:
  - macOS: `brew install libpq && brew link --force libpq`
  - Debian/Ubuntu: `apt-get install postgresql-client-16`
- `DIRECT_URL` (conexão **dona**, porta 5432) — já está em `packages/database/.env`.

## Opção A — local, manual/agendado (mais simples)
```bash
export DIRECT_URL="postgresql://postgres:...@db.<ref>.supabase.co:5432/postgres"
npm run db:backup          # gera ./backups/pacific-<timestamp>.sql.gz
```
Guarde o `backups/` num local **privado e redundante** (iCloud/Drive cifrado, HD externo).
Automatize com `cron` (Linux) ou `launchd` (macOS), ex. diário às 3h:
```cron
0 3 * * *  cd /caminho/pacific && DIRECT_URL="..." npm run db:backup
```

## Opção B — automático no GitHub Actions (sem depender da sua máquina)
O runner já tem `pg_dump`. Faz o dump e envia para um **bucket privado S3-compatível**
(Cloudflare R2 / Backblaze B2 têm free tier). **Não** usa artifact (repo público).

1. Crie um bucket **privado** e uma credencial S3.
2. Em **Settings → Secrets and variables → Actions**, adicione:
   `DIRECT_URL`, `S3_ENDPOINT`, `S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`.
3. Crie `.github/workflows/db-backup.yml` (cole via UI — precisa de escopo `workflow`):

```yaml
name: DB Backup
on:
  schedule: [{ cron: '0 6 * * *' }]   # diário 06:00 UTC
  workflow_dispatch:
jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - name: Instalar pg_dump 16
        run: |
          sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
          curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo gpg --dearmor -o /etc/apt/trusted.gpg.d/pgdg.gpg
          sudo apt-get update && sudo apt-get install -y postgresql-client-16 awscli
      - name: Dump + upload (bucket privado)
        env:
          DIRECT_URL: ${{ secrets.DIRECT_URL }}
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        run: |
          F="pacific-$(date +%Y%m%d-%H%M%S).sql.gz"
          pg_dump "$DIRECT_URL" --no-owner --no-privileges --clean --if-exists --quote-all-identifiers | gzip -9 > "$F"
          aws s3 cp "$F" "s3://${{ secrets.S3_BUCKET }}/$F" --endpoint-url "${{ secrets.S3_ENDPOINT }}"
```
> Dica: ative **versionamento + regra de retenção** (ex.: manter 30 dias) no bucket → histórico de backups.

## Opção C — interina, sem `pg_dump` (só dados, via Prisma)
Quando não há `pg_dump` na máquina, dá para capturar **os dados** (não o schema) via Node — a role
`postgres` do `DIRECT_URL` tem `BYPASSRLS` e lê todos os tenants:
```bash
npm run db:backup:json     # → ./backups/pacific-data-<timestamp>.json
```
Gera um JSON com todas as tabelas. **Não substitui o pg_dump** (sem DDL/sequences — o schema vive nas
`migrations/` versionadas), mas garante que **os dados existem fora do Supabase** hoje. Restauração:
recriar o schema (aplicar `migrations/` + `db:rls`) e reinserir os dados do JSON (respeitando a ordem de FKs).

## Restaurar
```bash
gunzip -c backups/pacific-<timestamp>.sql.gz | psql "$DIRECT_URL"
```
Para um banco novo/limpo, aplique o dump e depois `npm run db:rls` (garante as policies). Ver `RECOVERY.md`.

## Recomendação
Comece pela **Opção A** hoje (1 dump manual já te dá uma cópia). Configure a **Opção B** quando quiser
automação sem depender do seu Mac. Migrar para o Pro depois só **adiciona** o PITR — não substitui ter
dumps próprios fora do Supabase (regra de "nunca uma cópia só").
