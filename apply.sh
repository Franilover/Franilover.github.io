#!/usr/bin/env bash
# Ejecutar desde la raíz del repo, después de extraer este tar ahí mismo.
set -e
echo "Borrando archivos legacy ya migrados a domains/garlia/reinos..."
rm -f src/domains/garlia/_legacy/components/reinos/ReinoEditor.tsx
rm -f src/domains/garlia/_legacy/components/reinos/ReinoTileCanvas.tsx
rm -f src/domains/garlia/_legacy/views/EditorReino.tsx
rm -f src/domains/garlia/_legacy/components/shared/LoreTab.tsx
rm -f src/domains/garlia/_legacy/hooks/reinos/useReinosMin.ts
rmdir src/domains/garlia/_legacy/components/reinos 2>/dev/null || true
rmdir src/domains/garlia/_legacy/hooks/reinos 2>/dev/null || true
echo "Listo. Los archivos nuevos/modificados ya se copiaron al extraer el tar."
echo "Corré: npx tsc --noEmit  y  npx next build  para confirmar."
