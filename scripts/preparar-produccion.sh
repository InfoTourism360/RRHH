#!/usr/bin/env bash
# Prepara un despliegue de producción: genera los secretos en .env.prod (fuera
# del control de versiones) y, opcionalmente, certificados TLS autofirmados.
#
#   scripts/preparar-produccion.sh          # solo secretos (HTTP)
#   scripts/preparar-produccion.sh --tls    # además certificados y HTTPS
#
# En un despliegue real, sustituye los certificados autofirmados por los del
# dominio y mueve los secretos a un gestor de secretos (ENS: mp.info.3, op.exp.11).
set -euo pipefail

cd "$(dirname "$0")/.."
TLS=no
[ "${1:-}" = "--tls" ] && TLS=si

secreto() { node -e "console.log(require('crypto').randomBytes($1).toString('base64url'))"; }

if [ -f .env.prod ]; then
  echo "Ya existe .env.prod: no se sobrescribe (contiene secretos en uso)."
else
  echo "Generando .env.prod con secretos aleatorios…"
  {
    echo "# Secretos del despliegue. NO subir al repositorio."
    echo "# Generado por scripts/preparar-produccion.sh el $(date +%Y-%m-%d)."
    echo "DB_OWNER_PWD=$(secreto 24)"
    echo "DB_APP_PWD=$(secreto 24)"
    echo "APP_ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")"
    echo "PUERTO_HTTP=8080"
    echo "PUERTO_HTTPS=8443"
    if [ "$TLS" = "si" ]; then echo "NGINX_CONF=nginx-https.conf"; else echo "NGINX_CONF=nginx.conf"; fi
  } > .env.prod
  chmod 600 .env.prod 2>/dev/null || true
  echo "  .env.prod creado."
fi

mkdir -p certs
if [ "$TLS" = "si" ]; then
  if [ -f certs/servidor.crt ]; then
    echo "Ya existen certificados en ./certs: no se sobrescriben."
  else
    echo "Generando certificado autofirmado (solo para pruebas)…"
    openssl req -x509 -nodes -newkey rsa:2048 -days 825 \
      -keyout certs/servidor.key -out certs/servidor.crt \
      -subj "/C=ES/O=Gestion de Personal/CN=localhost" \
      -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" 2>/dev/null
    chmod 600 certs/servidor.key 2>/dev/null || true
    echo "  certs/servidor.crt y certs/servidor.key creados."
    echo "  AVISO: autofirmado. El navegador avisará hasta poner un certificado real."
  fi
else
  # nginx monta ./certs aunque no se use TLS: debe existir para que arranque.
  touch certs/.gitkeep
fi

echo
echo "Listo. Arranca con:"
echo "  docker compose --env-file .env.prod -f docker-compose.prod.yml up --build -d"
[ "$TLS" = "si" ] && echo "  y abre https://localhost:8443"
