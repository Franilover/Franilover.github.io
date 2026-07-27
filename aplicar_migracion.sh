#!/usr/bin/env bash
# Aplica la migración de dominios (Garlia + separación de Personal/mensajes)
# sobre tu repo real. No depende de rsync — solo usa cp, mkdir, rm, que
# existen en cualquier sistema Unix/Mac/WSL sin instalar nada extra.
#
# USO:
#   1. Copiá este script y domains_garlia_migrado.tar.gz a la RAÍZ de tu
#      repo (el nivel que contiene la carpeta "src/").
#   2. Corré: bash aplicar_migracion.sh
#
# Qué hace:
#   - Backup completo de src/ actual en backup_pre_migracion_<timestamp>/
#     (por si algo sale mal).
#   - Extrae el tar.gz a una carpeta temporal.
#   - Copia (sobrescribiendo) todos los archivos del paquete sobre tu src/ real.
#   - Elimina src/domains/garlia/_legacy y src/domains/garlia/_legacy-public,
#     que quedaron vacías/obsoletas tras la migración.
#
# Qué NO toca:
#   - src/domains/personal/_legacy y _legacy-shell (Personal real sigue
#     pendiente de reorganizar, fase aparte).
#   - No corre tu build — hacelo vos después para confirmar.

set -euo pipefail

if [ ! -d "src" ]; then
  echo "ERROR: no encuentro la carpeta 'src' acá. Corré este script desde la raíz del repo."
  exit 1
fi

if [ ! -f "domains_garlia_migrado.tar.gz" ]; then
  echo "ERROR: no encuentro domains_garlia_migrado.tar.gz en este directorio."
  exit 1
fi

STAMP=$(date +%Y%m%d_%H%M%S)
BACKUP="backup_pre_migracion_${STAMP}"

echo "==> Backup completo de src/ en: $BACKUP/"
mkdir -p "$BACKUP"
cp -r "src" "$BACKUP/src"

echo "==> Extrayendo migración a una carpeta temporal..."
TMP=$(mktemp -d)
tar -xzf domains_garlia_migrado.tar.gz -C "$TMP"

echo "==> Copiando archivos migrados sobre src/ (sobrescribe, no borra lo demás)..."
# cp -r con "/." al final del origen copia el CONTENIDO de la carpeta,
# no la carpeta en sí — así se mezcla con lo que ya existe en destino.
cp -r "$TMP/src/." "src/"

echo "==> Eliminando carpetas obsoletas (_legacy, _legacy-public de garlia)..."
rm -rf "src/domains/garlia/_legacy"
rm -rf "src/domains/garlia/_legacy-public"

rm -rf "$TMP"

echo ""
echo "Listo. Backup completo guardado en $BACKUP/src"
echo "Ahora corré tu build (npm run build / next build) para confirmar."
echo ""
echo "Si algo se rompe, restaurá TODO con:"
echo "  rm -rf src"
echo "  cp -r $BACKUP/src src"
