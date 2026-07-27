#!/bin/bash
set -e

# ============================================================
# aplicar_migracion.sh — Ronda: Route groups en app/ (Fase 4)
# ============================================================
# Agrupa app/garlia, app/personal, app/myself dentro de
# (public), (personal), (admin) respectivamente. NO cambia URLs
# (los route groups de Next.js no aparecen en la ruta).
#
# Uso:
#   1. Poné este script y migracion_route_groups.tar.gz
#      en la raíz del repo (junto a src/)
#   2. Corré: bash aplicar_migracion.sh
#   3. Confirmá: npm run build
# ============================================================

TARBALL="migracion_route_groups.tar.gz"
FECHA=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="backup_pre_migracion_${FECHA}"

if [ ! -f "$TARBALL" ]; then
  echo "ERROR: no se encontró $TARBALL en el directorio actual."
  exit 1
fi

if [ ! -d "src" ]; then
  echo "ERROR: no se encontró la carpeta src/ en el directorio actual."
  echo "Corré este script desde la raíz del repo."
  exit 1
fi

echo "== 1. Backup completo de src/ en $BACKUP_DIR =="
mkdir -p "$BACKUP_DIR"
cp -r src "$BACKUP_DIR/src"
echo "Backup listo: $BACKUP_DIR/src"

echo "== 2. Extrayendo $TARBALL a carpeta temporal =="
TMP_DIR=$(mktemp -d)
tar -xzf "$TARBALL" -C "$TMP_DIR"

echo "== 3. Copiando las carpetas de route groups nuevas sobre src/app/ =="
cp -r "$TMP_DIR"/. src/

echo "== 4. Eliminando carpetas obsoletas (movidas dentro de los route groups) =="
for old in "src/app/garlia" "src/app/personal" "src/app/myself"; do
  if [ -d "$old" ]; then
    rm -rf "$old"
    echo "  - eliminada: $old"
  else
    echo "  - $old ya no existe, nada que borrar"
  fi
done

echo "== 5. Limpieza de temporales =="
rm -rf "$TMP_DIR"

echo ""
echo "=========================================="
echo " Migración aplicada con éxito."
echo " Las URLs no cambian (/garlia, /personal, /myself siguen igual)."
echo " Ahora corré: npm run build"
echo ""
echo " Si algo sale mal y querés deshacer todo:"
echo "   rm -rf src && mv \"$BACKUP_DIR/src\" src"
echo "=========================================="
