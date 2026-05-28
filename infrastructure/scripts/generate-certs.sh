#!/bin/bash

# Genera un certificado SSL self-signed para desarrollo local.
# Los certs se guardan en infrastructure/nginx/certs/ (ignorado por .gitignore).
# Cada desarrollador debe ejecutar este script una vez antes de levantar Docker.
#
# Uso:
#   chmod +x infrastructure/scripts/generate-certs.sh
#   ./infrastructure/scripts/generate-certs.sh

set -e

CERTS_DIR="$(dirname "$0")/../nginx/certs"

mkdir -p "$CERTS_DIR"

echo "Generando certificado self-signed en $CERTS_DIR ..."

openssl req -x509 \
  -nodes \
  -days 365 \
  -newkey rsa:2048 \
  -keyout "$CERTS_DIR/key.pem" \
  -out    "$CERTS_DIR/cert.pem" \
  -subj   "/C=ES/ST=Madrid/L=Madrid/O=whoshuman/CN=localhost"

echo "Listo. Archivos generados:"
echo "  $CERTS_DIR/cert.pem"
echo "  $CERTS_DIR/key.pem"
