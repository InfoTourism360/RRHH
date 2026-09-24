#!/usr/bin/env bash
# Restauración de una copia de seguridad (prueba de restauración ENS op.cont.3).
# Uso: scripts/restore.sh <fichero.dump> [nombre_bd_destino]
# Por seguridad, restaura sobre una BD de PRUEBA (por defecto rrhh_restore_test),
# nunca sobre la de producción, para poder verificar sin riesgo.
set -euo pipefail

FICHERO="${1:?Indica el fichero .dump a restaurar}"
BD="${2:-rrhh_restore_test}"

# Verifica integridad si hay hash. Una copia que no se puede verificar no se
# restaura: se aborta, porque restaurar un volcado corrupto sobre una base de
# comprobación da una falsa sensación de que la copia servía.
if [ -f "$FICHERO.sha256" ]; then
  echo "Verificando integridad…"
  DIR="$(cd "$(dirname "$FICHERO")" && pwd)"
  NOMBRE="$(basename "$FICHERO")"
  if ! (cd "$DIR" && { sha256sum -c "$NOMBRE.sha256" 2>/dev/null || shasum -a 256 -c "$NOMBRE.sha256"; }); then
    echo "ERROR: la copia no supera la verificación de integridad. No se restaura." >&2
    exit 1
  fi
else
  echo "AVISO: no hay fichero .sha256; se restaura sin verificar integridad." >&2
fi

echo "Creando BD de prueba $BD…"
docker exec rrhh_db psql -U rrhh_owner -d postgres -c "DROP DATABASE IF EXISTS $BD;"
docker exec rrhh_db psql -U rrhh_owner -d postgres -c "CREATE DATABASE $BD OWNER rrhh_owner;"

echo "Restaurando…"
docker exec -i rrhh_db pg_restore -U rrhh_owner -d "$BD" --no-owner < "$FICHERO"

echo "Verificación rápida (recuento de tablas clave):"
docker exec rrhh_db psql -U rrhh_owner -d "$BD" -c \
  "SELECT 'entidad' t, count(*) FROM entidad UNION ALL SELECT 'persona', count(*) FROM persona UNION ALL SELECT 'fichaje_evento', count(*) FROM fichaje_evento;"

echo "Restauración completada en la BD de prueba '$BD'. Revisa los recuentos."
