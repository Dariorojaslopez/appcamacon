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

docker-compose run --rm app npx prisma migrate deploy
