#!/usr/bin/env bash
set -euo pipefail

# Corré esto desde la raíz del proyecto (donde está la carpeta "src")
ROOT="src/features/editorGarlia"

echo "→ Arreglando imports de types/hooks/useNotas (components -> hooks)..."

# 1. Archivos en components/ que importan con ruta relativa "./types" "./hooks" "./useNotas"
grep -rl --include="*.tsx" --include="*.ts" -E "from [\"'](\./types|\./hooks|\./useNotas)[\"']" "$ROOT/components" | while read -r f; do
  sed -i -E "s#from \"\./types\"#from \"../hooks/types\"#g; s#from '\./types'#from '../hooks/types'#g" "$f"
  sed -i -E "s#from \"\./hooks\"#from \"../hooks/hooks\"#g; s#from '\./hooks'#from '../hooks/hooks'#g" "$f"
  sed -i -E "s#from \"\./useNotas\"#from \"../hooks/useNotas\"#g; s#from '\./useNotas'#from '../hooks/useNotas'#g" "$f"
  echo "  fixed (relative ./): $f"
done

# 2. Archivos en views/ que importan con ruta relativa "../components/types" etc.
grep -rl --include="*.tsx" --include="*.ts" -E "from [\"']\.\./components/(types|hooks|useNotas)[\"']" "$ROOT/views" | while read -r f; do
  sed -i -E "s#\.\./components/types#../hooks/types#g" "$f"
  sed -i -E "s#\.\./components/hooks#../hooks/hooks#g" "$f"
  sed -i -E "s#\.\./components/useNotas#../hooks/useNotas#g" "$f"
  echo "  fixed (../components/): $f"
done

# 3. Imports absolutos "@/features/editorGarlia/components/types|hooks|useNotas"
grep -rl --include="*.tsx" --include="*.ts" -E "@/features/editorGarlia/components/(types|hooks|useNotas)[\"']" "$ROOT" | while read -r f; do
  sed -i -E "s#@/features/editorGarlia/components/types#@/features/editorGarlia/hooks/types#g" "$f"
  sed -i -E "s#@/features/editorGarlia/components/hooks#@/features/editorGarlia/hooks/hooks#g" "$f"
  sed -i -E "s#@/features/editorGarlia/components/useNotas#@/features/editorGarlia/hooks/useNotas#g" "$f"
  echo "  fixed (absolute @/): $f"
done

echo ""
echo "→ Arreglando imports de componentes movidos a Criaturas/ ..."
CRIATURA_FILES="CriaturaHabitat CriaturaItemsCraftedos CriaturaItemsNaturales CriaturaMagia"
for name in $CRIATURA_FILES; do
  grep -rl --include="*.tsx" --include="*.ts" "components/$name\"" "$ROOT" 2>/dev/null | while read -r f; do
    sed -i -E "s#components/$name\"#components/Criaturas/$name\"#g" "$f"
    echo "  fixed: $f -> $name"
  done
done

echo ""
echo "→ Arreglando imports de componentes movidos a Personajes/ ..."
PERSONAJE_FILES="PersonajeCancionesAsociadas PersonajeCapitulosAparece PersonajeGrupos PersonajeHechizos PersonajeLineaDeTiempo PersonajeSidebarPanel"
for name in $PERSONAJE_FILES; do
  grep -rl --include="*.tsx" --include="*.ts" "components/$name\"" "$ROOT" 2>/dev/null | while read -r f; do
    sed -i -E "s#components/$name\"#components/Personajes/$name\"#g" "$f"
    echo "  fixed: $f -> $name"
  done
done

echo ""
echo "✓ Listo. Corré 'npx tsc --noEmit' para ver qué queda."
