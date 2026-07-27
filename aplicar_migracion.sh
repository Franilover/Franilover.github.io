#!/bin/bash
set -e

# ============================================================
# aplicar_migracion.sh — Ronda: src/ui + src/layout (design system)
# ============================================================
# Uso:
#   1. Poné este script y migracion_ui_layout.tar.gz
#      en la raíz del repo (junto a src/)
#   2. Corré: bash aplicar_migracion.sh
#   3. Confirmá: npm run build
# ============================================================

TARBALL="migracion_ui_layout.tar.gz"
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

echo "== 3. Copiando archivos nuevos/modificados sobre src/ =="
cp -r "$TMP_DIR"/. src/

echo "== 4. Eliminando carpetas obsoletas de esta ronda =="
if [ -d "src/components/ui" ]; then
  rm -rf "src/components/ui"
  echo "  - eliminada: src/components/ui (movida a src/ui/)"
else
  echo "  - src/components/ui ya no existe, nada que borrar"
fi
if [ -d "src/components/layout" ]; then
  rm -rf "src/components/layout"
  echo "  - eliminada: src/components/layout (movida a src/layout/)"
else
  echo "  - src/components/layout ya no existe, nada que borrar"
fi

echo "== 5. Limpieza de temporales =="
rm -rf "$TMP_DIR"

echo ""
echo "=========================================="
echo " Migración aplicada con éxito."
echo " Ahora corré: npm run build"
echo ""
echo " Si algo sale mal y querés deshacer todo:"
echo "   rm -rf src && mv \"$BACKUP_DIR/src\" src"
echo "=========================================="
