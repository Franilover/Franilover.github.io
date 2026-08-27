#!/usr/bin/env bash
set -euo pipefail

TSX="src/domains/garlia/elementos/types.ts"
POPOVER="src/domains/garlia/elementos/InfoFormulasPopover.tsx"

for f in "$TSX" "$POPOVER"; do
  [[ -f "$f" ]] || { echo "ERROR: no existe $f"; exit 1; }
  cp -n "$f.bak" "$f.bak.prev" 2>/dev/null || true
  cp "$f" "$f.bak"
done

python3 - "$TSX" "$POPOVER" <<'PY'
from pathlib import Path
import re, sys

ts_path = Path(sys.argv[1])
pop_path = Path(sys.argv[2])
ts = ts_path.read_text()
pop = pop_path.read_text()

# ---------- helpers ----------
def once(text, pattern, replacement, label, flags=0):
    if re.search(pattern, text, flags):
        print(f"[OK] {label}: ya aplicado")
        return text
    new, n = re.subn(pattern, replacement, text, count=1, flags=flags)
    if not n:
        raise SystemExit(f"[ERROR] no encontré un patrón compatible para {label}")
    print(f"[OK] {label}: aplicado")
    return new

# ---------- types.ts: Element ----------
if 'interaccion?: number | null;' not in ts:
    ts = once(ts,
        r'(\s+transparencia\?: number \| null;)',
        r'\1\n  interaccion?: number | null;',
        'Elemento.interaccion')
else:
    print('[OK] Elemento.interaccion: ya aplicado')

if 'transparencia, interaccion, ' not in ts:
    ts = once(ts,
        r'("masa_base, estabilidad, rigidez, flexibilidad, dureza, conductividad, transparencia),?\s*" \+|"masa_base, estabilidad, rigidez, flexibilidad, dureza, conductividad, transparencia, " \+)',
        '"masa_base, estabilidad, rigidez, flexibilidad, dureza, conductividad, transparencia, interaccion, " +',
        'CONFIG Elemento.interaccion')
else:
    print('[OK] CONFIG Elemento.interaccion: ya aplicado')

if 'clave: "interaccion"' not in ts:
    anchor = r'(\{ clave: "transparencia".*?\n)'
    m = re.search(anchor, ts, re.S)
    if not m:
        raise SystemExit('[ERROR] no encontré la propiedad transparencia de Elemento')
    line = '    { clave: "interaccion", label: "Interacción", valor: fmt(el.interaccion), proporcion: prop(el.interaccion), descripcion: "Facilidad con la que el elemento se acopla o responde a su entorno.", formula: "Interacción = propiedad derivada de la capacidad de acoplamiento del elemento." },\n'
    ts = ts[:m.end()] + line + ts[m.end():]
    print('[OK] Elemento: Interacción en propiedadesCalculadasDeElemento')
else:
    print('[OK] Elemento Interacción: ya aplicado')

# Remove the old inverse-rigidity wording wherever it exists.
ts = ts.replace(
    'formula: "Rigidez = 1 − Flexibilidad (mismos componentes, en sentido inverso)"',
    'formula: "Rigidez = propiedad derivada de la estructura y composición del elemento."'
)

# ---------- types.ts: Compuesto ----------
if 'interaccion?: number | null;' not in ts.split('export interface Compuesto',1)[-1].split('export const CONFIG_COMPUESTOS',1)[0]:
    block_pat = r'(export interface Compuesto \{.*?\n  flexibilidad\?: number \| null;)(\n)'
    ts = once(ts, block_pat,
        r'\1\n  dureza?: number | null;\n  conductividad?: number | null;\n  transparencia?: number | null;\n  interaccion?: number | null;\n',
        'Compuesto nuevas propiedades', flags=re.S)
else:
    print('[OK] Compuesto nuevas propiedades: ya aplicadas')

if 'flexibilidad, dureza, conductividad, transparencia, interaccion,' not in ts:
    ts = once(ts,
        r'("flexibilidad, )(?:compatibilidad, energia_enlace,)',
        r'"flexibilidad, dureza, conductividad, transparencia, interaccion, compatibilidad, energia_enlace,',
        'CONFIG_COMPUESTOS nuevas propiedades')
else:
    print('[OK] CONFIG_COMPUESTOS nuevas propiedades: ya aplicadas')

# Insert the four properties after compound flexibilidad if missing.
if 'clave: "dureza", label: "Dureza", valor: fmt(c.dureza)' not in ts:
    anchor = r'(    \{ clave: "flexibilidad".*?\n)'
    m = re.search(anchor, ts, re.S)
    if not m:
        raise SystemExit('[ERROR] no encontré flexibilidad de Compuesto')
    extra = '''    { clave: "dureza", label: "Dureza", valor: fmt(c.dureza), proporcion: prop(c.dureza), descripcion: "Resistencia del compuesto a ser rayado o penetrado.", formula: "Propiedad derivada de la composición y estructura del compuesto." },\n    { clave: "conductividad", label: "Conductividad", valor: fmt(c.conductividad), proporcion: prop(c.conductividad), descripcion: "Facilidad del compuesto para transmitir una influencia a través de su estructura.", formula: "Propiedad derivada de la capacidad de transmisión de sus componentes." },\n    { clave: "transparencia", label: "Transparencia", valor: fmt(c.transparencia), proporcion: prop(c.transparencia), descripcion: "Facilidad con la que una influencia atraviesa el compuesto sin quedar retenida.", formula: "Propiedad derivada de la capacidad de paso de sus componentes." },\n    { clave: "interaccion", label: "Interacción", valor: fmt(c.interaccion), proporcion: prop(c.interaccion), descripcion: "Facilidad con la que el compuesto se acopla con su entorno.", formula: "Propiedad derivada de la capacidad de acoplamiento de sus componentes." },\n'''
    ts = ts[:m.end()] + extra + ts[m.end():]
    print('[OK] Compuesto: cuatro propiedades nuevas')
else:
    print('[OK] Compuesto propiedades nuevas: ya aplicadas')

# Replace stale compound formula prose with semantic descriptions.
repls = {
    r'formula: "Estabilidad = .*?"': 'formula: "Propiedad derivada de la composición y estructura del compuesto."',
    r'formula: "Rigidez = .*?"': 'formula: "Propiedad derivada de la composición y estructura del compuesto."',
    r'formula: "Flexibilidad = .*?"': 'formula: "Propiedad derivada de la composición y estructura del compuesto."',
}
for pat, rep in repls.items():
    ts = re.sub(pat, rep, ts, count=1)

# ---------- InfoFormulasPopover.tsx ----------
if 'const RANGOS_GENERALES' not in pop:
    pop = '''"use client";\n\nimport { Info, X } from "lucide-react";\nimport React, { useEffect, useRef, useState } from "react";\n\nimport type { PropiedadCalculada } from "./types";\n\nconst RANGOS_GENERALES = [\n  { desde: 0.0, hasta: 0.199, nombre: "Muy baja" },\n  { desde: 0.2, hasta: 0.399, nombre: "Baja" },\n  { desde: 0.4, hasta: 0.599, nombre: "Media" },\n  { desde: 0.6, hasta: 0.799, nombre: "Alta" },\n  { desde: 0.8, hasta: 1.0, nombre: "Muy alta" },\n];\n\nconst SIGNIFICADOS: Record<string, string> = {\n  rigidez: "Resistencia a cambiar de forma cuando actúa una fuerza.",\n  flexibilidad: "Capacidad de cambiar de forma conservando su integridad.",\n  estabilidad: "Tendencia a conservar su estado frente a ruptura o transformación.",\n  dureza: "Resistencia a penetración, rayado o deformación local.",\n  conductividad: "Facilidad para transmitir una influencia a través de su estructura.",\n  transparencia: "Facilidad para dejar pasar una influencia sin retenerla.",\n  interaccion: "Facilidad para acoplarse o responder a su entorno.",\n};\n\nfunction nivelPara(valor?: number): string | null {\n  if (valor === undefined || !Number.isFinite(valor)) return null;\n  return RANGOS_GENERALES.find((r) => valor >= r.desde && valor <= r.hasta)?.nombre ?? null;\n}\n\nexport function InfoFormulasPopover({ propiedades }: { propiedades: PropiedadCalculada[] }) {\n  const [abierto, setAbierto] = useState(false);\n  const ref = useRef<HTMLDivElement>(null);\n  const conFormula = propiedades.filter((p) => p.formula);\n\n  useEffect(() => {\n    if (!abierto) return;\n    const onClickFuera = (e: MouseEvent) => {\n      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);\n    };\n    const onKeyDown = (e: KeyboardEvent) => {\n      if (e.key === "Escape") setAbierto(false);\n    };\n    document.addEventListener("mousedown", onClickFuera);\n    document.addEventListener("keydown", onKeyDown);\n    return () => {\n      document.removeEventListener("mousedown", onClickFuera);\n      document.removeEventListener("keydown", onKeyDown);\n    };\n  }, [abierto]);\n\n  if (conFormula.length === 0) return null;\n\n  return (\n    <div className="relative" ref={ref}>\n      <button\n        type="button"\n        onClick={() => setAbierto((v) => !v)}\n        title="Cómo se calcula y cómo interpretar cada propiedad"\n        aria-label="Cómo se calcula y cómo interpretar cada propiedad"\n        className={`flex items-center justify-center w-4 h-4 rounded-full transition-colors ${\n          abierto ? "bg-primary/20 text-primary" : "text-primary/30 hover:text-primary/60 hover:bg-primary/8"\n        }`}\n      >\n        <Info size={11} />\n      </button>\n\n      {abierto && (\n        <div\n          className="absolute left-0 top-[calc(100%+6px)] z-50 w-[min(44rem,calc(100vw-1.5rem))] max-h-[28rem] overflow-y-auto rounded-lg border border-primary/15 shadow-xl p-2.5"\n          style={{ background: "var(--bg-main)" }}\n        >\n          <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-primary/10">\n            <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/40">\n              Cómo leer las propiedades\n            </span>\n            <button type="button" onClick={() => setAbierto(false)} className="text-primary/30 hover:text-primary/60 transition-colors" aria-label="Cerrar">\n              <X size={12} />\n            </button>\n          </div>\n\n          <div className="grid grid-cols-2 gap-2 pt-2">\n            <div className="rounded-md border border-primary/10 bg-primary/[0.025] p-2">\n              <span className="text-[10px] font-black uppercase tracking-widest text-primary/35">De dónde sale</span>\n            </div>\n            <div className="rounded-md border border-primary/10 bg-primary/[0.025] p-2">\n              <span className="text-[10px] font-black uppercase tracking-widest text-primary/35">Qué significa</span>\n            </div>\n\n            {conFormula.map((p) => {\n              const nivel = nivelPara(p.proporcion);\n              const significado = SIGNIFICADOS[p.clave] ?? p.descripcion;\n              return (\n                <React.Fragment key={p.clave}>\n                  <div className="rounded-md border border-primary/10 p-2 min-w-0">\n                    <div className="text-micro font-bold text-primary/70 mb-0.5">{p.label}</div>\n                    <div className="text-micro font-mono text-primary/45 leading-relaxed break-words">{p.formula}</div>\n                  </div>\n                  <div className="rounded-md border border-primary/10 p-2 min-w-0">\n                    <div className="text-micro font-bold text-primary/70 mb-0.5">{significado}</div>\n                    {p.proporcion !== undefined ? (\n                      <>\n                        <div className="text-micro text-primary/50 leading-relaxed">\n                          <span className="font-black text-primary/70">{nivel ?? "Intermedio"}</span>{" "}\n                          · índice normalizado de <span className="font-mono">0 a 1</span>.\n                        </div>\n                        <div className="mt-1.5 grid grid-cols-5 gap-1">\n                          {RANGOS_GENERALES.map((r) => (\n                            <div key={r.nombre} className="text-[9px] leading-tight text-primary/35">\n                              <div className="font-bold text-primary/50">{r.nombre}</div>\n                              <div>{r.desde.toFixed(1)}–{r.hasta.toFixed(1)}</div>\n                            </div>\n                          ))}\n                        </div>\n                      </>\n                    ) : (\n                      <div className="text-micro text-primary/40 leading-relaxed">Este valor no es un índice 0–1.</div>\n                    )}\n                  </div>\n                </React.Fragment>\n              );\n            })}\n          </div>\n        </div>\n      )}\n    </div>\n  );\n}\n'''
    print('[OK] InfoFormulasPopover: reemplazado con dos columnas')
else:
    print('[OK] InfoFormulasPopover: ya usa dos columnas')

# Avoid any obviously stale direct formula text in the popover data source.
ts_path.write_text(ts)
pop_path.write_text(pop)
PY

echo
if command -v git >/dev/null 2>&1; then
  echo '=== git diff --check ==='
  git diff --check -- "$TSX" "$POPOVER"
  echo
  echo '=== git diff ==='
  git diff -- "$TSX" "$POPOVER"
fi

echo
printf 'Listo. Backups: %s.bak y %s.bak\n' "$TSX" "$POPOVER"
