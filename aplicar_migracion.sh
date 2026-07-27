#!/usr/bin/env bash
# Aplica la migración de domains/garlia (entidades faltantes) sobre tu repo real.
#
# USO:
#   1. Copiá este script y el archivo domains_garlia_migrado.tar.gz a la RAÍZ de tu repo
#      (el nivel que contiene la carpeta "src/").
#   2. Corré: bash aplicar_migracion.sh
#
# Qué hace:
#   - Hace un backup de src/domains/garlia, src/domains/plataforma y src/editor/notas
#     tal como están hoy, por si algo sale mal (backup_pre_migracion_<timestamp>/).
#   - Extrae el tar.gz migrado ENCIMA de tu src/ actual (rsync --delete solo dentro
#     de esas 3 carpetas, no toca nada más del repo).
#   - Borra src/domains/garlia/_legacy (que quedó vacía tras la migración).
#
# Qué NO hace (fuera de este parche):
#   - No toca src/domains/garlia/_legacy-public (pendiente, tema aparte).
#   - No toca src/domains/personal (no migrado todavía).
#   - No corre tu build ni tests — hacelo vos después para confirmar.

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
mkdir -p "$BACKUP"

echo "==> Backup de lo que se va a reemplazar en: $BACKUP/"
[ -d "src/domains/garlia" ] && cp -r "src/domains/garlia" "$BACKUP/garlia"
[ -d "src/domains/plataforma" ] && cp -r "src/domains/plataforma" "$BACKUP/plataforma"
[ -d "src/editor/notas" ] && cp -r "src/editor/notas" "$BACKUP/notas"

echo "==> Extrayendo migración a una carpeta temporal..."
TMP=$(mktemp -d)
tar -xzf domains_garlia_migrado.tar.gz -C "$TMP"

echo "==> Aplicando sobre src/domains/garlia (preservando _legacy-public intacto)..."
rsync -a --delete \
  --exclude "_legacy-public" \
  "$TMP/src/domains/garlia/" "src/domains/garlia/"

echo "==> Aplicando sobre src/domains/plataforma..."
mkdir -p "src/domains/plataforma"
rsync -a "$TMP/src/domains/plataforma/" "src/domains/plataforma/"

echo "==> Aplicando sobre src/editor/notas..."
rsync -a "$TMP/src/editor/notas/" "src/editor/notas/"

echo "==> Eliminando _legacy vacía si quedó..."
rmdir "src/domains/garlia/_legacy" 2>/dev/null || true

rm -rf "$TMP"

echo ""
echo "Listo. Backup guardado en $BACKUP/"
echo "Ahora corré tu build (npm run build / next build) para confirmar que compila."
echo "Si algo se rompe, restaurá con:"
echo "  rm -rf src/domains/garlia src/domains/plataforma src/editor/notas"
echo "  cp -r $BACKUP/garlia src/domains/garlia"
echo "  cp -r $BACKUP/plataforma src/domains/plataforma  # si existía"
echo "  cp -r $BACKUP/notas src/editor/notas"
