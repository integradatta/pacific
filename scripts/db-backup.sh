#!/usr/bin/env bash
# Backup LÓGICO do banco (pg_dump) — funciona em QUALQUER plano do Supabase (não precisa de Pro/PITR).
# Usa DIRECT_URL (conexão DONA, porta 5432 — o pooler 6543 não serve p/ dump). Gera um .sql.gz com timestamp.
#
# ⚠️ O dump contém TODOS os dados (PII). NUNCA versione no repositório público — guarde em local
#    privado/cifrado (bucket, disco externo, gerenciador). Ver docs/BACKUP.md.
#
# Uso:
#   DIRECT_URL="postgresql://postgres:...@db.<ref>.supabase.co:5432/postgres" npm run db:backup
#   (ou export DIRECT_URL e rode: bash scripts/db-backup.sh)
set -euo pipefail

: "${DIRECT_URL:?defina DIRECT_URL (conexão dona do Supabase, porta 5432)}"

OUT_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$OUT_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
FILE="$OUT_DIR/pacific-${STAMP}.sql.gz"

command -v pg_dump >/dev/null 2>&1 || {
  echo "✗ pg_dump não encontrado. Instale o client do Postgres (>= v15):" >&2
  echo "    macOS:  brew install libpq && brew link --force libpq" >&2
  echo "    Debian: apt-get install postgresql-client-16" >&2
  exit 127
}

echo "→ Gerando dump em ${FILE} …"
# --no-owner/--no-privileges: portável entre projetos. --clean/--if-exists: restaura sobrescrevendo.
pg_dump "$DIRECT_URL" --no-owner --no-privileges --clean --if-exists --quote-all-identifiers \
  | gzip -9 > "$FILE"

SIZE="$(du -h "$FILE" | cut -f1)"
echo "✓ Backup concluído: ${FILE} (${SIZE})"
echo "  Restaurar:  gunzip -c ${FILE} | psql \"\$DIRECT_URL\""
