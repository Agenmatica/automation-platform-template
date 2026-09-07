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

for product in kestra superset playwright; do
  compose_base="infra/${product}/compose.yaml"
  compose_vps="infra/${product}/compose.vps.yaml"
  project="platform-${environment}-${product}"

  docker compose --project-name "$project" --env-file "$env_file" \
    -f "$compose_base" -f "$compose_vps" config --quiet
  docker compose --project-name "$project" --env-file "$env_file" \
    -f "$compose_base" -f "$compose_vps" pull
  docker compose --project-name "$project" --env-file "$env_file" \
    -f "$compose_base" -f "$compose_vps" up -d --remove-orphans
  docker compose --project-name "$project" --env-file "$env_file" \
    -f "$compose_base" -f "$compose_vps" ps
done
