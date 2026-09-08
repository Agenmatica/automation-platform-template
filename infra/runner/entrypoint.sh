#!/usr/bin/env bash
set -euo pipefail

: "${GH_PAT:?falta GH_PAT}"
: "${RUNNER_REPO:?falta RUNNER_REPO}"

# Sufijo con el hostname del contenedor (único por réplica en Docker) para
# poder escalar con `deploy.replicas` sin que dos réplicas choquen por
# registrarse con el mismo nombre en GitHub.
RUNNER_NAME="${RUNNER_NAME:-automation-platform-template-docker}-$(hostname)"
RUNNER_LABELS="${RUNNER_LABELS:-self-hosted,platform-local}"

# Los tokens de registro de GitHub expiran en ~1h, así que se piden en
# caliente en cada arranque del contenedor en vez de guardarlos.
fetch_token() {
  curl -fsSL -X POST \
    -H "Authorization: token ${GH_PAT}" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/${RUNNER_REPO}/actions/runners/registration-token" \
    | jq -r .token
}

# Si el contenedor murió sin pasar por el trap de cleanup de más abajo
# (crash, Docker Desktop/WSL reiniciando), queda un registro local de una
# corrida anterior que bloquea un config.sh nuevo ("already configured").
# Se limpia antes de reconfigurar en vez de dejar que el contenedor loopee.
if [ -f .runner ]; then
  echo "Registro previo sin desregistrar, limpiando..."
  ./config.sh remove --token "$(fetch_token)" || true
  rm -f .runner .credentials .credentials_rsaparams
fi

./config.sh --url "https://github.com/${RUNNER_REPO}" \
  --token "$(fetch_token)" \
  --name "$RUNNER_NAME" \
  --work _work \
  --labels "$RUNNER_LABELS" \
  --unattended --replace

cleanup() {
  echo "Desregistrando runner..."
  ./config.sh remove --token "$(fetch_token)" || true
}
trap cleanup EXIT INT TERM

./run.sh &
wait $!
