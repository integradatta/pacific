#!/usr/bin/env bash
# Backup lógico (pg_dump) — belt-and-suspenders além do backup gerenciado do Supabase (A2).
# Uso:  DIRECT_URL=postgres://... ./backup.sh        (ou passe a URL como 1º argumento)
# Gera um dump comprimido (formato custom) com timestamp UTC. Requer pg_dump (postgresql-client).
set -euo pipefail

URL="${1:-${DIRECT_URL:-${DATABASE_URL:-}}}"
if [ -z "$URL" ]; then
  echo "ERRO: defina DIRECT_URL (conexão de sessão) ou passe a URL como argumento." >&2
  exit 1
fi

OUT="pacific-$(date -u +%Y%m%dT%H%M%SZ).dump"
echo "[backup] gerando ${OUT} ..."
pg_dump "$URL" --format=custom --no-owner --no-privileges --file "${OUT}"
echo "[backup] OK → ${OUT}"
echo "[restore] pg_restore --clean --if-exists --no-owner -d \"\$URL\" ${OUT}"
