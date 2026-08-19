#!/usr/bin/env bash
#
# apply_zindex_fix.sh
#
# Aplica el "Quick Fix" del bug de z-index: el modal de confirmación
# (ConfirmModal.tsx) queda detrás del panel flotante (PanelFlotanteGlobal.tsx)
# porque ambos usan createPortal() al body y el panel tiene z-index mayor.
#
# Cambio: z-[9998] -> z-[9999] en ui/ConfirmModal.tsx
#
# Uso:
#   ./apply_zindex_fix.sh [ruta_a_la_raiz_del_proyecto]
#
# Si no se pasa ruta, se asume el directorio actual.

set -euo pipefail

ROOT="${1:-.}"
FILE="$ROOT/ui/ConfirmModal.tsx"

OLD='fixed inset-0 z-\[9998\] flex items-center justify-center p-6'
NEW='fixed inset-0 z-[9999] flex items-center justify-center p-6'

if [[ ! -f "$FILE" ]]; then
  echo "❌ No se encontró el archivo: $FILE"
  echo "   Ejecutá el script pasando la ruta raíz del proyecto, ej:"
  echo "   ./apply_zindex_fix.sh /ruta/a/mi-proyecto"
  exit 1
fi

# Verifica que la línea a reemplazar exista tal cual se espera
if ! grep -qE "$OLD" "$FILE"; then
  if grep -q 'z-\[9999\]' "$FILE"; then
    echo "ℹ️  El archivo ya parece tener aplicado el fix (z-[9999]). Nada que hacer."
    exit 0
  else
    echo "❌ No se encontró la línea esperada con 'z-[9998]' en: $FILE"
    echo "   El archivo pudo haber cambiado. Revisá manualmente antes de continuar."
    exit 1
  fi
fi

# Backup antes de tocar nada
cp "$FILE" "$FILE.bak"
echo "🗂  Backup creado en: $FILE.bak"

# Aplica el reemplazo (compatible con sed de macOS y Linux)
if sed --version >/dev/null 2>&1; then
  # GNU sed (Linux)
  sed -i "s/z-\[9998\]/z-[9999]/" "$FILE"
else
  # BSD sed (macOS)
  sed -i '' "s/z-\[9998\]/z-[9999]/" "$FILE"
fi

if grep -q 'z-\[9999\]' "$FILE"; then
  echo "✅ Fix aplicado correctamente en: $FILE"
  echo "   z-[9998] -> z-[9999]"
else
  echo "❌ Algo salió mal, el archivo no quedó con z-[9999]. Restaurando backup..."
  mv "$FILE.bak" "$FILE"
  exit 1
fi

echo ""
echo "👉 Siguiente paso: probá el flujo -> abrir panel flotante, click en eliminar,"
echo "   y verificar que el modal de confirmación aparezca encima del panel."
