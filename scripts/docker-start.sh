#!/usr/bin/env sh
set -eu

echo "==> Aplicando migraciones de Prisma (migrate deploy)..."
npx prisma migrate deploy

echo "==> Iniciando aplicación..."
exec npm start
