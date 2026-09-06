#!/usr/bin/env bash
set -euo pipefail

environment="${1:-}"
if [[ "$environment" != "staging" && "$environment" != "production" ]]; then
  echo "Usage: ./scripts/deploy-vps.sh staging|production" >&2
  exit 2
fi

env_file=".env.${environment}"
if [[ ! -f "$env_file" ]]; then
  echo "Missing $env_file on the VPS" >&2
  exit 2
fi

project="estudio-${environment}"
docker compose --project-name "$project" --env-file "$env_file" \
  -f compose.yaml -f compose.vps.yaml config --quiet
docker compose --project-name "$project" --env-file "$env_file" \
  -f compose.yaml -f compose.vps.yaml pull
docker compose --project-name "$project" --env-file "$env_file" \
  -f compose.yaml -f compose.vps.yaml up -d --remove-orphans
docker compose --project-name "$project" --env-file "$env_file" \
  -f compose.yaml -f compose.vps.yaml ps
