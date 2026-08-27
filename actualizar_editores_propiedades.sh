#!/usr/bin/env bash
set -euo pipefail

FILE="src/domains/garlia/elementos/types.ts"

if [[ ! -f "$FILE" ]]; then
  echo "ERROR: no existe $FILE"
  echo "Ejecuta este script desde la raíz del repositorio."
  exit 1
fi

BACKUP="$FILE.bak"
cp "$FILE" "$BACKUP"

echo "Backup creado: $BACKUP"

python3 - "$FILE" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
s = path.read_text()

def repl(old: str, new: str, label: str):
    global s
    if new in s:
        print(f"[OK] {label}: ya aplicado")
        return
    if old not in s:
        raise SystemExit(f"[ERROR] No encontré el bloque esperado: {label}")
    s = s.replace(old, new, 1)
    print(f"[OK] {label}")

# ---------------- Elemento ----------------
repl(
'''  dureza?: number | null;\n  conductividad?: number | null;\n  transparencia?: number | null;\n''',
'''  dureza?: number | null;\n  conductividad?: number | null;\n  transparencia?: number | null;\n  interaccion?: number | null;\n''',
"Elemento.interaccion",
)

repl(
'''    "masa_base, estabilidad, rigidez, flexibilidad, dureza, conductividad, transparencia, " +\n''',
'''    "masa_base, estabilidad, rigidez, flexibilidad, dureza, conductividad, transparencia, interaccion, " +\n''',
"CONFIG.select.interaccion",
)

repl(
'''    { clave: "transparencia", label: "Transparencia", valor: fmt(el.transparencia), proporcion: prop(el.transparencia), descripcion: "Cuánto deja pasar en vez de bloquear/absorber.", formula: "Transparencia = 0.45·información externa + 0.30·(1−interacción externa) + 0.15·(1−transformación externa) + 0.10·flexibilidad" },\n''',
'''    { clave: "transparencia", label: "Transparencia", valor: fmt(el.transparencia), proporcion: prop(el.transparencia), descripcion: "Cuánto deja pasar en vez de bloquear/absorber.", formula: "Transparencia = propiedad derivada de la capacidad de paso y retención." },\n    { clave: "interaccion", label: "Interacción", valor: fmt(el.interaccion), proporcion: prop(el.interaccion), descripcion: "Facilidad con la que el elemento se acopla o responde a su entorno.", formula: "Interacción = propiedad derivada de la capacidad de acoplamiento del elemento." },\n''',
"Elemento.transparencia + interaccion",
)

repl(
'''formula: "Rigidez = 1 − Flexibilidad (mismos componentes, en sentido inverso)"''',
'''formula: "Rigidez = propiedad derivada de la estructura y composición del elemento."''',
"Elemento.formula.rigidez",
)

# ---------------- Compuesto ----------------
repl(
'''  estabilidad?: number | null;\n  rigidez?: number | null;\n  flexibilidad?: number | null;\n  compatibilidad?: number | null;\n''',
'''  estabilidad?: number | null;\n  rigidez?: number | null;\n  flexibilidad?: number | null;\n  dureza?: number | null;\n  conductividad?: number | null;\n  transparencia?: number | null;\n  interaccion?: number | null;\n  compatibilidad?: number | null;\n''',
"Compuesto.nuevas_propiedades",
)

repl(
'''    "flexibilidad, compatibilidad, energia_enlace, clasificacion, tipo_estructura",\n''',
'''    "flexibilidad, dureza, conductividad, transparencia, interaccion, " +\n    "compatibilidad, energia_enlace, clasificacion, tipo_estructura",\n''',
"CONFIG_COMPUESTOS.select.nuevas_propiedades",
)

repl(
'''    { clave: "flexibilidad", label: "Flexibilidad", valor: fmt(c.flexibilidad), proporcion: prop(c.flexibilidad), descripcion: "Capacidad del compuesto de deformarse sin romperse.", formula: "Flexibilidad = Σ (peso · flexibilidad de cada elemento) + 0.20·(1−energía de enlace)" },\n''',
'''    { clave: "flexibilidad", label: "Flexibilidad", valor: fmt(c.flexibilidad), proporcion: prop(c.flexibilidad), descripcion: "Capacidad del compuesto de deformarse sin romperse.", formula: "Flexibilidad = propiedad derivada de la composición y estructura del compuesto." },\n    { clave: "dureza", label: "Dureza", valor: fmt(c.dureza), proporcion: prop(c.dureza), descripcion: "Resistencia del compuesto a ser rayado o penetrado.", formula: "Dureza = propiedad derivada de la composición del compuesto." },\n    { clave: "conductividad", label: "Conductividad", valor: fmt(c.conductividad), proporcion: prop(c.conductividad), descripcion: "Facilidad del compuesto para transmitir una influencia a través de su estructura.", formula: "Conductividad = propiedad derivada de la capacidad de transmisión de sus componentes." },\n    { clave: "transparencia", label: "Transparencia", valor: fmt(c.transparencia), proporcion: prop(c.transparencia), descripcion: "Facilidad con la que una influencia atraviesa el compuesto sin quedar retenida.", formula: "Transparencia = propiedad derivada de la capacidad de paso de sus componentes." },\n    { clave: "interaccion", label: "Interacción", valor: fmt(c.interaccion), proporcion: prop(c.interaccion), descripcion: "Facilidad con la que el compuesto se acopla con su entorno.", formula: "Interacción = propiedad derivada de la capacidad de acoplamiento de sus componentes." },\n''',
"Compuesto.propiedades.render",
)

for old, new, label in [
    (
'''formula: "Estabilidad = Σ (peso · estabilidad de cada elemento) + 0.25·energía de enlace − 0.25·inestabilidad"''',
'''formula: "Estabilidad = propiedad derivada de la composición y estructura del compuesto."''',
"Compuesto.formula.estabilidad",
    ),
    (
'''formula: "Rigidez = Σ (peso · rigidez de cada elemento) + 0.20·energía de enlace"''',
'''formula: "Rigidez = propiedad derivada de la composición y estructura del compuesto."''',
"Compuesto.formula.rigidez",
    ),
]:
    repl(old, new, label)

path.write_text(s)
PY

echo
echo "== git diff --check =="
git diff --check -- "$FILE"
echo
echo "== git diff -- $FILE =="
git diff -- "$FILE"
echo
echo ""
echo "Revertir esta ejecución:"
echo "  mv \"$BACKUP\" \"$FILE\""
