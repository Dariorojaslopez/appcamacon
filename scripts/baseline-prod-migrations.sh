#!/usr/bin/env bash
# Marca migraciones como ya aplicadas SIN ejecutar su SQL (solo si el esquema real ya coincide).
#
# Uso manual en el servidor:
#   BASELINE=partial bash scripts/baseline-prod-migrations.sh
#   BASELINE=all     bash scripts/baseline-prod-migrations.sh
#
# partial — Típico tras P3005: la BD se creó con `db push` o sin `_prisma_migrations`, y ya tiene
#           el esquema hasta antes de presupuesto jerárquico. Marca las 4 primeras migraciones y
#           deja que `migrate deploy` ejecute solo la de BudgetChapter / subchapterId.
# all     — La BD ya incluye tablas de presupuesto (BudgetChapter, etc.); marca las 5 migraciones.
#
# Invocado con BASELINE_MODE por apply-prod-migrations.sh (mismo significado que BASELINE).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

MODE="${BASELINE_MODE:-${BASELINE:-}}"
if [ -z "$MODE" ]; then
  echo "Defina BASELINE=partial o BASELINE=all (ver comentarios en este script)." >&2
  exit 1
fi

docker-compose up -d postgres
for i in $(seq 1 30); do
  if docker-compose exec -T postgres pg_isready -U admin -d appdb >/dev/null 2>&1; then
    break
  fi
  [ "$i" -eq 30 ] && echo "Postgres no listo." >&2 && exit 1
  sleep 1
done

run_resolve() {
  docker-compose run --rm app npx prisma migrate resolve --applied "$1"
}

M1="20260416145747_add_calidad_imagen_url"
M2="20260416173000_add_actividad_observacion_texto"
M3="20260416190000_add_item_detail_fields"
M4="20260416200000_add_item_cantidad"
M5="20260511120000_budget_chapters_hierarchy"

case "$MODE" in
  partial)
    run_resolve "$M1"
    run_resolve "$M2"
    run_resolve "$M3"
    run_resolve "$M4"
    docker-compose run --rm app npx prisma migrate deploy
    ;;
  all)
    run_resolve "$M1"
    run_resolve "$M2"
    run_resolve "$M3"
    run_resolve "$M4"
    run_resolve "$M5"
    docker-compose run --rm app npx prisma migrate deploy
    ;;
  *)
    echo "BASELINE debe ser partial o all (recibido: $MODE)" >&2
    exit 1
    ;;
esac
