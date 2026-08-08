"use client";

/**
 * PerfilAtomicoCriaturaPanel.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Perfil de una criatura, en 3 bloques con semántica distinta (ver types.ts
 * para el detalle de diseño):
 *
 *   1. Canalización: qué Oris puede usar activamente si es mágica —
 *      afinidad de USO. Los Oris son leyes externas al universo, no algo
 *      de lo que la criatura "está hecha".
 *   2. Rasgos evolutivos: marca física permanente por Fantasía evolutiva/
 *      residual — exposición ambiental acumulada a un Oris concreto.
 *   3. Composición material: de qué está hecho el tejido duro/mineral
 *      (huesos, caparazón, escamas) — reusa TAL CUAL el motor de
 *      afinidad.ts de Elementos (calcularPerfilAtomico, calcularBalance-
 *      PorCapa, calcularReactividad, calcularPeso). NO representa a la
 *      criatura entera: hoy la Tabla Química es geología/minerales, sin
 *      elementos orgánicos todavía.
 */

import { Atom, Bug, Plus, Search, Wand2, X, Zap } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";

import {
  autocompletarHastaEstable,
  calcularBalancePorCapa,
  calcularPerfilAtomico,
  calcularPeso,
  calcularReactividad,
  sugerirElementosParaCompletar,
} from "@/domains/garlia/elementos/afinidad";
import { useElementos } from "@/domains/garlia/elementos/useElementos";
import {
  LAYER_LABEL,
  REACTIVIDAD_LABEL,
  formatLayer,
  type Compuesto,
  type ComponenteCompuesto,
  type Elemento,
  type LayerName,
} from "@/domains/garlia/elementos/types";
import { useOris } from "@/domains/garlia/fisica/useFisica";
import { useCriaturasCatalogoMin } from "@/domains/garlia/runas/useCriaturasCatalogoMin";

import { usePerfilesAtomicosCriatura } from "./useBiologia";
import { TIPO_RASGO_EVOLUTIVO_LABEL, type RasgoEvolutivo } from "./types";

const LAYERS: LayerName[] = ["nucleo", "media", "externa"];

/**
 * Nombre corto de un elemento por id — usado en los chips de "elegidos"
 * del selector rico. Mismo helper que nombreElemento en CompuestosPage.
 */
function nombreElemento(elementos: Elemento[], id: string): string {
  return elementos.find((e) => e.id === id)?.nombre ?? "??";
}

// ─── Barra de balance de una capa ───────────────────────────────────────────

function BarraCapa({
  layer,
  perfil,
  total,
  capacidad,
}: {
  layer: LayerName;
  perfil: Record<string, number | undefined>;
  total: number;
  capacidad: number;
}) {
  const balance = total - capacidad;
  const pct = capacidad > 0 ? Math.min(100, (total / capacidad) * 100) : 0;

  return (
    <div className="mb-2.5 last:mb-0">
      <div className="flex items-center justify-between mb-1">
        <span className="text-micro font-black uppercase tracking-wide text-primary/50">
          {LAYER_LABEL[layer]}
        </span>
        <span className="text-micro font-bold text-primary/40">
          {total}/{capacidad}{" "}
          {balance === 0 ? "(saturada)" : balance > 0 ? `(+${balance})` : `(${balance})`}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-primary/8 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            balance < 0 ? "bg-amber-400/60" : balance > 0 ? "bg-accent/60" : "bg-emerald-400/60"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-micro text-primary/35 mt-0.5 block">{formatLayer(perfil)}</span>
    </div>
  );
}

// ─── Selector rico de elementos componentes ─────────────────────────────────
// Mismo patrón que SelectorElementosCompuesto en CompuestosPage: chips
// toggle con stepper +/- para los ya elegidos, y los que más ayudan a
// cerrar el déficit actual (sugerirElementosParaCompletar) destacados
// primero con badge — guía la elección de qué "materia dura" tiene la
// criatura en vez de un buscador a ciegas.
function SelectorElementosCriatura({
  elementos,
  componentes,
  onChange,
}: {
  elementos: Elemento[];
  componentes: ComponenteCompuesto[];
  onChange: (componentes: ComponenteCompuesto[]) => void;
}) {
  const idsElegidos = new Set(componentes.map((c) => c.elemento_id));

  const sugerencias = useMemo(
    () => sugerirElementosParaCompletar(componentes, elementos),
    [componentes, elementos],
  );
  const idsSugeridos = useMemo(
    () => new Set(sugerencias.slice(0, 3).map((s) => s.elemento.id)),
    [sugerencias],
  );

  function toggleElemento(id: string) {
    if (idsElegidos.has(id)) {
      onChange(componentes.filter((c) => c.elemento_id !== id));
    } else {
      onChange([...componentes, { elemento_id: id, cantidad: 1 }]);
    }
  }

  function setCantidad(id: string, cantidad: number) {
    onChange(
      componentes.map((c) =>
        c.elemento_id === id ? { ...c, cantidad: Math.max(1, cantidad) } : c,
      ),
    );
  }

  const disponibles = elementos.filter((el) => !idsElegidos.has(el.id));
  const disponiblesOrdenados = [
    ...disponibles.filter((el) => idsSugeridos.has(el.id)),
    ...disponibles.filter((el) => !idsSugeridos.has(el.id)),
  ];

  return (
    <div className="flex flex-col gap-2">
      {/* Elegidos, con stepper de cantidad */}
      {componentes.length > 0 && (
        <div className="flex flex-col gap-1">
          {componentes.map((c) => (
            <div
              key={c.elemento_id}
              className="flex items-center gap-1.5 bg-primary/5 rounded-md pl-2 pr-1 py-1 border border-primary/10"
            >
              <span className="flex-1 min-w-0 truncate text-micro font-bold text-primary/80">
                {nombreElemento(elementos, c.elemento_id)}
              </span>
              <div className="shrink-0 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCantidad(c.elemento_id, c.cantidad - 1)}
                  className="w-5 h-5 flex items-center justify-center rounded border border-primary/15 text-primary/50 hover:text-primary hover:border-primary/35 transition-all cursor-pointer"
                >
                  −
                </button>
                <span className="w-4 text-center text-micro font-black text-primary tabular-nums">
                  {c.cantidad}
                </span>
                <button
                  type="button"
                  onClick={() => setCantidad(c.elemento_id, c.cantidad + 1)}
                  className="w-5 h-5 flex items-center justify-center rounded border border-primary/15 text-primary/50 hover:text-primary hover:border-primary/35 transition-all cursor-pointer"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => toggleElemento(c.elemento_id)}
                  title="Quitar"
                  className="w-5 h-5 flex items-center justify-center rounded border border-red-500/15 text-red-400/50 hover:text-red-400 hover:border-red-500/40 transition-all cursor-pointer"
                >
                  <X size={10} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Disponibles para agregar — los que más cierran el déficit actual
          van primero, marcados con un puntito. */}
      <div className="flex flex-wrap gap-1">
        {disponiblesOrdenados.map((el) => {
          const sugerido = idsSugeridos.has(el.id);
          return (
            <button
              key={el.id}
              type="button"
              onClick={() => toggleElemento(el.id)}
              title={
                sugerido
                  ? `${el.nombre} — completa parte del déficit actual`
                  : `Agregar ${el.nombre}`
              }
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-micro font-bold border transition-all cursor-pointer ${
                sugerido
                  ? "border-emerald-500/30 text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/15"
                  : "border-primary/15 text-primary/50 hover:text-primary hover:border-primary/35 hover:bg-primary/5"
              }`}
            >
              {sugerido && <span className="w-1 h-1 rounded-full bg-emerald-500 shrink-0" />}
              <span className="font-black">{el.simbolo || "??"}</span>
              <span className="truncate max-w-[80px]">{el.nombre}</span>
            </button>
          );
        })}
        {elementos.length === 0 && (
          <p className="text-micro text-primary/25">
            Todavía no hay elementos en la Tabla Química para asignar.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Rasgos evolutivos (Fantasía evolutiva/residual) ───────────────────────
// Marca física permanente por exposición ambiental acumulada a un Oris/-ium
// concreto — distinto de "canaliza este Oris": acá la criatura no controla
// nada, solo quedó marcada por vivir expuesta a esa fuerza (ver conceptos
// "Las tres fuentes de fantasía" en Física).
function RasgoEvolutivoRow({
  rasgo,
  orisDisponibles,
  onChange,
  onEliminar,
}: {
  rasgo: RasgoEvolutivo;
  orisDisponibles: { id: string; nombre: string }[];
  onChange: (cambios: Partial<RasgoEvolutivo>) => void;
  onEliminar: () => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 p-2 rounded-lg border border-primary/10 bg-primary/[0.02]">
      <div className="flex items-center gap-1.5">
        <select
          value={rasgo.oris_id}
          onChange={(e) => onChange({ oris_id: e.target.value })}
          className="min-w-0 bg-primary/5 rounded-md px-1.5 py-1 text-micro font-bold text-primary outline-none border border-primary/10 focus:border-primary/30"
        >
          <option value="">Oris de origen…</option>
          {orisDisponibles.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nombre}
            </option>
          ))}
        </select>
        <select
          value={rasgo.tipo}
          onChange={(e) => onChange({ tipo: e.target.value as RasgoEvolutivo["tipo"] })}
          className="shrink-0 bg-primary/5 rounded-md px-1.5 py-1 text-micro font-bold text-primary/70 outline-none border border-primary/10 focus:border-primary/30"
        >
          {(Object.keys(TIPO_RASGO_EVOLUTIVO_LABEL) as RasgoEvolutivo["tipo"][]).map((t) => (
            <option key={t} value={t}>
              {t === "evolutiva" ? "Evolutiva" : "Residual"}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onEliminar}
          title="Eliminar rasgo"
          className="shrink-0 w-6 h-6 flex items-center justify-center rounded-md border border-red-500/15 text-red-400/50 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/5 transition-all cursor-pointer"
        >
          <X size={11} />
        </button>
      </div>
      <input
        value={rasgo.descripcion}
        onChange={(e) => onChange({ descripcion: e.target.value })}
        placeholder="Ej. Piel resistente al calor por exposición residual a Thermoris…"
        className="w-full bg-transparent text-xs text-primary/80 outline-none placeholder:text-primary/30 border-b border-primary/10 pb-1 focus:border-primary/30"
      />
      <p className="text-micro text-primary/30">{TIPO_RASGO_EVOLUTIVO_LABEL[rasgo.tipo]}</p>
    </div>
  );
}

// ─── Panel de una criatura individual ───────────────────────────────────────

export function PanelPerfilCriatura({
  criaturaId,
  criaturaNombre,
  elementos,
  orisDisponibles,
  obtenerOCrear,
  actualizar,
}: {
  criaturaId: string;
  criaturaNombre: string;
  elementos: Elemento[];
  orisDisponibles: { id: string; nombre: string }[];
  obtenerOCrear: ReturnType<typeof usePerfilesAtomicosCriatura>["obtenerOCrear"];
  actualizar: ReturnType<typeof usePerfilesAtomicosCriatura>["actualizar"];
}) {
  const [perfilId, setPerfilId] = useState<string | null>(null);
  const [componentes, setComponentes] = useState<ComponenteCompuesto[]>([]);
  const [orisIds, setOrisIds] = useState<string[]>([]);
  const [rasgosEvolutivos, setRasgosEvolutivos] = useState<RasgoEvolutivo[]>([]);
  const [notas, setNotas] = useState("");

  useEffect(() => {
    let cancelado = false;
    void obtenerOCrear(criaturaId).then((p) => {
      if (cancelado || !p) return;
      setPerfilId(p.id);
      setComponentes(p.componentes ?? []);
      setOrisIds(p.oris_ids ?? []);
      setRasgosEvolutivos(p.rasgos_evolutivos ?? []);
      setNotas(p.notas ?? "");
    });
    return () => {
      cancelado = true;
    };
  }, [criaturaId]);

  const guardar = (patch: {
    componentes?: ComponenteCompuesto[];
    oris_ids?: string[];
    rasgos_evolutivos?: RasgoEvolutivo[];
    notas?: string;
  }) => {
    if (!perfilId) return;
    void actualizar(perfilId, patch);
  };

  const compuestoTemporal: Compuesto = useMemo(
    () => ({ id: criaturaId, nombre: criaturaNombre, componentes }),
    [criaturaId, criaturaNombre, componentes],
  );

  const perfilAtomico = useMemo(
    () => calcularPerfilAtomico(compuestoTemporal, elementos),
    [compuestoTemporal, elementos],
  );
  const balance = useMemo(() => calcularBalancePorCapa(perfilAtomico), [perfilAtomico]);
  const reactividad = useMemo(
    () => calcularReactividad(compuestoTemporal, elementos),
    [compuestoTemporal, elementos],
  );
  const peso = useMemo(() => calcularPeso(compuestoTemporal, elementos), [compuestoTemporal, elementos]);

  const cambiarComponentes = (next: ComponenteCompuesto[]) => {
    setComponentes(next);
    guardar({ componentes: next });
  };

  // Auto-completar hasta estable — mismo motor que CompuestosPage: agrega
  // en orden greedy los elementos que más déficit cierran hasta que las 3
  // capas queden en 0 o no haya más candidatos que ayuden.
  const autocompletar = () => {
    const next = autocompletarHastaEstable(componentes, elementos);
    cambiarComponentes(next);
  };

  const toggleOris = (orisId: string) => {
    const next = orisIds.includes(orisId)
      ? orisIds.filter((id) => id !== orisId)
      : [...orisIds, orisId];
    setOrisIds(next);
    guardar({ oris_ids: next });
  };

  const agregarRasgo = () => {
    const next: RasgoEvolutivo[] = [
      ...rasgosEvolutivos,
      { id: `rasgo-${Date.now()}`, oris_id: "", descripcion: "", tipo: "residual" },
    ];
    setRasgosEvolutivos(next);
    guardar({ rasgos_evolutivos: next });
  };
  const cambiarRasgo = (id: string, cambios: Partial<RasgoEvolutivo>) => {
    const next = rasgosEvolutivos.map((r) => (r.id === id ? { ...r, ...cambios } : r));
    setRasgosEvolutivos(next);
    guardar({ rasgos_evolutivos: next });
  };
  const eliminarRasgo = (id: string) => {
    const next = rasgosEvolutivos.filter((r) => r.id !== id);
    setRasgosEvolutivos(next);
    guardar({ rasgos_evolutivos: next });
  };

  if (!perfilId) {
    return <div className="py-4 text-xs text-primary/30 text-center">Cargando perfil…</div>;
  }

  return (
    <div>
      {/* Bloque 1: Canalización — qué Oris puede canalizar activamente si
          es mágica. Afinidad de USO, no de composición: un Oris es una
          ley externa al universo, no algo de lo que la criatura "está
          hecha". */}
      <div className="mb-4">
        <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/40 block mb-1.5">
          Canalización — Oris que puede usar
        </span>
        <p className="text-micro text-primary/30 mb-1.5 -mt-1">
          Solo si es mágica. Los Oris son leyes externas al universo; esto marca qué fuerzas puede dirigir, no de qué está hecha.
        </p>
        {orisDisponibles.length === 0 ? (
          <p className="text-micro text-primary/25 italic py-1">No hay Oris cargados todavía</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {orisDisponibles.map((o) => {
              const activo = orisIds.includes(o.id);
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => toggleOris(o.id)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-micro font-bold transition-colors ${
                    activo
                      ? "border-accent/40 bg-accent/10 text-accent"
                      : "border-primary/10 text-primary/50 hover:border-primary/25"
                  }`}
                >
                  <Zap size={9} />
                  {o.nombre}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Bloque 2: Rasgos evolutivos — marca física permanente por
          Fantasía evolutiva (adaptación generacional) o residual
          (exposición acumulada sin canalización activa). */}
      <div className="mb-4 pt-4 border-t border-primary/10">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/40">
            Rasgos evolutivos
          </span>
          <button
            type="button"
            onClick={agregarRasgo}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-micro font-black uppercase tracking-wide border border-dashed border-primary/20 text-primary/40 hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer"
          >
            <Plus size={9} /> Agregar rasgo
          </button>
        </div>
        <p className="text-micro text-primary/30 mb-1.5 -mt-1">
          Marca física permanente por exposición ambiental a un Oris — distinto de canalizarlo.
        </p>
        {rasgosEvolutivos.length === 0 ? (
          <p className="text-micro text-primary/25 italic py-1">Sin rasgos evolutivos todavía</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {rasgosEvolutivos.map((r) => (
              <RasgoEvolutivoRow
                key={r.id}
                rasgo={r}
                orisDisponibles={orisDisponibles}
                onChange={(cambios) => cambiarRasgo(r.id, cambios)}
                onEliminar={() => eliminarRasgo(r.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Bloque 3: Composición material — de qué está hecho el tejido
          duro/mineral (huesos, caparazón, escamas), reusando el motor de
          afinidad.ts de Elementos. NO representa a la criatura entera. */}
      <div className="mb-4 pt-4 border-t border-primary/10">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/40">
            Composición material (tejido duro)
          </span>
          {componentes.length > 0 && (
            <button
              type="button"
              onClick={autocompletar}
              title="Agregar elementos hasta cerrar el déficit de las 3 capas"
              className="flex items-center gap-1 px-2 py-1 rounded-md text-micro font-black uppercase tracking-wide border border-primary/15 text-primary/50 hover:text-primary hover:border-primary/35 hover:bg-primary/5 transition-all cursor-pointer"
            >
              <Wand2 size={10} /> Autocompletar
            </button>
          )}
        </div>
        <p className="text-micro text-primary/30 mb-1.5 -mt-1">
          Elementos de la Tabla Química que forman huesos, caparazón, escamas u otro tejido duro/mineral — no representa al organismo entero (hoy la Tabla es geología/minerales, sin elementos orgánicos).
        </p>

        <SelectorElementosCriatura
          elementos={elementos}
          componentes={componentes}
          onChange={cambiarComponentes}
        />
      </div>

      {/* Balance por capa */}
      {componentes.length > 0 && (
        <div className="mb-4 p-3 rounded-xl border border-primary/10 bg-primary/[0.02]">
          {LAYERS.map((layer) => {
            const b = balance.find((x) => x.layer === layer)!;
            return (
              <BarraCapa
                key={layer}
                layer={layer}
                perfil={perfilAtomico[layer]}
                total={b.total}
                capacidad={b.capacidad}
              />
            );
          })}


          <div className="flex items-center justify-between mt-3 pt-3 border-t border-primary/10">
            <span className="text-micro font-bold text-primary/50">
              Reactividad: <span className="text-primary/80">{REACTIVIDAD_LABEL[reactividad.nivel]}</span>
            </span>
            <span className="text-micro font-bold text-primary/50">
              Peso: <span className="text-primary/80">{peso.pesoTotal} ({peso.categoria})</span>
            </span>
          </div>
        </div>
      )}

      {/* Notas libres */}
      <div>
        <span className="text-micro font-black uppercase tracking-[0.15em] text-primary/40 block mb-1.5">
          Notas
        </span>
        <textarea
          className="w-full min-h-[4.5rem] bg-primary/[0.02] border border-primary/10 rounded-lg px-2.5 py-1.5 text-xs text-primary/70 outline-none placeholder:text-primary/30 resize-y"
          placeholder="Comportamiento general, dieta, hábitat, cualquier otra nota libre…"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          onBlur={() => guardar({ notas })}
        />
      </div>
    </div>
  );
}

// ─── Página principal: buscador de criatura + panel ─────────────────────────

export function PerfilesAtomicosPage() {
  const { items: elementos, loading: loadingElementos } = useElementos();
  const { items: oris, loading: loadingOris } = useOris();
  const { criaturas: catalogo, loading: loadingCatalogo } = useCriaturasCatalogoMin();
  // Cargado una sola vez acá arriba (no adentro de PanelPerfilCriatura) para
  // que cambiar de criatura no dispare un select("*") completo de la tabla
  // perfiles_atomicos_criatura cada vez — con esto el cambio es instantáneo,
  // ya que obtenerOCrear reusa lo que ya está en memoria.
  const { loading: loadingPerfiles, obtenerOCrear, actualizar } =
    usePerfilesAtomicosCriatura();
  const [criaturaId, setCriaturaId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filtradas = useMemo(
    () => catalogo.filter((c) => c.nombre.toLowerCase().includes(search.toLowerCase())),
    [catalogo, search],
  );

  const criaturaSeleccionada = catalogo.find((c) => c.id === criaturaId) ?? null;

  const orisDisponibles = useMemo(
    () => (oris ?? []).map((o) => ({ id: o.id, nombre: o.nombre })),
    [oris],
  );

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="w-full lg:w-64 shrink-0">
        <div className="flex items-center gap-2 mb-2 px-2.5 py-1.5 rounded-lg border border-primary/10 bg-primary/[0.02]">
          <Search size={11} className="text-primary/30 shrink-0" />
          <input
            className="flex-1 min-w-0 bg-transparent text-xs outline-none placeholder:text-primary/30"
            placeholder="Buscar criatura…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loadingCatalogo ? (
          <div className="py-4 text-xs text-primary/30 text-center">Cargando…</div>
        ) : (
          <div className="space-y-1 max-h-[70vh] overflow-y-auto">
            {filtradas.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCriaturaId(c.id)}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs font-bold transition-colors ${
                  c.id === criaturaId
                    ? "bg-primary/10 text-primary"
                    : "text-primary/60 hover:bg-primary/5"
                }`}
              >
                <span className="shrink-0 w-5 h-5 rounded-full overflow-hidden bg-primary/8 flex items-center justify-center">
                  {c.imagen_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt={c.nombre} className="w-full h-full object-cover" src={c.imagen_url} />
                  ) : (
                    <Bug size={9} className="text-primary/25" />
                  )}
                </span>
                <span className="truncate">{c.nombre}</span>
              </button>
            ))}
            {filtradas.length === 0 && (
              <p className="text-micro text-primary/25 italic px-2 py-2">Sin resultados</p>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        {loadingElementos || loadingOris || loadingPerfiles ? (
          <div className="py-6 text-xs text-primary/30 text-center">Cargando…</div>
        ) : criaturaSeleccionada ? (
          <PanelPerfilCriatura
            key={criaturaSeleccionada.id}
            criaturaId={criaturaSeleccionada.id}
            criaturaNombre={criaturaSeleccionada.nombre}
            elementos={elementos}
            orisDisponibles={orisDisponibles}
            obtenerOCrear={obtenerOCrear}
            actualizar={actualizar}
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-primary/15 p-6 text-center">
            <Atom size={16} className="mx-auto mb-2 text-primary/20" />
            <p className="text-xs text-primary/30">
              Elegí una criatura de la lista para ver o editar su perfil atómico.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
