#!/usr/bin/env bash
#
# apply_zindex_fix_v2.sh
#
# Arregla el bug de z-index empatado entre ConfirmModal y PanelFlotanteGlobal.
# El problema: ambos terminaron con z-[9999], y con valores IGUALES el
# ganador depende del orden de montaje en el DOM (no es confiable).
#
# Este script fuerza una jerarquía real:
#   - PanelFlotanteGlobal.tsx -> se queda en z-[9999]
#   - ConfirmModal.tsx        -> pasa a z-[10000] (siempre por encima)
#
# Uso:
#   ./apply_zindex_fix_v2.sh /home/frani/Code/agenda-next/src

set -euo pipefail

ROOT="${1:-.}"
MODAL_FILE="$ROOT/ui/ConfirmModal.tsx"

if [[ ! -f "$MODAL_FILE" ]]; then
  echo "❌ No se encontró: $MODAL_FILE"
  echo "   Pasá la ruta correcta a la carpeta 'src' de tu proyecto."
  exit 1
fi

echo "🔍 Verificando estado actual de $MODAL_FILE..."
grep -n 'z-\[' "$MODAL_FILE" || true

# Backup
cp "$MODAL_FILE" "$MODAL_FILE.bak"
echo "🗂  Backup creado en: $MODAL_FILE.bak"

# Reemplaza CUALQUIER variante previa (9998 o 9999) por 10000, de forma robusta
if sed --version >/dev/null 2>&1; then
  SED_INPLACE=(-i)
else
  SED_INPLACE=(-i '')
fi

sed "${SED_INPLACE[@]}" \
  -e 's/z-\[9998\]/z-[10000]/' \
  -e 's/fixed inset-0 z-\[9999\] flex items-center justify-center p-6/fixed inset-0 z-[10000] flex items-center justify-center p-6/' \
  "$MODAL_FILE"

echo ""
echo "🔍 Estado final:"
grep -n 'z-\[' "$MODAL_FILE"

if grep -q 'z-\[10000\]' "$MODAL_FILE"; then
  echo ""
  echo "✅ ConfirmModal.tsx ahora usa z-[10000] (por encima del panel, que usa z-[9999])."
else
  echo ""
  echo "⚠️  No se pudo confirmar el cambio automáticamente."
  echo "   Revisá manualmente la línea 55 de $MODAL_FILE:"
  echo "   Debe quedar así:"
  echo '   <div className="fixed inset-0 z-[10000] flex items-center justify-center p-6">'
  exit 1
fi

echo ""
echo "⚠️  IMPORTANTE: si tu proyecto tiene un servidor de desarrollo corriendo,"
echo "   puede que necesites reiniciarlo (o hacer un hard refresh) para que Tailwind"
echo "   regenere la clase z-[10000], ya que es un valor arbitrario nuevo."
echo ""
echo "👉 Verificá también que no haya OTRO ConfirmModal.tsx en el proyecto"
echo "   (por ejemplo un duplicado en node_modules, .next, o una build vieja"
echo "   cacheada) que esté sirviendo la versión anterior:"
echo ""
echo "   grep -rn 'z-\\[999' \"$ROOT\" --include='*.tsx' --include='*.jsx' 2>/dev/null | grep -v node_modules"
