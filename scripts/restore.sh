#!/usr/bin/env bash
# Restauración de una copia de seguridad (prueba de restauración ENS op.cont.3).
# Uso: scripts/restore.sh <fichero.dump> [nombre_bd_destino]
# Por seguridad, restaura sobre una BD de PRUEBA (por defecto rrhh_restore_test),
# nunca sobre la de producción, para poder verificar sin riesgo.
set -euo pipefail

FICHERO="${1:?Indica el fichero .dump a restaurar}"
BD="${2:-rrhh_restore_test}"

# Verifica integridad si hay hash.
if [ -f "$FICHERO.sha256" ]; then
  echo "Verificando integridad…"
  (cd "$(dirname "$FICHERO")" && (sha256sum -c "$(basename "$FICHERO").sha256" 2>/dev/null || shasum -a 256 -c "$(basename "$FICHERO").sha256"))
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
