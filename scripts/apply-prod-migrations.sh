#!/usr/bin/env bash
# Ejecutar en el servidor una vez por despliegue (p. ej. desde CI/CD).
# Aplica migraciones pendientes contra la BD configurada en .env del compose.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

docker-compose build app
docker-compose up -d postgres

for i in $(seq 1 40); do
  if docker-compose exec -T postgres pg_isready -U admin -d appdb >/dev/null 2>&1; then
    break
  fi
  if [ "$i" -eq 40 ]; then
    echo "Postgres no respondió a tiempo (pg_isready)." >&2
    exit 1
  fi
  sleep 1
done

LOG="$(mktemp)"
trap 'rm -f "$LOG"' EXIT

set +e
docker-compose run --rm app npx prisma migrate deploy 2>&1 | tee "$LOG"
EC="${PIPESTATUS[0]}"
set -e

if [ "$EC" -eq 0 ]; then
  exit 0
fi

if grep -q 'P3005' "$LOG"; then
  echo ""
  echo "==> Prisma P3005: la base ya tiene tablas pero no hay historial en _prisma_migrations."
  echo "    Se marcan como aplicadas las cuatro primeras migraciones (esquema previo al presupuesto)"
  echo "    y luego migrate deploy aplica solo la migración de capítulos/subcapítulos si falta."
  echo "    Si falla por columnas/tablas duplicadas, en el servidor ejecute UNA VEZ:"
  echo "      BASELINE=all bash scripts/baseline-prod-migrations.sh"
  echo ""
  BASELINE_MODE=partial bash "$ROOT/scripts/baseline-prod-migrations.sh"
  exit $?
fi

echo "migrate deploy falló (código $EC). Revise el log arriba." >&2
exit "$EC"
