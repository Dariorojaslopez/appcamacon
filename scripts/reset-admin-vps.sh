#!/usr/bin/env bash
# Ejecutar EN EL SERVIDOR VPS (donde corre docker-compose de producción).
# Uso:
#   bash scripts/reset-admin-vps.sh 900452410 'NuevaClaveSegura123'
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ID="${1:-900452410}"
PASS="${2:-}"

if [ -z "$PASS" ]; then
  echo "Uso: bash scripts/reset-admin-vps.sh <identificacion> '<nueva_contraseña>'" >&2
  exit 1
fi

docker-compose exec -T app node scripts/unlock-user.mjs "$ID" --password="$PASS"
echo "Listo. Pruebe el login en https://appinformediario.camacon.com.co"
