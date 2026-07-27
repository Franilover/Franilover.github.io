#!/usr/bin/env bash
#
# aplicar_paso1.sh
# ─────────────────────────────────────────────────────────────────────────
# Paso 1 de la migración: unifica el nombre de archivo de tipos de entidad
# hacia `types.ts` (en vez de `model.ts`), para las 5 entidades que aún
# usaban el nombre viejo: ciudades, criaturas, items, personajes, reinos.
#
# Qué hace:
#   1. Renombra domains/garlia/<entidad>/model.ts -> types.ts
#   2. Actualiza todos los imports que apuntaban a ese archivo, tanto
#      relativos (./model, ../model) como absolutos (@/domains/garlia/...)
#
# Es IDEMPOTENTE: si se corre dos veces, la segunda vez no encuentra
# model.ts (ya renombrado) y no hace nada dañino.
#
# Uso:
#   cd <raíz-de-tu-src>        # la carpeta que contiene domains/, lib/, etc.
#   bash aplicar_paso1.sh
#
# Requiere: bash, grep, sed, find (estándar en cualquier Linux/macOS).
# En macOS, si sed da error de sintaxis, instala GNU sed (`brew install gnu-sed`)
# y usa `gsed` en vez de `sed`.
# ─────────────────────────────────────────────────────────────────────────

set -euo pipefail

ENTIDADES=(ciudades criaturas items personajes reinos)
BASE="domains/garlia"

if [ ! -d "$BASE" ]; then
  echo "❌ No encuentro la carpeta '$BASE' desde el directorio actual."
  echo "   Corre este script desde la raíz de tu src/ (donde vive domains/)."
  exit 1
fi

echo "── Paso 1: unificar model.ts -> types.ts ──────────────────────────"
echo

RENOMBRADOS=0
YA_HECHOS=0

for entidad in "${ENTIDADES[@]}"; do
  MODEL="$BASE/$entidad/model.ts"
  TYPES="$BASE/$entidad/types.ts"

  if [ -f "$MODEL" ]; then
    mv "$MODEL" "$TYPES"
    echo "  ✔ renombrado: $entidad/model.ts -> $entidad/types.ts"
    RENOMBRADOS=$((RENOMBRADOS + 1))
  elif [ -f "$TYPES" ]; then
    echo "  · ya estaba migrado: $entidad/types.ts (nada que hacer)"
    YA_HECHOS=$((YA_HECHOS + 1))
  else
    echo "  ⚠ no encontré ni model.ts ni types.ts en $entidad/ — revisa a mano"
  fi
done

echo
echo "── Actualizando imports ────────────────────────────────────────────"
echo

TOTAL_ARCHIVOS_TOCADOS=0

for entidad in "${ENTIDADES[@]}"; do
  # 1) Imports relativos dentro de la propia carpeta de la entidad: ./model
  while IFS= read -r -d '' file; do
    if grep -qE "from ['\"]\./model['\"]" "$file"; then
      sed -i.bak -E "s#from (['\"])\./model\1#from \1./types\1#g" "$file"
      rm -f "${file}.bak"
      echo "  ✔ import relativo actualizado: $file"
      TOTAL_ARCHIVOS_TOCADOS=$((TOTAL_ARCHIVOS_TOCADOS + 1))
    fi
  done < <(find "$BASE/$entidad" -maxdepth 1 -type f \( -name "*.ts" -o -name "*.tsx" \) -print0 2>/dev/null)

  # 2) Imports relativos desde subcarpetas: ../model
  while IFS= read -r -d '' file; do
    if grep -qE "from ['\"]\.\./model['\"]" "$file"; then
      sed -i.bak -E "s#from (['\"])\.\./model\1#from \1../types\1#g" "$file"
      rm -f "${file}.bak"
      echo "  ✔ import relativo (subcarpeta) actualizado: $file"
      TOTAL_ARCHIVOS_TOCADOS=$((TOTAL_ARCHIVOS_TOCADOS + 1))
    fi
  done < <(find "$BASE/$entidad" -mindepth 2 -type f \( -name "*.ts" -o -name "*.tsx" \) -print0 2>/dev/null)

  # 3) Imports absolutos desde cualquier parte del proyecto: @/domains/garlia/<entidad>/model
  ABS_PATTERN="@/domains/garlia/${entidad}/model"
  while IFS= read -r -d '' file; do
    if grep -qF "$ABS_PATTERN" "$file"; then
      sed -i.bak "s#${ABS_PATTERN}#@/domains/garlia/${entidad}/types#g" "$file"
      rm -f "${file}.bak"
      echo "  ✔ import absoluto actualizado: $file"
      TOTAL_ARCHIVOS_TOCADOS=$((TOTAL_ARCHIVOS_TOCADOS + 1))
    fi
  done < <(find . -type f \( -name "*.ts" -o -name "*.tsx" \) -not -path "*/node_modules/*" -print0)
done

echo
echo "── Limpiando comentarios que mencionan model.ts (cosmético) ────────"
echo

for entidad in "${ENTIDADES[@]}"; do
  TYPES="$BASE/$entidad/types.ts"
  if [ -f "$TYPES" ] && grep -q "/model\.ts" "$TYPES"; then
    sed -i.bak -E "s#domains/garlia/([a-z-]+)/model\.ts#domains/garlia/\1/types.ts#g" "$TYPES"
    rm -f "${TYPES}.bak"
    echo "  ✔ comentario actualizado: $TYPES"
  fi
done

echo
echo "── Verificación final ──────────────────────────────────────────────"
echo

RESTANTES=$(grep -rlE "domains/garlia/(ciudades|criaturas|items|personajes|reinos)/model['\"]" . \
  --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v node_modules || true)
RESTANTES_REL=$(grep -rlE "from ['\"]\.{1,2}/model['\"]" \
  "$BASE/ciudades" "$BASE/criaturas" "$BASE/items" "$BASE/personajes" "$BASE/reinos" \
  --include="*.ts" --include="*.tsx" 2>/dev/null || true)

if [ -z "$RESTANTES" ] && [ -z "$RESTANTES_REL" ]; then
  echo "  ✅ No quedan referencias a /model. Todo limpio."
else
  echo "  ⚠ Quedan referencias sin actualizar, revisa a mano:"
  [ -n "$RESTANTES" ] && echo "$RESTANTES"
  [ -n "$RESTANTES_REL" ] && echo "$RESTANTES_REL"
fi

echo
echo "── Resumen ──────────────────────────────────────────────────────────"
echo "  Archivos renombrados (model.ts -> types.ts): $RENOMBRADOS"
echo "  Entidades que ya estaban migradas:            $YA_HECHOS"
echo "  Archivos con imports actualizados:             $TOTAL_ARCHIVOS_TOCADOS"
echo
echo "Listo. Revisa el diff (git diff) antes de commitear."
