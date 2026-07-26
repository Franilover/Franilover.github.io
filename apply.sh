#!/usr/bin/env bash
# Ejecutar desde la raíz del repo, después de extraer este tar ahí mismo
# (tar -xzf ciudades-migration.tar.gz -C .), que copia/sobreescribe:
#   src/domains/garlia/ciudades/                               (nuevo)
#   src/domains/garlia/reinos/components/ReinoTileCanvas.tsx   (patch: import Ciudad)
#   src/domains/garlia/reinos/components/LoreTab.tsx           (patch: import Ciudad)
#   src/domains/garlia/reinos/components/EditorReino.tsx       (patch: import Ciudad)
# Estos 3 de reinos/ ya importaban Ciudad desde el cajón de sastre legacy;
# ahora apuntan a @/domains/garlia/ciudades.
set -e
echo "Borrando archivos legacy ya migrados a domains/garlia/ciudades..."
rm -f src/domains/garlia/_legacy/components/ciudades/CiudadEditor.tsx
rm -f src/domains/garlia/_legacy/components/ciudades/FormularioCiudad.tsx
rm -f src/domains/garlia/_legacy/hooks/ciudades/useCiudadCatalogos.ts
rm -f src/domains/garlia/_legacy/hooks/ciudades/useCiudades.ts
rm -f src/domains/garlia/_legacy/views/EditorCiudad.tsx
rmdir src/domains/garlia/_legacy/components/ciudades 2>/dev/null || true
rmdir src/domains/garlia/_legacy/hooks/ciudades 2>/dev/null || true
echo "Listo. Los archivos nuevos/modificados ya se copiaron al extraer el tar."
echo ""
echo "IMPORTANTE: el tipo Ciudad sigue definido también en"
echo "  src/domains/garlia/_legacy/hooks/types.ts (línea ~244)"
echo "porque otros archivos legacy (aún no migrados) pueden importarlo desde ahí."
echo "No se borró de types.ts a propósito — hacelo recién cuando confirmes que"
echo "nada más en _legacy importa 'type Ciudad' desde ese archivo:"
echo "  grep -rn 'from \"@/domains/garlia/_legacy/hooks/types\"' src/domains/garlia/_legacy | grep Ciudad"
echo ""
echo "Corré: npx tsc --noEmit  y  npx next build  para confirmar."
