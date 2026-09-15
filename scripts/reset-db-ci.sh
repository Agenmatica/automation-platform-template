#!/usr/bin/env bash
# Reinicia el esquema de la base local de Supabase para el job `database` de
# CI: dropea `public`/`private` y reaplica todas las migraciones + seed.sql,
# en orden, conectando por host.docker.internal (ver docs/deployment.md).
#
# No usa `supabase db reset`/`supabase start`: en el runner self-hosted,
# 127.0.0.1 desde el contenedor del job es el contenedor mismo, no el host
# donde corre Supabase, así que un `db reset` local no conecta. Apuntar
# `--db-url` a host.docker.internal sí conecta, pero el CLI lo trata como
# una base "remota" — probado a mano, ese modo no reinicializa el esquema
# con la misma confiabilidad y dejó políticas de RLS mal resueltas.
# `psql` directo sí funciona igual que en test:db:ci, así que se reusa ese
# mecanismo para reaplicar exactamente las mismas migraciones que ya
# corrieron en el checkout, sin depender del CLI para esta parte.
set -euo pipefail

cd "$(dirname "$0")/.."

psql_ci() {
  PGPASSWORD=postgres PGSSLMODE=disable psql \
    --host host.docker.internal --port "${SUPABASE_DB_PORT:-5434}" \
    --username postgres --dbname postgres \
    --set ON_ERROR_STOP=1 --quiet "$@"
}

psql_ci -c 'drop schema if exists public cascade; drop schema if exists private cascade; create schema public;'

for migracion in supabase/migrations/*.sql; do
  echo "Aplicando $migracion..."
  psql_ci -f "$migracion"
done

echo "Sembrando supabase/seed.sql..."
psql_ci -f supabase/seed.sql
