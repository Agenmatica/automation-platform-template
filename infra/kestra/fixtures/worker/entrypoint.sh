#!/bin/sh
set -eu

# La consulta verifica el canal worker -> Vault sin serializar su resultado.
psql -v ON_ERROR_STOP=1 -Atqc \
  "select length(private.obtener_credencial_para_worker('$CONEXION_ID'))" \
  >/dev/null

case "${SISTEMA_EXTERNO}" in
  fixture-credencial)
    printf 'CREDENCIAL_INVALIDA:%s\n' "$CONEXION_ID" >&2
    exit 42
    ;;
  fixture-tecnica)
    printf 'FALLA_TECNICA_SANITIZADA\n' >&2
    exit 43
    ;;
esac
