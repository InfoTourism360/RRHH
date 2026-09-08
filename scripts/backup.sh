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
if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$FICHERO" > "$FICHERO.sha256"
else
  shasum -a 256 "$FICHERO" > "$FICHERO.sha256"
fi

echo "Copia creada: $FICHERO"
echo "Integridad:   $FICHERO.sha256"
