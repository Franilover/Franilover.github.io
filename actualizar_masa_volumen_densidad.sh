#!/usr/bin/env bash
set -euo pipefail

# Ejecutar desde la raíz del repo.
# Actualiza el floating editor de Elementos/Compuestos para mostrar:
#   - Masa (magnitud no normalizada)
#   - Volumen (magnitud no normalizada)
#   - Densidad (magnitud derivada M/V)
# y hace que la "i" explique su significado en lugar de tratarlas como 0..1.
#
# Hace backups antes de modificar.

TSX="src/domains/garlia/elementos/types.ts"
POP="src/domains/garlia/elementos/InfoFormulasPopover.tsx"

[[ -f "$TSX" ]] || { echo "ERROR: no existe $TSX"; exit 1; }
[[ -f "$POP" ]] || { echo "ERROR: no existe $POP"; exit 1; }

cp "$TSX" "$TSX.bak"
cp "$POP" "$POP.bak"

python3 - "$TSX" "$POP" <<'PY'
from pathlib import Path
import sys

TSX = Path(sys.argv[1])
POP = Path(sys.argv[2])
ts = TSX.read_text()
pop = POP.read_text()

def replace(text, old, new, label):
    if new in text:
        print(f"[OK] {label}: ya aplicado")
        return text
    if old not in text:
        raise SystemExit(f"[ERROR] No encontré el bloque esperado: {label}")
    print(f"[OK] {label}: aplicado")
    return text.replace(old, new, 1)

# ------------------------- Elemento -------------------------
ts = replace(
    ts,
    '  masa_base?: number | null;\n  estabilidad?: number | null;\n',
    '  masa_base?: number | null;\n  volumen_base?: number | null;\n  estabilidad?: number | null;\n',
    'Elemento.volumen_base',
)

ts = replace(
    ts,
    '"masa_base, estabilidad, rigidez, flexibilidad, dureza, conductividad, transparencia, interaccion, " +\n',
    '"masa_base, volumen_base, estabilidad, rigidez, flexibilidad, dureza, conductividad, transparencia, interaccion, " +\n',
    'CONFIG Elemento.volumen_base',
)

ts = replace(
    ts,
    '{ clave: "masa_base", label: "Masa", valor: fmt(el.masa_base, 2), descripcion: "Peso base del elemento, derivado de sus 3 capas de partículas.", formula: "Masa = 1.00·Masa(núcleo) + 0.75·Equilibrio(núcleo) + 0.50·Cinética(núcleo)" },\n',
    '{ clave: "masa_base", label: "Masa", valor: fmt(el.masa_base, 2), descripcion: "Cantidad de masa fundamental del elemento en la escala interna de Garlia.", formula: "Masa = 1.00·Masa(núcleo) + 0.75·Equilibrio(núcleo) + 0.50·Cinética(núcleo)" },\n' \
    '    { clave: "volumen_base", label: "Volumen", valor: fmt(el.volumen_base, 2), descripcion: "Espacio de referencia asociado a la configuración del elemento; no es una magnitud 0–1.", formula: "Volumen base = número total de partículas de la configuración elemental" },\n',
    'Elemento Masa + Volumen',
)

# ------------------------- Compuesto -------------------------
ts = replace(
    ts,
    '  energia_enlace?: number | null;\n  clasificacion?: string | null;\n',
    '  energia_enlace?: number | null;\n  volumen?: number | null;\n  densidad?: number | null;\n  clasificacion?: string | null;\n',
    'Compuesto.volumen/densidad',
)

ts = replace(
    ts,
    '"compatibilidad, energia_enlace, clasificacion, tipo_estructura",\n',
    '"compatibilidad, energia_enlace, volumen, densidad, clasificacion, tipo_estructura",\n',
    'CONFIG_COMPUESTOS volumen/densidad',
)

ts = replace(
    ts,
    '{ clave: "masa", label: "Masa", valor: fmt(c.masa, 2), descripcion: "Masa total del compuesto, derivada de sus elementos componentes.", formula: "Masa = Σ (cantidad × masa base de cada elemento)" },\n',
    '{ clave: "masa", label: "Masa", valor: fmt(c.masa, 2), descripcion: "Cantidad total de masa contenida en el compuesto. Es una magnitud interna, no un índice 0–1.", formula: "Masa = Σ (cantidad × masa base de cada elemento)" },\n' \
    '    { clave: "volumen", label: "Volumen", valor: fmt(c.volumen, 2), descripcion: "Espacio ocupado por el compuesto según su cantidad de partículas y su organización estructural.", formula: "V = V_composición × F_geom" },\n' \
    '    { clave: "densidad", label: "Densidad", valor: fmt(c.densidad, 4), descripcion: "Concentración de masa respecto al volumen ocupado. No es un índice 0–1.", formula: "ρ = M / V" },\n',
    'Compuesto Masa + Volumen + Densidad',
)

TSX.write_text(ts)

# ------------------------- InfoPopover -------------------------
# Añade las explicaciones especiales sin tocar la tabla general 0..1.
pop = replace(
    pop,
    'const SIGNIFICADOS: Record<string, string> = {\n',
    'const SIGNIFICADOS: Record<string, string> = {\n' \
    '  masa_base: "Cantidad total de masa fundamental de la entidad en la escala interna del sistema; no es un porcentaje.",\n' \
    '  volumen_base: "Espacio de referencia ocupado por la configuración elemental; no es un índice 0–1.",\n' \
    '  volumen: "Espacio ocupado por el compuesto en función de su composición y organización espacial; no es un índice 0–1.",\n' \
    '  densidad: "Relación entre la masa contenida y el volumen ocupado: masa por unidad de volumen; no es un índice 0–1.",\n',
    'InfoPopover significados de masa/volumen/densidad',
)

# La vista no debe llamar "Este valor no es un índice" sin contexto.
pop = replace(
    pop,
    '                      <div className="text-micro text-primary/40 leading-relaxed">Este valor no es un índice 0–1.</div>\n',
    '                      <div className="text-micro text-primary/40 leading-relaxed">Magnitud absoluta o derivada; se interpreta por su escala interna y su fórmula, no por la escala 0–1.</div>\n',
    'InfoPopover texto de magnitudes',
)

POP.write_text(pop)
PY

echo
echo "=== git diff --check ==="
git diff --check -- "$TSX" "$POP"

echo
echo "=== archivos modificados ==="
echo "$TSX"
echo "$POP"
echo
echo "Backups creados:"
echo "$TSX.bak"
echo "$POP.bak"
