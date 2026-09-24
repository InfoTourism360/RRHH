#!/usr/bin/env bash
# Copia de seguridad de la base de datos (ENS mp.info.6 / op.cont).
# Uso: scripts/backup.sh [directorio_destino]
# Requiere el contenedor rrhh_db en marcha (docker compose up -d db).
set -euo pipefail

DEST="${1:-./backups}"
mkdir -p "$DEST"
STAMP="$(date +%Y%m%d_%H%M%S)"
FICHERO="$DEST/rrhh_${STAMP}.dump"

# Volcado en formato custom (comprimido, restaurable con pg_restore).
docker exec rrhh_db pg_dump -U rrhh_owner -d rrhh -F c > "$FICHERO"

# Hash de integridad de la copia.
#
# Se escribe con el nombre a secas, no con la ruta con la que se invocó el
# script: si lleva la ruta, la verificación solo funciona desde el directorio
# exacto desde el que se hizo la copia. La prueba de restauración fallaba por
# esto y nadie se había enterado porque nunca se había ejecutado.
NOMBRE="$(basename "$FICHERO")"
if command -v sha256sum >/dev/null 2>&1; then
  (cd "$DEST" && sha256sum "$NOMBRE" > "$NOMBRE.sha256")
else
  (cd "$DEST" && shasum -a 256 "$NOMBRE" > "$NOMBRE.sha256")
fi

echo "Copia creada: $FICHERO"
echo "Integridad:   $FICHERO.sha256"
