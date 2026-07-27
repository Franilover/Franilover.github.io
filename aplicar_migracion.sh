#!/bin/bash
set -e

FECHA=$(date +%Y%m%d_%H%M%S)
BACKUP="backup_pre_migracion_${FECHA}"
TARBALL="cambios_ronda.tar.gz"

if [ ! -d "src" ]; then
  echo "ERROR: no se encontró la carpeta src/ en el directorio actual."
  echo "Corré este script desde la raíz del repo (junto a src/)."
  exit 1
fi

if [ ! -f "$TARBALL" ]; then
  echo "ERROR: no se encontró $TARBALL junto a este script."
  exit 1
fi

echo "== 1. Backup completo de src/ en $BACKUP =="
mkdir -p "$BACKUP"
cp -r src "$BACKUP/src"

echo "== 2. Eliminando árbol viejo duplicado =="
# Rutas de app/ sin route group, reemplazadas por app/(public|personal|admin)/...
rm -rf src/app/garlia
rm -rf src/app/personal
rm -rf src/app/myself
rm -rf src/app/auth

# components/ completo: lo vivo (modal, command, forms/AdminOnly, forms/Markdown)
# se movió a ui/ y viene en el tar; el resto (ui/, layout/, forms/lexical-editor/)
# eran copias duplicadas de src/ui, src/layout, src/editor/lexical.
rm -rf src/components

# features/: fork viejo de domains/plataforma/{auth,actualizaciones}
rm -rf src/features

echo "== 3. Aplicando cambios de esta ronda ($TARBALL) =="
TMPDIR=$(mktemp -d)
tar -xzf "$TARBALL" -C "$TMPDIR"
cp -r "$TMPDIR"/. src/
rm -rf "$TMPDIR"

echo "== Listo =="
echo "Backup guardado en: $BACKUP"
echo "Para deshacer todo:"
echo "  rm -rf src && cp -r $BACKUP/src src"
echo
echo "Ahora corré: npm run build"
