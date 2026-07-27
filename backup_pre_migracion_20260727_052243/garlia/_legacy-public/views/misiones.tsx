"use client";

import { AnimatePresence } from "framer-motion";
import {
  ArrowDown,
  Backpack,
  Ban,
  CheckCircle2,
  CircleDashed,
  CircleOff,
  Clock,
  Dice6,
  EarOff,
  EyeOff,
  Ghost,
  Hand,
  Languages,
  Link2,
  Loader2,
  Minus,
  Moon,
  Mountain,
  Plus,
  Scroll,
  Shield,
  Skull,
  Sparkles,
  Star,
  Sword,
  Target,
  Trash2,
  Wand2,
  Wrench,
  WifiOff,
  X,
  Zap,
} from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";

import { MotionDiv } from "@/components/ui/Motion";
import {
  invalidateSessionCache,
  loadMisiones,
  loadMisionesUsuario,
  reclamarMisionOffline,
} from "@/lib/api/client/syncEngine";

import type {
  AtaqueManual,
  CampoFichaValor,
  ConjuroFicha,
  DoteDnd,
  FichaDnd,
  ItemInventarioFicha,
  MaestriaArma,
  RasgoEspecial,
  TipoMoneda,
} from "../hooks/useFichasDnd";
import {
  bonoAtaqueConjuros,
  bonusCompetencia,
  buscarCriaturas,
  buscarItems,
  caCalculadaDesdeInventario,
  cdSalvacionConjuros,
  DESCRIPCION_MAESTRIA_ARMA,
  dotesGeneralesDisponibles,
  investigacionPasiva,
  MAESTRIAS_ARMA_DND,
  NIVELES_DOTE_GENERAL,
  penalizacionAgotamiento,
  percepcionPasiva,
  perspicaciaPasiva,
  progresoXp,
  statEfectivo,
  statMod,
  STATS_DND,
  TAMANOS_DND,
  useClasesDisponibles,
  useDotesDisponibles,
  useInventarioFicha,
  useSubclasesDisponibles,
  useTiposMoneda,
  useTrasfondosDisponibles,
} from "../hooks/useFichasDnd";
import { SelectorEntidad } from "./fichaComponents";
import {
  ModalMision,
  type Dificultad,
  type MisionConProgreso,
} from "../components/MisionesComponents";

// Mapa de dificultad → número de estrellas (solo iconos, sin fondo ni texto).
const ESTRELLAS_POR_DIFICULTAD: Record<Dificultad, number> = {
  facil: 1,
  media: 2,
  dificil: 3,
} as Record<Dificultad, number>;

function EstrellasDificultad({ dificultad }: { dificultad: Dificultad }) {
  const total = ESTRELLAS_POR_DIFICULTAD[dificultad] ?? 1;
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 3 }).map((_, i) => (
        <Star
          key={i}
          fill={i < total ? "var(--primary)" : "none"}
          size={11}
          style={{
            color:
              i < total
                ? "var(--primary)"
                : "color-mix(in srgb, var(--primary) 25%, transparent)",
          }}
        />
      ))}
    </div>
  );
}

// ─── Panel de ficha (nombre, vida, daño y stats D&D) ───────────────────────
// Reutiliza el mismo lenguaje visual que el panel "Registro" de misiones:
// mismo card, mismo separador con label, mismas barras de 10 segmentos.

const ABREVIATURA_STAT: Record<string, string> = {
  fuerza: "FUE",
  destreza: "DES",
  constitucion: "CON",
  inteligencia: "INT",
  sabiduria: "SAB",
  carisma: "CAR",
};

// Las 18 habilidades (skills) oficiales de D&D, agrupadas por la stat de la
// que dependen. Constitución no tiene skills asociadas, por eso no aparece
// ninguna fila para esa stat.
const SKILLS_POR_STAT: Record<string, Array<{ id: string; nombre: string }>> = {
  fuerza: [{ id: "atletismo", nombre: "Atletismo" }],
  destreza: [
    { id: "acrobacias", nombre: "Acrobacias" },
    { id: "juego_de_manos", nombre: "Juego de manos" },
    { id: "sigilo", nombre: "Sigilo" },
  ],
  constitucion: [],
  inteligencia: [
    { id: "arcanos", nombre: "Arcanos" },
    { id: "historia", nombre: "Historia" },
    { id: "investigacion", nombre: "Investigación" },
    { id: "naturaleza", nombre: "Naturaleza" },
    { id: "religion", nombre: "Religión" },
  ],
  sabiduria: [
    { id: "trato_con_animales", nombre: "Trato con animales" },
    { id: "perspicacia", nombre: "Perspicacia" },
    { id: "medicina", nombre: "Medicina" },
    { id: "percepcion", nombre: "Percepción" },
    { id: "supervivencia", nombre: "Supervivencia" },
  ],
  carisma: [
    { id: "engano", nombre: "Engaño" },
    { id: "intimidacion", nombre: "Intimidación" },
    { id: "interpretacion", nombre: "Interpretación" },
    { id: "persuasion", nombre: "Persuasión" },
  ],
};

// Las 14 condiciones oficiales de D&D 5e. Íconos Lucide en vez de emoji:
// consistentes con el resto de la estética de la app (los emoji desentonaban
// con el lenguaje visual de la ficha).
const CONDICIONES_DND: Array<{ id: string; nombre: string; Icon: React.ElementType }> = [
  { id: "cegado", nombre: "Cegado", Icon: EyeOff },
  { id: "aturdido", nombre: "Aturdido", Icon: CircleDashed },
  { id: "ensordecido", nombre: "Ensordecido", Icon: EarOff },
  { id: "asustado", nombre: "Asustado", Icon: Ghost },
  { id: "agarrado", nombre: "Agarrado", Icon: Hand },
  { id: "incapacitado", nombre: "Incapacitado", Icon: Ban },
  { id: "invisible", nombre: "Invisible", Icon: CircleOff },
  { id: "paralizado", nombre: "Paralizado", Icon: Zap },
  { id: "petrificado", nombre: "Petrificado", Icon: Mountain },
  { id: "envenenado", nombre: "Envenenado", Icon: Skull },
  { id: "derribado", nombre: "Derribado", Icon: ArrowDown },
  { id: "apresado", nombre: "Apresado", Icon: Link2 },
  { id: "atontado", nombre: "Atontado (stunned)", Icon: Sparkles },
  { id: "inconsciente", nombre: "Inconsciente", Icon: Moon },
];

function SeparadorLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div
        className="flex-1 h-px"
        style={{
          background: "color-mix(in srgb, var(--primary) 8%, transparent)",
        }}
      />
      <p
        className="text-micro font-black uppercase tracking-[0.3em]"
        style={{ color: "color-mix(in srgb, var(--primary) 28%, transparent)" }}
      >
        {label}
      </p>
      <div
        className="flex-1 h-px"
        style={{
          background: "color-mix(in srgb, var(--primary) 8%, transparent)",
        }}
      />
    </div>
  );
}

function CampoEditable({
  valor,
  editable,
  onCommit,
  tipo = "text",
  className,
  style,
  align = "left",
  width,
}: {
  valor: string | number;
  editable: boolean;
  onCommit: (valor: string) => void;
  tipo?: "text" | "number";
  className: string;
  style: React.CSSProperties;
  align?: "left" | "right" | "center";
  width?: number;
}) {
  if (!editable) return <>{valor}</>;
  return (
    <input
      type="text"
      inputMode={tipo === "number" ? "numeric" : undefined}
      defaultValue={valor}
      onBlur={(e) => {
        const v = tipo === "number" ? e.target.value.replace(/[^0-9]/g, "") : e.target.value;
        onCommit(v);
      }}
      onChange={
        tipo === "number"
          ? (e) => {
              const filtered = e.target.value.replace(/[^0-9]/g, "");
              if (filtered !== e.target.value) e.target.value = filtered;
            }
          : undefined
      }
      className={`${className} bg-transparent outline-none`}
      style={{
        ...style,
        width: width ?? "100%",
        textAlign: align,
        border: "none",
        borderBottom: "1px dashed color-mix(in srgb, var(--primary) 25%, transparent)",
        padding: 0,
      }}
    />
  );
}

// Celda mínima para la fila de stats de combate (iniciativa, CA, daño,
// competencia, velocidad, percepción): mismo look que las cajas anteriores
// pero compacta, pensada para ir 6 en una sola fila sin sofocar la ficha.
function StatMini({
  label,
  valor,
  sub,
  title,
}: {
  label: string;
  valor: React.ReactNode;
  sub?: string;
  title?: string;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-0 px-0.5 py-1"
      style={{
        border: "1px solid color-mix(in srgb, var(--primary) 10%, transparent)",
        borderRadius: "2px",
        background: "color-mix(in srgb, var(--primary) 3%, transparent)",
      }}
      title={title}
    >
      <span
        className="text-micro font-black uppercase tracking-wider text-center leading-none"
        style={{ color: "color-mix(in srgb, var(--primary) 40%, transparent)", fontSize: 9 }}
      >
        {label}
      </span>
      <span className="text-xs font-black tabular-nums leading-tight" style={{ color: "var(--primary)" }}>
        {valor}
      </span>
      {sub && (
        <span
          className="font-bold tabular-nums leading-none"
          style={{ color: "color-mix(in srgb, var(--primary) 35%, transparent)", fontSize: 8 }}
        >
          {sub}
        </span>
      )}
    </div>
  );
}

// Variante textarea de CampoEditable, para textos largos de rol-play
// (rasgos, ideales, vínculos, defectos). Mismo patrón: solo se ve como
// input cuando `editable`, si no es texto plano.
function CampoEditableTextarea({
  valor,
  editable,
  onCommit,
  placeholder,
}: {
  valor: string | null;
  editable: boolean;
  onCommit: (valor: string) => void;
  placeholder?: string;
}) {
  if (!editable) {
    return (
      <p className="text-xs leading-relaxed text-primary/70 whitespace-pre-wrap">
        {valor?.trim() ? valor : "—"}
      </p>
    );
  }
  return (
    <textarea
      defaultValue={valor ?? ""}
      onBlur={(e) => onCommit(e.target.value)}
      placeholder={placeholder}
      rows={2}
      className="w-full bg-transparent outline-none resize-none text-xs leading-relaxed text-primary/70 placeholder:text-primary/25"
      style={{
        border: "none",
        borderBottom: "1px dashed color-mix(in srgb, var(--primary) 25%, transparent)",
        padding: 0,
      }}
    />
  );
}

// Editor de listas cortas de texto libre (idiomas, herramientas): se ven
// como chips; en modo editable cada chip tiene una X para quitarlo y hay
// un input al final para escribir uno nuevo y confirmarlo con Enter.
function EditorListaTags({
  valores,
  editable,
  onCambiar,
  placeholder,
}: {
  valores: string[];
  editable: boolean;
  onCambiar: (siguientes: string[]) => void;
  placeholder: string;
}) {
  const [nuevo, setNuevo] = useState("");

  const agregar = () => {
    const v = nuevo.trim();
    if (!v) return;
    if (valores.some((existente) => existente.toLowerCase() === v.toLowerCase())) {
      setNuevo("");
      return;
    }
    onCambiar([...valores, v]);
    setNuevo("");
  };

  if (valores.length === 0 && !editable) {
    return <p className="text-xs text-primary/30">—</p>;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {valores.map((v) => (
        <span
          key={v}
          className="flex items-center gap-1 px-2 py-1 text-micro font-semibold rounded-full"
          style={{
            background: "color-mix(in srgb, var(--primary) 6%, transparent)",
            color: "color-mix(in srgb, var(--primary) 70%, transparent)",
          }}
        >
          {v}
          {editable && (
            <span
              role="button"
              onClick={() => onCambiar(valores.filter((x) => x !== v))}
              className="cursor-pointer hover:text-red-500 transition-colors"
            >
              <X size={9} />
            </span>
          )}
        </span>
      ))}
      {editable && (
        <input
          type="text"
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              agregar();
            }
          }}
          onBlur={agregar}
          placeholder={placeholder}
          className="min-w-[90px] flex-1 bg-transparent outline-none text-micro text-primary/60 placeholder:text-primary/25 px-1 py-1"
        />
      )}
    </div>
  );
}
// ─── Contenido de identidad/trasfondo: campos que antes vivían en el panel
// flotante anexo. Ahora se usan como contenido de las tabs Identidad/
// Inventario/Historia dentro del panel fijo (ver ContenidoIdentidadFicha,
// ContenidoInventarioFicha y ContenidoHistoriaFicha, definidas más abajo).

// ── Campo simple de identidad (label + valor/select), sin caja ni borde —
// el look minimalista se apoya en el grid y el espaciado, no en tarjetas. ──
function CampoIdentidad({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span
        className="text-micro font-black uppercase tracking-wider"
        style={{ color: "color-mix(in srgb, var(--primary) 35%, transparent)" }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

// ── Mejora de característica del trasfondo (PHB 2024): el jugador reparte
//    +2/+1 entre dos de las 3 stats que el trasfondo habilita, o +1/+1/+1 a
//    las tres. Si el trasfondo elegido no tiene caracteristicas_trasfondo
//    cargado (mundo homebrew sin ese dato todavía), no se muestra nada. ──
function MejoraTrasfondoBloque({
  caracteristicas,
  valor,
  editable,
  onCambiar,
}: {
  caracteristicas: string[] | null;
  valor: Partial<Record<(typeof STATS_DND)[number], number>>;
  editable: boolean;
  onCambiar: (mejora: Partial<Record<(typeof STATS_DND)[number], number>>) => void;
}) {
  if (!caracteristicas || caracteristicas.length === 0) return null;

  const puntosUsados = Object.values(valor).reduce((acc, v) => acc + (v ?? 0), 0);
  const puntosMax = 3; // +2/+1 o +1/+1/+1: siempre 3 puntos en total (PHB 2024).

  const setPunto = (stat: string, delta: number) => {
    const actual = valor[stat as (typeof STATS_DND)[number]] ?? 0;
    const nuevo = actual + delta;
    if (nuevo < 0 || nuevo > 2) return; // tope por stat: +2 máx (patrón +2/+1)
    if (delta > 0 && puntosUsados >= puntosMax) return;
    const actualizado = { ...valor, [stat]: nuevo };
    if (nuevo === 0) delete actualizado[stat as (typeof STATS_DND)[number]];
    onCambiar(actualizado);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span
          className="text-micro font-black uppercase tracking-wider"
          style={{ color: "color-mix(in srgb, var(--primary) 35%, transparent)" }}
        >
          Mejora de característica (trasfondo)
        </span>
        <span
          className="text-micro"
          style={{ color: "color-mix(in srgb, var(--primary) 30%, transparent)" }}
        >
          {puntosUsados}/{puntosMax} puntos
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {caracteristicas.map((stat) => {
          const bono = valor[stat as (typeof STATS_DND)[number]] ?? 0;
          const label = stat.slice(0, 3).toUpperCase();
          if (!editable) {
            return bono > 0 ? (
              <span
                key={stat}
                className="text-micro font-bold px-2 py-1 rounded-lg"
                style={{
                  background: "color-mix(in srgb, var(--primary) 6%, transparent)",
                  color: "var(--primary)",
                }}
              >
                {label} +{bono}
              </span>
            ) : null;
          }
          return (
            <div
              key={stat}
              className="flex items-center gap-1.5 h-8 px-2 rounded-lg"
              style={{ border: "1px solid color-mix(in srgb, var(--primary) 10%, transparent)" }}
            >
              <span
                className="text-micro font-bold uppercase tracking-wide"
                style={{ color: "color-mix(in srgb, var(--primary) 50%, transparent)" }}
              >
                {label}
              </span>
              <button
                type="button"
                onClick={() => setPunto(stat, -1)}
                disabled={bono <= 0}
                className="w-5 h-5 rounded-full transition-colors disabled:opacity-20"
                style={{ color: "color-mix(in srgb, var(--primary) 40%, transparent)" }}
              >
                −
              </button>
              <span className="w-4 text-center text-xs font-black" style={{ color: "var(--primary)" }}>
                +{bono}
              </span>
              <button
                type="button"
                onClick={() => setPunto(stat, 1)}
                disabled={bono >= 2 || puntosUsados >= puntosMax}
                className="w-5 h-5 rounded-full transition-colors disabled:opacity-20"
                style={{ color: "color-mix(in srgb, var(--primary) 40%, transparent)" }}
              >
                +
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Rasgo asociado a un selector (Clase/Subclase/Trasfondo/Especie): se
//    muestra siempre, justo debajo de su propio campo, no separado en un
//    bloque aparte — así cada elección "trae" su descripción con ella. ──
function RasgoDelCampo({ texto }: { texto: string }) {
  return (
    <p
      className="mt-1 text-xs leading-relaxed whitespace-pre-wrap"
      style={{ color: "color-mix(in srgb, var(--primary) 60%, transparent)" }}
    >
      {texto}
    </p>
  );
}

// ─── Contenido de cada tab del panel de ficha (Identidad / Inventario /
// Historia). Antes vivían dentro de un panel flotante anexo (PanelExpandidoFicha);
// ahora se renderizan directo dentro de FichaStatsPanel como contenido de tab,
// sin overlay ni posicionamiento propio. ──────────────────────────────────

function ContenidoIdentidadFicha({
  ficha,
  editable,
  onEditarCampo,
  clasesDisponibles,
  subclasesDisponibles,
  trasfondosDisponibles,
  dotesGenerales,
}: {
  ficha: FichaDnd;
  editable: boolean;
  onEditarCampo?: (campo: keyof FichaDnd, valor: CampoFichaValor) => void;
  clasesDisponibles: Array<{
    id: string;
    nombre: string;
    descripcion?: string | null;
    salvaciones_clase?: string[] | null;
    habilidades_disponibles?: string[] | null;
    habilidades_a_elegir?: number | null;
  }>;
  subclasesDisponibles: Array<{ id: string; nombre: string; descripcion?: string | null }>;
  trasfondosDisponibles: Array<{
    id: string;
    nombre: string;
    descripcion?: string | null;
    dote_origen?: { id: string; nombre: string; descripcion: string | null } | null;
    caracteristicas_trasfondo?: string[] | null;
  }>;
  dotesGenerales: { total: number; elegidas: number; pendientes: number };
}) {
  return (
    <div className="flex flex-col gap-6">
          {/* ── Identidad: Clase/Subclase y Trasfondo/Especie en 2 columnas,
              Alineamiento debajo ocupando todo el ancho. Los rasgos largos de
              cada elección van colapsados en "Ver rasgos" para no inflar el
              panel — minimalista, solo lo esencial a la vista. ── */}
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <CampoIdentidad label="Clase">
                {editable ? (
                  <select
                    value={ficha.clase ?? ""}
                    onChange={(e) => {
                      const nombreElegido = e.target.value;
                      const elegido = clasesDisponibles.find((c) => c.nombre === nombreElegido);
                      onEditarCampo?.("clase", nombreElegido);
                      onEditarCampo?.("rasgo_clase", elegido?.descripcion?.trim() || null);
                      onEditarCampo?.("subclase", null);
                      onEditarCampo?.("rasgo_subclase", null);

                      // Regla 2024: las salvaciones de clase son fijas, no
                      // una elección del jugador — se autocompletan solas.
                      if (elegido?.salvaciones_clase && elegido.salvaciones_clase.length > 0) {
                        onEditarCampo?.("salvaciones_competentes", elegido.salvaciones_clase);
                      }

                      // Si la nueva clase restringe las habilidades elegibles,
                      // descartamos las que ya no calzan con esa lista (ej.
                      // cambiar de Pícaro a Mago no debería dejar "Sigilo"
                      // marcado si Mago no lo ofrece).
                      if (elegido?.habilidades_disponibles) {
                        const permitidas = elegido.habilidades_disponibles;
                        const actuales = ficha.habilidades_competentes ?? [];
                        const filtradas = actuales.filter((h) => permitidas.includes(h));
                        if (filtradas.length !== actuales.length) {
                          onEditarCampo?.("habilidades_competentes", filtradas);
                        }
                      }
                    }}
                    className="text-sm font-semibold bg-transparent outline-none w-full"
                    style={{ color: "var(--primary)" }}
                  >
                    <option value="">—</option>
                    {clasesDisponibles.map((c) => (
                      <option key={c.id} value={c.nombre}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-sm font-semibold" style={{ color: "var(--primary)" }}>
                    {ficha.clase ?? "—"}
                  </span>
                )}
                {ficha.rasgo_clase && <RasgoDelCampo texto={ficha.rasgo_clase} />}
              </CampoIdentidad>

              <CampoIdentidad label="Subclase">
                {editable ? (
                  <select
                    value={ficha.subclase ?? ""}
                    onChange={(e) => {
                      const nombreElegido = e.target.value;
                      const elegido = subclasesDisponibles.find((s) => s.nombre === nombreElegido);
                      onEditarCampo?.("subclase", nombreElegido);
                      onEditarCampo?.("rasgo_subclase", elegido?.descripcion?.trim() || null);
                    }}
                    className="text-sm font-semibold bg-transparent outline-none w-full"
                    style={{ color: "var(--primary)" }}
                  >
                    <option value="">—</option>
                    {subclasesDisponibles.map((s) => (
                      <option key={s.id} value={s.nombre}>
                        {s.nombre}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-sm font-semibold" style={{ color: "var(--primary)" }}>
                    {ficha.subclase ?? "—"}
                  </span>
                )}
                {ficha.rasgo_subclase && <RasgoDelCampo texto={ficha.rasgo_subclase} />}
              </CampoIdentidad>

              <CampoIdentidad label="Trasfondo">
                {editable ? (
                  <select
                    value={ficha.trasfondo_mecanico ?? ""}
                    onChange={(e) => {
                      const nombreElegido = e.target.value;
                      const elegido = trasfondosDisponibles.find((t) => t.nombre === nombreElegido);
                      onEditarCampo?.("trasfondo_mecanico", nombreElegido);
                      onEditarCampo?.("rasgo_trasfondo", elegido?.descripcion?.trim() || null);

                      // La Dote de Origen del trasfondo se autoasigna como
                      // rasgo con origen="dote" (dentro de rasgos_especiales,
                      // que sí existe en fichas_dnd — no hay columna
                      // dote_origen separada) para que aparezca en la
                      // sección Dotes sin que el jugador tenga que agregarla
                      // a mano. Se identifica con un id fijo (no random) para
                      // poder reemplazarla sola si el trasfondo cambia, sin
                      // tocar otras dotes que el jugador haya sumado él mismo.
                      const rasgosActuales = ficha.rasgos_especiales ?? [];
                      const sinDoteOrigenVieja = rasgosActuales.filter((r) => r.id !== "dote-origen-trasfondo");
                      const nuevosRasgos = elegido?.dote_origen
                        ? [
                            ...sinDoteOrigenVieja,
                            {
                              id: "dote-origen-trasfondo",
                              nombre: elegido.dote_origen.nombre,
                              descripcion: elegido.dote_origen.descripcion?.trim() ?? "",
                              origen: "dote" as const,
                            },
                          ]
                        : sinDoteOrigenVieja;
                      onEditarCampo?.("rasgos_especiales", nuevosRasgos);
                    }}
                    className="text-sm font-semibold bg-transparent outline-none w-full"
                    style={{ color: "var(--primary)" }}
                  >
                    <option value="">—</option>
                    {trasfondosDisponibles.map((t) => (
                      <option key={t.id} value={t.nombre}>
                        {t.nombre}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-sm font-semibold" style={{ color: "var(--primary)" }}>
                    {ficha.trasfondo_mecanico ?? "—"}
                  </span>
                )}
                {ficha.rasgo_trasfondo && <RasgoDelCampo texto={ficha.rasgo_trasfondo} />}
              </CampoIdentidad>

              <CampoIdentidad label="Especie">
                {editable ? (
                  <SelectorEntidad
                    placeholder="Elegir especie…"
                    buscar={buscarCriaturas}
                    seleccionActual={ficha.especie ?? null}
                    onSeleccionar={(c) => onEditarCampo?.("especie_id", c.id)}
                    onQuitar={() => onEditarCampo?.("especie_id", null)}
                    variante="plano"
                  />
                ) : (
                  <span className="text-sm font-semibold" style={{ color: "var(--primary)" }}>
                    {ficha.especie?.nombre ?? ficha.raza ?? "—"}
                  </span>
                )}
                {ficha.especie?.descripcion_dnd && (
                  <RasgoDelCampo texto={ficha.especie.descripcion_dnd} />
                )}
              </CampoIdentidad>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <CampoIdentidad label="Alineamiento">
                <CampoEditable
                  valor={ficha.alineamiento ?? "—"}
                  editable={editable}
                  onCommit={(v) => onEditarCampo?.("alineamiento", v)}
                  className="text-sm font-semibold"
                  style={{ color: "var(--primary)" }}
                />
              </CampoIdentidad>

              <CampoIdentidad label="Tamaño">
                {editable ? (
                  <select
                    value={ficha.tamano ?? "Mediano"}
                    onChange={(e) => onEditarCampo?.("tamano", e.target.value)}
                    className="text-sm font-semibold bg-transparent outline-none w-full"
                    style={{ color: "var(--primary)" }}
                  >
                    {TAMANOS_DND.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-sm font-semibold" style={{ color: "var(--primary)" }}>
                    {ficha.tamano ?? "Mediano"}
                  </span>
                )}
              </CampoIdentidad>
            </div>
          </div>

          {/* ── Mejora de característica del trasfondo (PHB 2024): +2/+1 o
              +1/+1/+1 repartidos entre las 3 stats que habilita el
              trasfondo elegido. Solo aparece si ese trasfondo tiene el
              catálogo cargado (caracteristicas_trasfondo). ── */}
          <MejoraTrasfondoBloque
            caracteristicas={
              trasfondosDisponibles.find((t) => t.nombre === ficha.trasfondo_mecanico)
                ?.caracteristicas_trasfondo ?? null
            }
            valor={ficha.mejora_trasfondo ?? {}}
            editable={editable}
            onCambiar={(mejora) => onEditarCampo?.("mejora_trasfondo", mejora)}
          />

          {/* ── Dotes generales por nivel (PHB 2024: 4, 8, 12, 16, 19).
              Solo informativo por ahora — cuántas le corresponden vs.
              cuántas ya eligió (las dotes en sí se administran en el
              bloque de Rasgos, con origen="dote"). ── */}
          {dotesGenerales.total > 0 && (
            <div
              className="flex items-center justify-between px-3 py-2 rounded-lg"
              style={{ background: "color-mix(in srgb, var(--primary) 3%, transparent)" }}
            >
              <span
                className="text-micro font-black uppercase tracking-wider"
                style={{ color: "color-mix(in srgb, var(--primary) 40%, transparent)" }}
              >
                Dotes generales (nivel {NIVELES_DOTE_GENERAL.join(", ")})
              </span>
              <span
                className="text-xs font-bold tabular-nums"
                style={{
                  color:
                    dotesGenerales.pendientes > 0
                      ? "#f59e0b"
                      : "color-mix(in srgb, var(--primary) 55%, transparent)",
                }}
              >
                {dotesGenerales.elegidas}/{dotesGenerales.total}
                {dotesGenerales.pendientes > 0 ? ` · faltan ${dotesGenerales.pendientes}` : ""}
              </span>
            </div>
          )}

          <div className="-mx-6">
            <PanelRasgosEspeciales
              rasgos={ficha.rasgos_especiales ?? []}
              editable={editable}
              onCambiar={(siguientes) => onEditarCampo?.("rasgos_especiales", siguientes)}
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <span
                className="flex items-center gap-1.5 text-micro font-semibold mb-2"
                style={{ color: "color-mix(in srgb, var(--primary) 40%, transparent)" }}
              >
                <Languages size={11} />
                Idiomas
              </span>
              <EditorListaTags
                valores={ficha.idiomas ?? []}
                editable={editable}
                onCambiar={(siguientes) => onEditarCampo?.("idiomas", siguientes)}
                placeholder="Agregar idioma…"
              />
            </div>
            <div>
              <span
                className="flex items-center gap-1.5 text-micro font-semibold mb-2"
                style={{ color: "color-mix(in srgb, var(--primary) 40%, transparent)" }}
              >
                <Wrench size={11} />
                Herramientas
              </span>
              <EditorListaTags
                valores={ficha.herramientas ?? []}
                editable={editable}
                onCambiar={(siguientes) => onEditarCampo?.("herramientas", siguientes)}
                placeholder="Agregar herramienta…"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <span
                className="flex items-center gap-1.5 text-micro font-semibold mb-2"
                style={{ color: "color-mix(in srgb, var(--primary) 40%, transparent)" }}
              >
                <Shield size={11} />
                Armaduras
              </span>
              <EditorListaTags
                valores={ficha.competencias_armadura ?? []}
                editable={editable}
                onCambiar={(siguientes) => onEditarCampo?.("competencias_armadura", siguientes)}
                placeholder="Ej. ligera, escudos…"
              />
            </div>
            <div>
              <span
                className="flex items-center gap-1.5 text-micro font-semibold mb-2"
                style={{ color: "color-mix(in srgb, var(--primary) 40%, transparent)" }}
              >
                <Sword size={11} />
                Armas
              </span>
              <EditorListaTags
                valores={ficha.competencias_armas ?? []}
                editable={editable}
                onCambiar={(siguientes) => onEditarCampo?.("competencias_armas", siguientes)}
                placeholder="Ej. sencillas, espada larga…"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <span
                className="flex items-center gap-1.5 text-micro font-semibold mb-2"
                style={{ color: "color-mix(in srgb, var(--primary) 40%, transparent)" }}
              >
                Resistencias
              </span>
              <EditorListaTags
                valores={ficha.resistencias ?? []}
                editable={editable}
                onCambiar={(siguientes) => onEditarCampo?.("resistencias", siguientes)}
                placeholder="Ej. fuego…"
              />
            </div>
            <div>
              <span
                className="flex items-center gap-1.5 text-micro font-semibold mb-2"
                style={{ color: "color-mix(in srgb, var(--primary) 40%, transparent)" }}
              >
                Inmunidades
              </span>
              <EditorListaTags
                valores={ficha.inmunidades ?? []}
                editable={editable}
                onCambiar={(siguientes) => onEditarCampo?.("inmunidades", siguientes)}
                placeholder="Ej. veneno…"
              />
            </div>
            <div>
              <span
                className="flex items-center gap-1.5 text-micro font-semibold mb-2"
                style={{ color: "color-mix(in srgb, var(--primary) 40%, transparent)" }}
              >
                Vulnerabil.
              </span>
              <EditorListaTags
                valores={ficha.vulnerabilidades ?? []}
                editable={editable}
                onCambiar={(siguientes) => onEditarCampo?.("vulnerabilidades", siguientes)}
                placeholder="Ej. radiante…"
              />
            </div>
          </div>
    </div>
  );
}

function ContenidoInventarioFicha({
  ficha,
  editable,
  editableStats,
  onEditarCampo,
  tiposMoneda,
}: {
  ficha: FichaDnd;
  editable: boolean;
  editableStats: boolean;
  onEditarCampo?: (campo: keyof FichaDnd, valor: CampoFichaValor) => void;
  tiposMoneda: Array<{ id: string; nombre: string; simbolo?: string | null }>;
}) {
  return (
    <div className="flex flex-col gap-6">
                  <PanelInventarioFicha
                    fichaId={ficha.id}
                    editable={editable}
                    monedas={ficha.monedas}
                    tiposMoneda={tiposMoneda}
                    editableMonedas={editableStats}
                    onEditarMonedas={(m) => onEditarCampo?.("monedas", m)}
                    maestriasArmas={ficha.maestrias_armas}
                    onEditarMaestrias={(m) => onEditarCampo?.("maestrias_armas", m)}
                  />
                  <PanelConjuros
                    ficha={ficha}
                    editable={editable}
                    editableStats={editableStats}
                    onEditarCampo={onEditarCampo}
                  />
    </div>
  );
}

function ContenidoHistoriaFicha({
  ficha,
  editable,
  onEditarCampo,
}: {
  ficha: FichaDnd;
  editable: boolean;
  onEditarCampo?: (campo: keyof FichaDnd, valor: CampoFichaValor) => void;
}) {
  return (
            <div className="flex flex-col gap-4">
            <div>
              <span
                className="text-micro font-black uppercase tracking-wider"
                style={{ color: "color-mix(in srgb, var(--primary) 35%, transparent)" }}
              >
                Rasgos de personalidad
              </span>
              <CampoEditableTextarea
                valor={ficha.rasgos_personalidad}
                editable={editable}
                onCommit={(v) => onEditarCampo?.("rasgos_personalidad", v || null)}
                placeholder="¿Qué lo hace distinto a cualquier otro aventurero?"
              />
            </div>
            <div>
              <span
                className="text-micro font-black uppercase tracking-wider"
                style={{ color: "color-mix(in srgb, var(--primary) 35%, transparent)" }}
              >
                Ideales
              </span>
              <CampoEditableTextarea
                valor={ficha.ideales}
                editable={editable}
                onCommit={(v) => onEditarCampo?.("ideales", v || null)}
                placeholder="¿Qué principios lo guían?"
              />
            </div>
            <div>
              <span
                className="text-micro font-black uppercase tracking-wider"
                style={{ color: "color-mix(in srgb, var(--primary) 35%, transparent)" }}
              >
                Vínculos
              </span>
              <CampoEditableTextarea
                valor={ficha.vinculos}
                editable={editable}
                onCommit={(v) => onEditarCampo?.("vinculos", v || null)}
                placeholder="¿A quién o qué está atado?"
              />
            </div>
            <div>
              <span
                className="text-micro font-black uppercase tracking-wider"
                style={{ color: "color-mix(in srgb, var(--primary) 35%, transparent)" }}
              >
                Defectos
              </span>
              <CampoEditableTextarea
                valor={ficha.defectos}
                editable={editable}
                onCommit={(v) => onEditarCampo?.("defectos", v || null)}
                placeholder="¿Qué punto débil podrían explotar en su contra?"
              />
            </div>
            </div>
  );
}

// ─── Ataques / lista de acciones ────────────────────────────────────────────
// Deriva de las armas equipadas en el inventario: bono de ataque (mod de
// característica + competencia) y daño (dado del arma + mismo mod). Sutileza
// toma el mayor entre Fuerza/Destreza; distancia siempre usa Destreza.

function BloqueAtaques({
  fichaId,
  fuerza,
  destreza,
  bonoCompetencia,
  ataquesManuales,
  editable,
  onCambiarAtaquesManuales,
}: {
  fichaId: string;
  fuerza: number;
  destreza: number;
  bonoCompetencia: number;
  /** Ataques que NO vienen del inventario: conjuros de ataque,
   *  garras/mordiscos naturales, ataques especiales de clase. */
  ataquesManuales: AtaqueManual[];
  /** El dueño de la ficha puede agregar/quitar filas manuales. */
  editable: boolean;
  onCambiarAtaquesManuales?: (siguientes: AtaqueManual[]) => void;
}) {
  const { items, loading } = useInventarioFicha(fichaId);
  const armasEquipadas = items.filter((i) => i.equipado && i.item?.es_arma);
  const [nuevo, setNuevo] = useState({ nombre: "", bono_ataque: "", dano_tipo: "" });

  const agregar = () => {
    const nombre = nuevo.nombre.trim();
    if (!nombre) return;
    const fila: AtaqueManual = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      nombre,
      bono_ataque: nuevo.bono_ataque.trim(),
      dano_tipo: nuevo.dano_tipo.trim(),
    };
    onCambiarAtaquesManuales?.([...ataquesManuales, fila]);
    setNuevo({ nombre: "", bono_ataque: "", dano_tipo: "" });
  };

  if (loading || (armasEquipadas.length === 0 && ataquesManuales.length === 0 && !editable)) return null;

  return (
    <div
      className="px-3.5 py-3"
      style={{
        borderTop: "1px solid color-mix(in srgb, var(--primary) 8%, transparent)",
      }}
    >
      <SeparadorLabel label="Ataques" />
      <div className="flex flex-col gap-1.5">
        {armasEquipadas.map((fila) => {
          const modStat = fila.item?.distancia
            ? statMod(destreza)
            : fila.item?.sutileza
              ? Math.max(statMod(fuerza), statMod(destreza))
              : statMod(fuerza);
          const bonoAtaque = modStat + bonoCompetencia;
          return (
            <div
              key={fila.id}
              className="flex items-center justify-between gap-2 px-2.5 py-1.5"
              style={{
                border: "1px solid color-mix(in srgb, var(--primary) 10%, transparent)",
                borderRadius: "2px",
                background: "color-mix(in srgb, var(--primary) 3%, transparent)",
              }}
            >
              <span className="flex items-center gap-1.5 min-w-0 text-xs font-semibold text-primary/75 truncate">
                {fila.item?.distancia ? (
                  <Target size={10} className="shrink-0 text-primary/35" />
                ) : (
                  <Sword size={10} className="shrink-0 text-primary/35" />
                )}
                {fila.item?.nombre ?? "Arma"}
                {fila.item?.maestria && (
                  <span
                    title={DESCRIPCION_MAESTRIA_ARMA[fila.item.maestria]}
                    className="shrink-0 text-micro font-black uppercase tracking-wide px-1 py-0.5 rounded"
                    style={{
                      background: "color-mix(in srgb, var(--primary) 10%, transparent)",
                      color: "color-mix(in srgb, var(--primary) 60%, transparent)",
                    }}
                  >
                    {fila.item.maestria}
                  </span>
                )}
              </span>
              <span
                className="shrink-0 text-micro font-bold tabular-nums"
                style={{ color: "var(--primary)" }}
              >
                {bonoAtaque >= 0 ? `+${bonoAtaque}` : bonoAtaque}
                {fila.item?.dado_dano
                  ? ` · ${fila.item.dado_dano}${modStat >= 0 ? `+${modStat}` : modStat}`
                  : ""}
              </span>
            </div>
          );
        })}

        {/* ── Ataques agregados a mano: conjuros de ataque, garras/mordiscos
            naturales, ataques especiales de clase — no derivan del
            inventario, así que el bono/daño se escriben libremente. ── */}
        {ataquesManuales.map((fila) => (
          <div
            key={fila.id}
            className="flex items-center justify-between gap-2 px-2.5 py-1.5"
            style={{
              border: "1px solid color-mix(in srgb, var(--primary) 10%, transparent)",
              borderRadius: "2px",
              background: "color-mix(in srgb, var(--primary) 3%, transparent)",
            }}
          >
            <span className="flex items-center gap-1.5 min-w-0 text-xs font-semibold text-primary/75 truncate">
              <Wand2 size={10} className="shrink-0 text-primary/35" />
              {fila.nombre}
            </span>
            <span className="flex items-center gap-1.5 shrink-0">
              <span className="text-micro font-bold tabular-nums" style={{ color: "var(--primary)" }}>
                {fila.bono_ataque}
                {fila.dano_tipo ? ` · ${fila.dano_tipo}` : ""}
              </span>
              {editable && (
                <span
                  role="button"
                  onClick={() =>
                    onCambiarAtaquesManuales?.(ataquesManuales.filter((a) => a.id !== fila.id))
                  }
                  className="cursor-pointer text-primary/30 hover:text-red-500 transition-colors"
                >
                  <X size={10} />
                </span>
              )}
            </span>
          </div>
        ))}

        {editable && (
          <div className="flex items-center gap-1 mt-0.5">
            <input
              type="text"
              value={nuevo.nombre}
              onChange={(e) => setNuevo((s) => ({ ...s, nombre: e.target.value }))}
              placeholder="Nombre (ej. Rayo de escarcha)"
              className="min-w-0 flex-1 bg-transparent outline-none text-micro text-primary/60 placeholder:text-primary/25 px-1.5 py-1"
              style={{
                border: "1px dashed color-mix(in srgb, var(--primary) 15%, transparent)",
                borderRadius: "2px",
              }}
            />
            <input
              type="text"
              value={nuevo.bono_ataque}
              onChange={(e) => setNuevo((s) => ({ ...s, bono_ataque: e.target.value }))}
              placeholder="+5"
              className="w-12 bg-transparent outline-none text-micro text-primary/60 placeholder:text-primary/25 px-1.5 py-1"
              style={{
                border: "1px dashed color-mix(in srgb, var(--primary) 15%, transparent)",
                borderRadius: "2px",
              }}
            />
            <input
              type="text"
              value={nuevo.dano_tipo}
              onChange={(e) => setNuevo((s) => ({ ...s, dano_tipo: e.target.value }))}
              placeholder="1d10 frío"
              className="w-20 bg-transparent outline-none text-micro text-primary/60 placeholder:text-primary/25 px-1.5 py-1"
              style={{
                border: "1px dashed color-mix(in srgb, var(--primary) 15%, transparent)",
                borderRadius: "2px",
              }}
            />
            <button
              type="button"
              onClick={agregar}
              className="shrink-0 flex items-center justify-center rounded hover:bg-primary/10 transition-colors"
              style={{ width: 22, height: 22 }}
            >
              <Plus size={12} className="text-primary/50" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function FichaStatsPanel({
  ficha,
  headerAction,
  editable = false,
  editableStats = false,
  editableCondiciones = false,
  mostrarCondiciones = true,
  mostrarSecundarias = false,
  onEditarCampo,
  onFichaActualizada,
}: {
  ficha: FichaDnd;
  headerAction?: React.ReactNode;
  /** El dueño de la ficha: puede editar nombre y clase. */
  editable?: boolean;
  /** Solo admin/DM: además puede editar nivel, stats, HP, CA y velocidad. */
  editableStats?: boolean;
  /** Solo admin/DM, siempre: controla condiciones activas y HP actual en vivo. */
  editableCondiciones?: boolean;
  /** Si el bloque de condiciones/estado aparece en esta vista. En /aventura
      se oculta por completo — el DM lo maneja desde su panel aparte. */
  mostrarCondiciones?: boolean;
  /** Datos que NO están en la franja de combate de la hoja oficial 2024
      (Daño por arma, Bono de competencia, Investigación/Perspicacia
      pasivas, Agotamiento): el jugador no los ve en /aventura para no
      saturar la ficha; el DM sí los ve y edita desde su panel en
      /myself/garlia (PanelIdentidadesDM), donde se pasa en true. */
  mostrarSecundarias?: boolean;
  onEditarCampo?: (
    campo: keyof FichaDnd,
    valor: CampoFichaValor,
  ) => void;
  /** Se dispara tras reclamar una recompensa de misión, para refrescar la
      ficha en el padre — solo se usa dentro de la tab "Misiones". */
  onFichaActualizada?: () => void;
}) {
  const hpMax = ficha.hp_max ?? 0;
  const hpActual = ficha.hp_actual ?? 0;
  const hpTemporal = ficha.hp_temporal ?? 0;
  // Regla 2024: el agotamiento resta 2 por nivel a TODA tirada d20, así que
  // se aplica acá una sola vez y se reutiliza en iniciativa/salvaciones/
  // habilidades. No toca los valores pasivos (no son una tirada).
  const penAgotamiento = penalizacionAgotamiento(ficha.agotamiento);
  const iniciativa = statMod(statEfectivo(ficha, "destreza")) + penAgotamiento;
  const danioCuerpoACuerpo = statMod(statEfectivo(ficha, "fuerza"));
  const bonoCompetencia = bonusCompetencia(ficha.nivel ?? 1);
  const percepcion = percepcionPasiva(ficha);
  const xp = progresoXp(ficha.xp_total ?? 0);
  const { tipos: tiposMoneda } = useTiposMoneda();
  const { clases: clasesDisponibles } = useClasesDisponibles();
  const claseFichaId = clasesDisponibles.find((c) => c.nombre === ficha.clase)?.id ?? null;
  const { subclases: subclasesDisponibles } = useSubclasesDisponibles(claseFichaId);
  const { trasfondos: trasfondosDisponibles } = useTrasfondosDisponibles();
  const { items: itemsInventario } = useInventarioFicha(ficha.id);
  const caCalculada = caCalculadaDesdeInventario(itemsInventario, statMod(statEfectivo(ficha, "destreza")));
  const dotesGenerales = dotesGeneralesDisponibles(ficha);
  const [tab, setTab] = useState<"stats" | "identidad" | "inventario" | "historia">("stats");
  const panelRef = useRef<HTMLDivElement>(null);
  const stats: Array<[string, number]> = STATS_DND.map((key) => [key, statEfectivo(ficha, key)]);

  // Reglas de la clase elegida (si tiene el catálogo cargado con reglas
  // PHB 2024). Si la clase es homebrew sin reglas configuradas, todo se
  // comporta como antes: libre, sin restricciones.
  const claseElegida = clasesDisponibles.find((c) => c.nombre === ficha.clase);
  const claseSalvaciones = claseElegida?.salvaciones_clase ?? null;
  const claseHabilidades = claseElegida?.habilidades_disponibles ?? null;
  const cupoHabilidades = claseElegida?.habilidades_a_elegir ?? null;
  const habilidadesElegidasCount = (ficha.habilidades_competentes ?? []).filter(
    (h) => !claseHabilidades || claseHabilidades.includes(h),
  ).length;

  return (
    <div
      ref={panelRef}
      // ── Panel fijo con scroll propio: se queda pegado al hacer scroll de
      // la página (sticky, con offset del navbar) y su contenido interno
      // scrollea aparte cuando no entra en el alto disponible — nunca
      // "empuja" ni se va con el resto de la página. ──
      className="md:sticky md:top-4 md:max-h-[calc(100svh-56px)] overflow-y-auto flex flex-col"
      style={{
        background: "var(--white-custom)",
        borderRadius: "var(--radius-card)",
        border: "1px solid color-mix(in srgb, var(--primary) 12%, transparent)",
      }}
    >
      {/* ── Encabezado: nombre + clase/nivel. Antes tenía un botón "Ver
          ficha completa" que abría un panel flotante anexo; ahora el
          panel completo vive acá mismo, organizado en tabs (ver más
          abajo), así que el header queda solo con nombre/clase/nivel
          e inspiración. ── */}
      <div className="px-3.5 pt-3.5 pb-3 flex items-start gap-2">
        <div className="min-w-0 flex-1">
            <p
              className="font-serif italic text-base leading-tight truncate capitalize"
              style={{ color: "var(--primary)" }}
            >
              <CampoEditable
                valor={ficha.nombre}
                editable={editable}
                onCommit={(v) => onEditarCampo?.("nombre", v)}
                className="font-serif italic text-base leading-tight capitalize"
                style={{ color: "var(--primary)" }}
              />
            </p>
            <p
              className="text-micro font-black uppercase tracking-wider truncate"
              style={{ color: "color-mix(in srgb, var(--primary) 40%, transparent)" }}
            >
              {editable ? (
                <span className="inline-flex items-center gap-1">
                  <select
                    value={ficha.clase ?? ""}
                    onChange={(e) => onEditarCampo?.("clase", e.target.value)}
                    className="text-micro font-black uppercase tracking-wider bg-transparent outline-none"
                    style={{
                      color: "color-mix(in srgb, var(--primary) 40%, transparent)",
                      borderBottom: "1px dashed color-mix(in srgb, var(--primary) 25%, transparent)",
                      maxWidth: 90,
                    }}
                  >
                    <option value="">Clase…</option>
                    {clasesDisponibles.map((c) => (
                      <option key={c.id} value={c.nombre}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                  · Nivel{" "}
                  <CampoEditable
                    valor={ficha.nivel ?? 1}
                    editable={editableStats}
                    tipo="number"
                    onCommit={(v) => onEditarCampo?.("nivel", Number(v) || 1)}
                    className="text-micro font-black uppercase tracking-wider"
                    style={{ color: "color-mix(in srgb, var(--primary) 40%, transparent)" }}
                    width={28}
                  />
                </span>
              ) : (
                <>
                  {ficha.clase ?? "Aventurero"} · Nivel {ficha.nivel ?? 1}
                </>
              )}
            </p>
          </div>
        <div className="shrink-0 flex items-center gap-1.5">
          {(editable || ficha.inspiracion) && (
            <button
              type="button"
              disabled={!editable}
              title={
                ficha.inspiracion
                  ? "Tiene inspiración: puede gastarla para tener ventaja en una tirada."
                  : "Sin inspiración."
              }
              onClick={() => editable && onEditarCampo?.("inspiracion", !ficha.inspiracion)}
              className="shrink-0 flex items-center justify-center transition-all disabled:cursor-default"
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                border: ficha.inspiracion
                  ? "1px solid color-mix(in srgb, var(--primary) 40%, transparent)"
                  : "1px solid color-mix(in srgb, var(--primary) 10%, transparent)",
                background: ficha.inspiracion
                  ? "color-mix(in srgb, var(--primary) 14%, transparent)"
                  : "transparent",
              }}
            >
              <Sparkles
                size={11}
                fill={ficha.inspiracion ? "var(--primary)" : "none"}
                style={{
                  color: ficha.inspiracion
                    ? "var(--primary)"
                    : "color-mix(in srgb, var(--primary) 30%, transparent)",
                }}
              />
            </button>
          )}
          {headerAction && <div className="shrink-0">{headerAction}</div>}
        </div>
      </div>

      {/* ── Tabs: Stats / Identidad / Inventario / Historia. En desktop,
          fila de texto plano (tab activa marcada con color + línea
          inferior, mismo criterio visual que tenía el panel flotante
          viejo). En mobile, un <select> nativo en su lugar — 4 tabs no
          entran cómodas en el ancho angosto que tiene este panel arriba
          del feed. ── */}
      <div className="sm:hidden px-3.5 pb-2">
        <select
          value={tab}
          onChange={(e) => setTab(e.target.value as typeof tab)}
          className="w-full h-8 px-2 rounded-lg text-xs font-bold uppercase tracking-wide outline-none"
          style={{
            border: "1px solid color-mix(in srgb, var(--primary) 15%, transparent)",
            color: "var(--primary)",
            background: "color-mix(in srgb, var(--primary) 3%, transparent)",
          }}
        >
          <option value="stats">Stats</option>
          <option value="identidad">Identidad</option>
          <option value="inventario">Inventario</option>
          <option value="historia">Historia</option>
        </select>
      </div>
      <div
        className="hidden sm:flex items-center px-3.5"
        style={{ borderBottom: "1px solid color-mix(in srgb, var(--primary) 8%, transparent)" }}
      >
        {(
          [
            ["stats", "Stats"],
            ["identidad", "Identidad"],
            ["inventario", "Inventario"],
            ["historia", "Historia"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className="flex-1 pb-2 pt-1 text-micro font-bold uppercase tracking-wide text-center transition-colors"
            style={{
              color:
                tab === id
                  ? "var(--primary)"
                  : "color-mix(in srgb, var(--primary) 35%, transparent)",
              borderBottom: tab === id ? "2px solid var(--primary)" : "2px solid transparent",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "stats" && (
        <>
      {/* ── Avatar de estado: condiciones activas, siempre visibles como chips.
          Solo admin/DM puede tildar/destildar (editableCondiciones), nunca el
          dueño de la ficha — el estado de juego en vivo lo controla el DM. ── */}
      {mostrarCondiciones && (ficha.condiciones?.length > 0 || editableCondiciones) && (
        <div
          className="px-3.5 pb-3 flex flex-wrap gap-1.5"
          style={{ borderTop: "1px solid color-mix(in srgb, var(--primary) 8%, transparent)", paddingTop: 10 }}
        >
          {CONDICIONES_DND.filter(
            (c) => editableCondiciones || ficha.condiciones?.includes(c.id),
          ).map((c) => {
            const condicionActiva = ficha.condiciones?.includes(c.id) ?? false;
            const Icon = c.Icon;
            return (
              <button
                key={c.id}
                type="button"
                disabled={!editableCondiciones}
                title={c.nombre}
                onClick={() => {
                  if (!editableCondiciones) return;
                  const actuales = ficha.condiciones ?? [];
                  const siguientes = condicionActiva
                    ? actuales.filter((id) => id !== c.id)
                    : [...actuales, c.id];
                  onEditarCampo?.("condiciones", siguientes);
                }}
                className="flex items-center justify-center transition-all disabled:cursor-default"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  border: condicionActiva
                    ? "1px solid color-mix(in srgb, var(--primary) 35%, transparent)"
                    : "1px solid color-mix(in srgb, var(--primary) 10%, transparent)",
                  background: condicionActiva
                    ? "color-mix(in srgb, var(--primary) 12%, transparent)"
                    : "color-mix(in srgb, var(--primary) 3%, transparent)",
                  opacity: condicionActiva || editableCondiciones ? 1 : 0.3,
                }}
              >
                <Icon
                  size={13}
                  style={{
                    color: condicionActiva
                      ? "var(--primary)"
                      : "color-mix(in srgb, var(--primary) 50%, transparent)",
                  }}
                />
              </button>
            );
          })}
        </div>
      )}
      <div
        className="px-3.5 pt-3 pb-3"
        style={{
          borderTop: "1px solid color-mix(in srgb, var(--primary) 8%, transparent)",
        }}
      >
        <div className="grid grid-cols-2 gap-x-3 mb-2.5">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span
                className="text-micro font-black uppercase tracking-wider"
                style={{ color: "color-mix(in srgb, var(--primary) 40%, transparent)" }}
              >
                Vida
              </span>
              <span
                className="text-xs font-black tabular-nums flex items-center gap-1"
                style={{ color: "var(--primary)" }}
              >
                {(editableStats || editableCondiciones) ? (
                  <span className="inline-flex items-center gap-0.5">
                    <CampoEditable
                      valor={hpActual}
                      editable={editableCondiciones}
                      tipo="number"
                      align="right"
                      width={26}
                      onCommit={(v) => onEditarCampo?.("hp_actual", Number(v) || 0)}
                      className="text-xs font-black tabular-nums"
                      style={{ color: "var(--primary)" }}
                    />
                    /
                    <CampoEditable
                      valor={hpMax}
                      editable={editableStats}
                      tipo="number"
                      width={26}
                      onCommit={(v) => onEditarCampo?.("hp_max", Number(v) || 0)}
                      className="text-xs font-black tabular-nums"
                      style={{ color: "var(--primary)" }}
                    />
                  </span>
                ) : (
                  <>
                    {hpActual}/{hpMax || "—"}
                  </>
                )}
                {/* ── PG temporales: absorben daño antes que los reales.
                    Se muestran como un chip "+N" aparte de la barra normal
                    porque NO se suman al máximo (regla 2024: no se acumulan,
                    el mayor de los dos reemplaza al otro). ── */}
                {(editableCondiciones || hpTemporal > 0) && (
                  <span
                    className="flex items-center gap-0.5 px-1 py-0.5 rounded-full text-micro font-black tabular-nums"
                    style={{
                      background: "color-mix(in srgb, var(--primary) 12%, transparent)",
                      color: "var(--primary)",
                    }}
                    title="Puntos de golpe temporales: absorben daño antes que los reales."
                  >
                    +
                    <CampoEditable
                      valor={hpTemporal}
                      editable={editableCondiciones}
                      tipo="number"
                      align="right"
                      width={16}
                      onCommit={(v) => onEditarCampo?.("hp_temporal", Number(v) || 0)}
                      className="text-micro font-black tabular-nums"
                      style={{ color: "var(--primary)" }}
                    />
                  </span>
                )}
              </span>
            </div>
            <div className="flex gap-0.5">
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 h-1 transition-all duration-700"
                  style={{
                    background:
                      hpMax > 0 && i < Math.round((hpActual / hpMax) * 10)
                        ? "color-mix(in srgb, var(--primary) 55%, transparent)"
                        : "color-mix(in srgb, var(--primary) 8%, transparent)",
                    borderRadius: "1px",
                  }}
                />
              ))}
            </div>
          </div>

          {/* ── Progreso de XP: barra hasta el próximo umbral. El nivel ya
              se muestra y edita arriba en el header, así que acá no se
              repite — solo el total actual y lo que falta para el próximo
              umbral, en una sola línea con la barra. Al lado de Vida en
              vez de abajo, para no apilar dos bloques con la misma forma
              y ahorrar alto. ── */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span
                className="text-micro font-black uppercase tracking-wider"
                style={{ color: "color-mix(in srgb, var(--primary) 40%, transparent)" }}
              >
                XP
              </span>
              <span
                className="text-micro font-bold tabular-nums"
                style={{ color: "color-mix(in srgb, var(--primary) 45%, transparent)" }}
              >
                {ficha.xp_total ?? 0}
                {xp.xpProximoNivel != null ? `/${xp.xpProximoNivel}` : " (máx.)"}
              </span>
            </div>
            <div className="flex gap-0.5">
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 h-1 transition-all duration-700"
                  style={{
                    background:
                      i < Math.round((xp.porcentaje / 100) * 10)
                        ? "color-mix(in srgb, var(--primary) 40%, transparent)"
                        : "color-mix(in srgb, var(--primary) 8%, transparent)",
                    borderRadius: "1px",
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ── Salvaciones contra muerte: solo aparecen a 0 HP. 3 éxitos
            estabilizan, 3 fracasos matan. Las marca el DM en vivo, igual
            que HP actual (editableCondiciones), nunca el dueño. ── */}
        {hpActual <= 0 && (
          <div className="mb-3.5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <span
                className="text-micro font-black uppercase tracking-wider"
                style={{ color: "color-mix(in srgb, var(--primary) 40%, transparent)" }}
              >
                Éxitos
              </span>
              {[0, 1, 2].map((i) => {
                const marcado = i < (ficha.muerte_exitos ?? 0);
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={!editableCondiciones}
                    onClick={() => onEditarCampo?.("muerte_exitos", marcado ? i : i + 1)}
                    className="rounded-full transition-colors disabled:cursor-default"
                    style={{
                      width: 12,
                      height: 12,
                      border: "1.5px solid var(--primary)",
                      background: marcado ? "var(--primary)" : "transparent",
                    }}
                  />
                );
              })}
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="text-micro font-black uppercase tracking-wider"
                style={{ color: "color-mix(in srgb, var(--primary) 40%, transparent)" }}
              >
                Fracasos
              </span>
              {[0, 1, 2].map((i) => {
                const marcado = i < (ficha.muerte_fracasos ?? 0);
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={!editableCondiciones}
                    onClick={() => onEditarCampo?.("muerte_fracasos", marcado ? i : i + 1)}
                    className="rounded-full transition-colors disabled:cursor-default"
                    style={{
                      width: 12,
                      height: 12,
                      border: "1.5px solid var(--primary)",
                      background: marcado ? "var(--primary)" : "transparent",
                    }}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* ── Una sola fila compacta con los 6 datos que el PHB 2024 trata
            como "consulta constante" en combate (iniciativa, CA, velocidad,
            percepción pasiva agrupadas arriba de la ficha; daño y bono de
            competencia son el núcleo de cada ataque). Celdas angostas, un
            solo grid — nada de dos filas de cajas grandes. ── */}
        <div className="grid grid-cols-4 gap-1">
          <StatMini
            label="Iniciat."
            valor={iniciativa >= 0 ? `+${iniciativa}` : iniciativa}
            title={
              penAgotamiento < 0
                ? `Iniciativa = modificador de Destreza ${penAgotamiento} por agotamiento.`
                : "Iniciativa = modificador de Destreza."
            }
          />
          <StatMini
            label="Defensa"
            title={
              caCalculada !== (ficha.ca ?? 10)
                ? `CA calculada por armadura equipada: ${caCalculada}`
                : undefined
            }
            valor={
              <CampoEditable
                valor={ficha.ca ?? 10}
                editable={editableStats}
                tipo="number"
                align="center"
                width={22}
                onCommit={(v) => onEditarCampo?.("ca", Number(v) || 0)}
                className="text-xs font-black tabular-nums"
                style={{ color: "var(--primary)" }}
              />
            }
            sub={caCalculada !== (ficha.ca ?? 10) ? `calc. ${caCalculada}` : undefined}
          />
          <StatMini
            label="Veloc."
            valor={
              <CampoEditable
                valor={ficha.velocidad ?? 30}
                editable={editableStats}
                tipo="number"
                align="center"
                width={30}
                onCommit={(v) => onEditarCampo?.("velocidad", Number(v) || 0)}
                className="text-xs font-black tabular-nums"
                style={{ color: "var(--primary)" }}
              />
            }
          />
          <StatMini
            label="Percep."
            valor={percepcion}
            title="10 + modificador de Sabiduría + competencia (si la tiene en Percepción)."
          />
        </div>

        {/* ── Datos que no están en la franja de combate de la hoja oficial
            2024 (Daño por arma, Competencia, pasivas de Investigación/
            Perspicacia, Agotamiento): ocultos para el jugador en /aventura,
            visibles solo para el DM (PanelIdentidadesDM en /myself/garlia,
            que pasa mostrarSecundarias). ── */}
        {mostrarSecundarias && (
          <div
            className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 px-0.5 text-micro"
            style={{ color: "color-mix(in srgb, var(--primary) 45%, transparent)" }}
          >
            <span className="inline-flex items-center gap-1">
              <span className="font-bold uppercase tracking-wide">Daño</span>
              <span className="font-black tabular-nums" style={{ color: "var(--primary)" }}>
                {danioCuerpoACuerpo >= 0 ? `+${danioCuerpoACuerpo}` : danioCuerpoACuerpo}
              </span>
            </span>

            <span
              className="inline-flex items-center gap-1"
              title="Se calcula solo según el nivel: base de habilidades, salvaciones y ataques."
            >
              <span className="font-bold uppercase tracking-wide">Compet.</span>
              <span className="font-black tabular-nums" style={{ color: "var(--primary)" }}>
                +{bonoCompetencia}
              </span>
            </span>

            <span
              className="inline-flex items-center gap-1"
              title="10 + modificador de Inteligencia + competencia (si la tiene en Investigación)."
            >
              <span className="font-bold uppercase tracking-wide">Investig.</span>
              <span className="font-black tabular-nums" style={{ color: "var(--primary)" }}>
                {investigacionPasiva(ficha)}
              </span>
            </span>

            <span
              className="inline-flex items-center gap-1"
              title="10 + modificador de Sabiduría + competencia (si la tiene en Perspicacia)."
            >
              <span className="font-bold uppercase tracking-wide">Perspic.</span>
              <span className="font-black tabular-nums" style={{ color: "var(--primary)" }}>
                {perspicaciaPasiva(ficha)}
              </span>
            </span>

            <span
              className="inline-flex items-center gap-1"
              title="Nivel de agotamiento 0-6 (regla 2024: -2 acumulativo por nivel a todas las tiradas)."
              style={
                (ficha.agotamiento ?? 0) > 0 ? { color: "#dc2626" } : undefined
              }
            >
              <span className="font-bold uppercase tracking-wide">Agotam.</span>
              {editableCondiciones ? (
                <span className="inline-flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() =>
                      onEditarCampo?.("agotamiento", Math.max(0, (ficha.agotamiento ?? 0) - 1))
                    }
                    className="flex items-center justify-center rounded hover:bg-primary/10 transition-colors"
                    style={{ width: 13, height: 13 }}
                  >
                    <Minus size={8} className="text-primary/50" />
                  </button>
                  <span
                    className="font-black tabular-nums"
                    style={{ color: (ficha.agotamiento ?? 0) > 0 ? "#dc2626" : "var(--primary)" }}
                  >
                    {ficha.agotamiento ?? 0}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onEditarCampo?.("agotamiento", Math.min(6, (ficha.agotamiento ?? 0) + 1))
                    }
                    className="flex items-center justify-center rounded hover:bg-primary/10 transition-colors"
                    style={{ width: 13, height: 13 }}
                  >
                    <Plus size={8} className="text-primary/50" />
                  </button>
                </span>
              ) : (
                <span
                  className="font-black tabular-nums"
                  style={{ color: (ficha.agotamiento ?? 0) > 0 ? "#dc2626" : "var(--primary)" }}
                >
                  {ficha.agotamiento ?? 0}
                </span>
              )}
            </span>
          </div>
        )}
      </div>

      {/* ── Estadísticas D&D: lista con separadores finos en vez de cajas
          anidadas — cada stat es una fila, salvación y skills debajo con
          la misma indentación, sin tarjetas dentro de tarjetas. En 2
          columnas para aprovechar el ancho del panel. ── */}
      <div
        className="px-3.5 py-3 flex-1 flex flex-col"
        style={{
          borderTop: "1px solid color-mix(in srgb, var(--primary) 8%, transparent)",
        }}
      >
        {cupoHabilidades != null && (
          <p
            className="mb-1.5 text-micro font-black uppercase tracking-wider"
            style={{
              color:
                habilidadesElegidasCount >= cupoHabilidades
                  ? "var(--primary)"
                  : "color-mix(in srgb, var(--primary) 45%, transparent)",
            }}
          >
            Habilidades de clase: {habilidadesElegidasCount}/{cupoHabilidades} elegidas
          </p>
        )}
        <div
          className="flex-1 grid gap-x-2.5 items-stretch"
          style={{ gridTemplateColumns: "1fr 1.3fr 1fr" }}
        >
          {stats.map(([key, valorEfectivo], i) => {
            const valorBase = (ficha[key as keyof FichaDnd] as number) ?? 10;
            const bono = ficha.mejora_trasfondo?.[key as (typeof STATS_DND)[number]] ?? 0;
            const mod = statMod(valorEfectivo);
            const skills = SKILLS_POR_STAT[key] ?? [];
            const salvacionCompetente = ficha.salvaciones_competentes?.includes(key) ?? false;
            const salvacionBonus =
              mod + (salvacionCompetente ? bonusCompetencia(ficha.nivel ?? 1) : 0) + penAgotamiento;
            return (
              <div
                key={key}
                className="min-w-0 flex flex-col justify-start"
                style={{
                  borderTop:
                    i < 3 ? undefined : "1px solid color-mix(in srgb, var(--primary) 6%, transparent)",
                }}
              >
                {/* Fila de la stat: abreviatura, valor editable y modificador.
                    El input edita el score BASE (lo que el jugador repartió);
                    si el trasfondo aporta un bono, se muestra aparte en verde
                    para no confundir "lo que tengo" con "lo que se guarda". */}
                <div className="flex items-center gap-1.5 py-1.5">
                  <span
                    className="w-6 shrink-0 text-micro font-black uppercase tracking-wider"
                    style={{ color: "color-mix(in srgb, var(--primary) 40%, transparent)" }}
                  >
                    {ABREVIATURA_STAT[key]}
                  </span>
                  <span className="text-sm font-black tabular-nums" style={{ color: "var(--primary)" }}>
                    <CampoEditable
                      valor={valorBase}
                      editable={editableStats}
                      tipo="number"
                      align="center"
                      width={26}
                      onCommit={(v) =>
                        onEditarCampo?.(key as keyof FichaDnd, Number(v) || 10)
                      }
                      className="text-sm font-black tabular-nums"
                      style={{ color: "var(--primary)" }}
                    />
                  </span>
                  {bono > 0 && (
                    <span
                      className="text-micro font-black tabular-nums"
                      title="Bono de mejora de trasfondo (PHB 2024)"
                      style={{ color: "#10b981" }}
                    >
                      +{bono}
                    </span>
                  )}
                  <span
                    className="text-micro font-black tabular-nums"
                    style={{ color: "color-mix(in srgb, var(--primary) 45%, transparent)" }}
                  >
                    ({mod >= 0 ? `+${mod}` : mod})
                  </span>
                </div>

                {/* Salvación de esta stat, misma indentación que las skills. */}
                <button
                  type="button"
                  disabled={!editableStats || !!claseSalvaciones}
                  title={claseSalvaciones ? "Fija por clase — no se puede cambiar a mano" : undefined}
                  onClick={() => {
                    if (!editableStats || claseSalvaciones) return;
                    const actuales = ficha.salvaciones_competentes ?? [];
                    const siguientes = salvacionCompetente
                      ? actuales.filter((k) => k !== key)
                      : [...actuales, key];
                    onEditarCampo?.("salvaciones_competentes", siguientes);
                  }}
                  className="w-full flex items-center justify-between pl-1.5 pr-1 py-0.5 transition-all disabled:cursor-default"
                >
                  <span
                    className="flex items-center gap-1.5 text-micro"
                    style={{
                      color: salvacionCompetente
                        ? "var(--primary)"
                        : "color-mix(in srgb, var(--primary) 45%, transparent)",
                      fontWeight: salvacionCompetente ? 700 : 500,
                    }}
                  >
                    <span
                      className="shrink-0"
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: "50%",
                        background: salvacionCompetente
                          ? "var(--primary)"
                          : "color-mix(in srgb, var(--primary) 15%, transparent)",
                      }}
                    />
                    Salvación
                  </span>
                  <span
                    className="text-micro font-black tabular-nums"
                    style={{
                      color: salvacionCompetente
                        ? "var(--primary)"
                        : "color-mix(in srgb, var(--primary) 45%, transparent)",
                    }}
                  >
                    {salvacionBonus >= 0 ? `+${salvacionBonus}` : salvacionBonus}
                  </span>
                </button>

                {/* Habilidades asociadas a esta stat, misma indentación. */}
                {skills.map((skill) => {
                  const competente =
                    ficha.habilidades_competentes?.includes(skill.id) ?? false;
                  const bonus =
                    mod + (competente ? bonusCompetencia(ficha.nivel ?? 1) : 0) + penAgotamiento;
                  // Si la clase tiene reglas cargadas: solo se puede tildar
                  // una habilidad si está en su lista permitida, y solo hasta
                  // llenar el cupo (habilidades_a_elegir). Sin reglas
                  // (homebrew sin configurar) queda libre, como antes.
                  const permitidaPorClase = !claseHabilidades || claseHabilidades.includes(skill.id);
                  const cupoLleno =
                    cupoHabilidades != null && habilidadesElegidasCount >= cupoHabilidades;
                  const bloqueada = !competente && (!permitidaPorClase || cupoLleno);
                  return (
                    <button
                      key={skill.id}
                      type="button"
                      disabled={!editableStats || bloqueada}
                      title={
                        !permitidaPorClase
                          ? "Esta clase no ofrece esta habilidad"
                          : cupoLleno && !competente
                            ? "Ya elegiste el cupo de habilidades de tu clase"
                            : undefined
                      }
                      onClick={() => {
                        if (!editableStats || bloqueada) return;
                        const actuales = ficha.habilidades_competentes ?? [];
                        const siguientes = competente
                          ? actuales.filter((s) => s !== skill.id)
                          : [...actuales, skill.id];
                        onEditarCampo?.("habilidades_competentes", siguientes);
                      }}
                      className="w-full flex items-center justify-between pl-1.5 pr-1 py-0.5 transition-all disabled:cursor-default disabled:opacity-40"
                    >
                      <span
                        className="flex items-center gap-1.5 text-micro whitespace-nowrap"
                        style={{
                          color: competente
                            ? "var(--primary)"
                            : "color-mix(in srgb, var(--primary) 45%, transparent)",
                          fontWeight: competente ? 700 : 500,
                        }}
                      >
                        <span
                          className="shrink-0"
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: "50%",
                            background: competente
                              ? "var(--primary)"
                              : "color-mix(in srgb, var(--primary) 15%, transparent)",
                          }}
                        />
                        {skill.nombre}
                      </span>
                      <span
                        className="text-micro font-black tabular-nums"
                        style={{
                          color: competente
                            ? "var(--primary)"
                            : "color-mix(in srgb, var(--primary) 45%, transparent)",
                        }}
                      >
                        {bonus >= 0 ? `+${bonus}` : bonus}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <BloqueAtaques
        fichaId={ficha.id}
        fuerza={statEfectivo(ficha, "fuerza")}
        destreza={statEfectivo(ficha, "destreza")}
        bonoCompetencia={bonoCompetencia}
        ataquesManuales={ficha.ataques_manuales ?? []}
        editable={editable}
        onCambiarAtaquesManuales={(siguientes) => onEditarCampo?.("ataques_manuales", siguientes)}
      />

      {/* ── Dados de golpe: chip flotante fijo en la esquina inferior
          izquierda del panel — se usan seguido en mesa (descansos cortos),
          así quedan siempre a mano sin ocupar una fila fija en el scroll. ── */}
      {ficha.dados_golpe && (
        <div
          className="sticky bottom-0 left-0 px-3.5 py-2 flex items-center gap-1.5"
          style={{
            background: "var(--white-custom)",
            borderTop: "1px solid color-mix(in srgb, var(--primary) 8%, transparent)",
          }}
        >
          <span
            className="flex items-center gap-1 text-micro font-black uppercase tracking-wider shrink-0"
            style={{ color: "color-mix(in srgb, var(--primary) 40%, transparent)" }}
          >
            <Dice6 size={11} />
          </span>
          <CampoEditable
            valor={ficha.dados_golpe ?? ""}
            editable={editableStats}
            onCommit={(v) => onEditarCampo?.("dados_golpe", v || null)}
            className="text-sm font-black"
            style={{ color: "var(--primary)" }}
            width={54}
          />
          <span
            className="text-micro font-bold tabular-nums shrink-0"
            style={{ color: "color-mix(in srgb, var(--primary) 45%, transparent)" }}
          >
            {ficha.dados_golpe_usados ?? 0} usados
          </span>
          {editableStats && (
            <div className="flex items-center gap-0.5 ml-1">
              <button
                type="button"
                onClick={() =>
                  onEditarCampo?.(
                    "dados_golpe_usados",
                    Math.max(0, (ficha.dados_golpe_usados ?? 0) - 1),
                  )
                }
                className="flex items-center justify-center rounded hover:bg-primary/10 transition-colors"
                style={{ width: 18, height: 18 }}
              >
                <Minus size={10} className="text-primary/50" />
              </button>
              <button
                type="button"
                onClick={() =>
                  onEditarCampo?.("dados_golpe_usados", (ficha.dados_golpe_usados ?? 0) + 1)
                }
                className="flex items-center justify-center rounded hover:bg-primary/10 transition-colors"
                style={{ width: 18, height: 18 }}
              >
                <Plus size={10} className="text-primary/50" />
              </button>
              <button
                type="button"
                onClick={() => onEditarCampo?.("dados_golpe_usados", 0)}
                className="text-micro font-semibold text-primary/35 hover:text-primary/60 transition-colors ml-0.5"
                title="Ajuste manual: pone los dados de golpe usados en 0 (el botón de descanso largo, arriba del panel, ya hace esto solo)"
              >
                Reset
              </button>
            </div>
          )}
        </div>
      )}
      {/* Si no hay dados de golpe cargados y es editable, chip mínimo para
          poder cargarlos por primera vez sin tener que buscar dónde. */}
      {!ficha.dados_golpe && editableStats && (
        <div
          className="sticky bottom-0 left-0 px-3.5 py-2 flex items-center gap-1.5"
          style={{
            background: "var(--white-custom)",
            borderTop: "1px solid color-mix(in srgb, var(--primary) 8%, transparent)",
          }}
        >
          <Dice6 size={11} style={{ color: "color-mix(in srgb, var(--primary) 40%, transparent)" }} />
          <CampoEditable
            valor=""
            editable
            onCommit={(v) => onEditarCampo?.("dados_golpe", v || null)}
            className="text-sm font-black"
            style={{ color: "var(--primary)" }}
            width={90}
          />
        </div>
      )}
        </>
      )}

      {tab === "identidad" && (
        <div className="p-3.5">
          <ContenidoIdentidadFicha
            ficha={ficha}
            editable={editable}
            onEditarCampo={onEditarCampo}
            clasesDisponibles={clasesDisponibles}
            subclasesDisponibles={subclasesDisponibles}
            trasfondosDisponibles={trasfondosDisponibles}
            dotesGenerales={dotesGenerales}
          />
        </div>
      )}

      {tab === "inventario" && (
        <div className="p-3.5">
          <ContenidoInventarioFicha
            ficha={ficha}
            editable={editable}
            editableStats={editableStats}
            onEditarCampo={onEditarCampo}
            tiposMoneda={tiposMoneda}
          />
        </div>
      )}

      {tab === "historia" && (
        <div className="p-3.5">
          <ContenidoHistoriaFicha ficha={ficha} editable={editable} onEditarCampo={onEditarCampo} />
        </div>
      )}
    </div>
  );
}

// ─── Rasgos y dotes (Features & Traits) ────────────────────────────────────
// Rediseñado siguiendo la hoja oficial de personaje D&D 2024: una sola
// lista continua de entradas (no separada en columnas), cada una con un
// pequeño tag de texto según su origen (Especie/Clase/Dote/Otro) — igual
// que "Species"/"Class"/"Background"/"Feat" en la hoja oficial, pero sin
// color por categoría: solo texto, con el color del tema (primary) como
// todo lo demás en la ficha — y el buscador de dotes visible como su
// propio buscador con resultados, en vez de escondido dentro de un
// <select> de un mini-formulario genérico.

const ORIGEN_CONFIG: Record<RasgoEspecial["origen"], { label: string }> = {
  raza: { label: "Especie" },
  clase: { label: "Clase" },
  dote: { label: "Dote" },
  otro: { label: "Otro" },
};

function TagOrigen({ origen }: { origen: RasgoEspecial["origen"] }) {
  const { label } = ORIGEN_CONFIG[origen];
  return (
    <span
      className="inline-flex items-center shrink-0 px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider"
      style={{
        color: "color-mix(in srgb, var(--primary) 55%, transparent)",
        background: "color-mix(in srgb, var(--primary) 8%, transparent)",
      }}
    >
      {label}
    </span>
  );
}

function TarjetaRasgo({
  rasgo,
  editable,
  onQuitar,
}: {
  rasgo: RasgoEspecial;
  editable: boolean;
  onQuitar: () => void;
}) {
  return (
    <div
      className="group flex items-start gap-2.5 px-3 py-2.5 rounded-lg"
      style={{
        border: "1px solid color-mix(in srgb, var(--primary) 8%, transparent)",
        background: "color-mix(in srgb, var(--primary) 2%, transparent)",
      }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-black" style={{ color: "var(--primary)" }}>
            {rasgo.nombre}
          </p>
          <TagOrigen origen={rasgo.origen} />
        </div>
        {rasgo.descripcion && (
          <p
            className="text-xs mt-1 leading-relaxed"
            style={{ color: "color-mix(in srgb, var(--primary) 60%, transparent)" }}
          >
            {rasgo.descripcion}
          </p>
        )}
      </div>
      {editable && (
        <button
          type="button"
          onClick={onQuitar}
          className="shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 cursor-pointer hover:text-red-500 transition-all"
          style={{ color: "color-mix(in srgb, var(--primary) 30%, transparent)" }}
        >
          <Trash2 size={13} />
        </button>
      )}
    </div>
  );
}

function PanelRasgosEspeciales({
  rasgos,
  editable,
  onCambiar,
}: {
  rasgos: RasgoEspecial[];
  editable: boolean;
  onCambiar: (siguientes: RasgoEspecial[]) => void;
}) {
  const [agregando, setAgregando] = useState(false);
  const [modo, setModo] = useState<"dote" | "rasgo">("rasgo");
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [descNueva, setDescNueva] = useState("");
  const [origenNuevo, setOrigenNuevo] = useState<RasgoEspecial["origen"]>("otro");
  const { dotes: catalogoDotes, loading: cargandoDotes } = useDotesDisponibles();
  const [busquedaDote, setBusquedaDote] = useState("");

  const dotesFiltradas = catalogoDotes.filter((d) =>
    d.nombre.toLowerCase().includes(busquedaDote.trim().toLowerCase()),
  );
  const dotesPorCategoria = {
    origen: dotesFiltradas.filter((d) => d.categoria === "origen"),
    general: dotesFiltradas.filter((d) => d.categoria === "general"),
    epica: dotesFiltradas.filter((d) => d.categoria === "epica"),
  };

  const resetFormulario = useCallback(() => {
    setAgregando(false);
    setModo("rasgo");
    setNombreNuevo("");
    setDescNueva("");
    setOrigenNuevo("otro");
    setBusquedaDote("");
  }, []);

  const agregarRasgo = useCallback(() => {
    const nombre = nombreNuevo.trim();
    if (!nombre) {
      resetFormulario();
      return;
    }
    const rasgo: RasgoEspecial = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      nombre,
      descripcion: descNueva.trim(),
      origen: origenNuevo,
    };
    onCambiar([...rasgos, rasgo]);
    resetFormulario();
  }, [nombreNuevo, descNueva, origenNuevo, rasgos, onCambiar, resetFormulario]);

  const agregarDote = useCallback(
    (dote: DoteDnd) => {
      const yaLaTiene = rasgos.some((r) => r.origen === "dote" && r.nombre === dote.nombre);
      if (yaLaTiene) return;
      const rasgo: RasgoEspecial = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        nombre: dote.nombre,
        descripcion: dote.descripcion?.trim() ?? "",
        origen: "dote",
      };
      onCambiar([...rasgos, rasgo]);
      resetFormulario();
    },
    [rasgos, onCambiar, resetFormulario],
  );

  const quitar = useCallback(
    (id: string) => {
      onCambiar(rasgos.filter((r) => r.id !== id));
    },
    [rasgos, onCambiar],
  );

  if (!editable && rasgos.length === 0) return null;

  const bloqueDotes = (titulo: string, lista: DoteDnd[]) =>
    lista.length === 0 ? null : (
      <div key={titulo}>
        <p
          className="text-[10px] font-black uppercase tracking-[0.2em] px-1 mb-1"
          style={{ color: "color-mix(in srgb, var(--primary) 35%, transparent)" }}
        >
          {titulo}
        </p>
        <div className="flex flex-col gap-1">
          {lista.map((d) => {
            const yaElegida = rasgos.some((r) => r.origen === "dote" && r.nombre === d.nombre);
            return (
              <button
                key={d.id}
                type="button"
                disabled={yaElegida}
                onClick={() => agregarDote(d)}
                className="flex items-start gap-2 px-2.5 py-2 rounded-lg text-left transition-colors disabled:opacity-40 disabled:cursor-default disabled:pointer-events-none hover:bg-primary/[0.05] cursor-pointer"
                style={{ border: "1px solid color-mix(in srgb, var(--primary) 8%, transparent)" }}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black" style={{ color: "var(--primary)" }}>
                    {d.nombre}
                    {d.prerequisito && (
                      <span
                        className="ml-1.5 text-[10px] font-normal normal-case"
                        style={{ color: "color-mix(in srgb, var(--primary) 45%, transparent)" }}
                      >
                        (req. {d.prerequisito})
                      </span>
                    )}
                  </p>
                  {d.descripcion && (
                    <p
                      className="text-[11px] mt-0.5 leading-snug"
                      style={{ color: "color-mix(in srgb, var(--primary) 55%, transparent)" }}
                    >
                      {d.descripcion}
                    </p>
                  )}
                </div>
                {yaElegida ? (
                  <CheckCircle2
                    size={14}
                    className="shrink-0 mt-0.5"
                    style={{ color: "color-mix(in srgb, var(--primary) 45%, transparent)" }}
                  />
                ) : (
                  <Plus
                    size={14}
                    className="shrink-0 mt-0.5"
                    style={{ color: "color-mix(in srgb, var(--primary) 35%, transparent)" }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    );

  return (
    <div
      className="px-5 py-4 flex flex-col gap-3"
      style={{
        borderTop: "1px solid color-mix(in srgb, var(--primary) 8%, transparent)",
      }}
    >
      <SeparadorLabel label="Rasgos y dotes" />

      {rasgos.length === 0 && !agregando && (
        <p
          className="text-micro italic"
          style={{ color: "color-mix(in srgb, var(--primary) 35%, transparent)" }}
        >
          Sin rasgos ni dotes registrados aún.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {rasgos.map((r) => (
          <TarjetaRasgo key={r.id} rasgo={r} editable={editable} onQuitar={() => quitar(r.id)} />
        ))}
      </div>

      {editable && (
        <>
          {agregando ? (
            <div
              className="flex flex-col gap-2.5 px-3 py-3 rounded-lg"
              style={{
                border: "1px solid color-mix(in srgb, var(--primary) 15%, transparent)",
              }}
            >
              {/* Selector de modo: catálogo de dotes vs. rasgo de texto libre
                  (raza/clase/otro) — dos flujos distintos porque las dotes
                  tienen un catálogo real (dotes_dnd) y el resto no. */}
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setModo("dote")}
                  className="flex-1 flex items-center justify-center px-2.5 py-1.5 rounded-md text-micro font-black uppercase tracking-wider transition-colors cursor-pointer"
                  style={
                    modo === "dote"
                      ? { color: "var(--primary)", background: "color-mix(in srgb, var(--primary) 8%, transparent)" }
                      : { color: "color-mix(in srgb, var(--primary) 45%, transparent)" }
                  }
                >
                  Elegir dote
                </button>
                <button
                  type="button"
                  onClick={() => setModo("rasgo")}
                  className="flex-1 flex items-center justify-center px-2.5 py-1.5 rounded-md text-micro font-black uppercase tracking-wider transition-colors cursor-pointer"
                  style={
                    modo === "rasgo"
                      ? { color: "var(--primary)", background: "color-mix(in srgb, var(--primary) 8%, transparent)" }
                      : { color: "color-mix(in srgb, var(--primary) 45%, transparent)" }
                  }
                >
                  Rasgo libre
                </button>
              </div>

              {modo === "dote" ? (
                <div className="flex flex-col gap-2">
                  <input
                    autoFocus
                    type="text"
                    value={busquedaDote}
                    onChange={(e) => setBusquedaDote(e.target.value)}
                    placeholder="Buscar dote…"
                    className="px-2.5 py-1.5 rounded-md outline-none text-xs"
                    style={{
                      border: "1px solid color-mix(in srgb, var(--primary) 15%, transparent)",
                      color: "var(--primary)",
                    }}
                  />
                  {cargandoDotes ? (
                    <p className="text-micro" style={{ color: "color-mix(in srgb, var(--primary) 40%, transparent)" }}>
                      Cargando catálogo de dotes…
                    </p>
                  ) : dotesFiltradas.length === 0 ? (
                    <p className="text-micro" style={{ color: "color-mix(in srgb, var(--primary) 40%, transparent)" }}>
                      Sin resultados.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-3 max-h-72 overflow-y-auto pr-1">
                      {bloqueDotes("Origen", dotesPorCategoria.origen)}
                      {bloqueDotes("General", dotesPorCategoria.general)}
                      {bloqueDotes("Épica", dotesPorCategoria.epica)}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={resetFormulario}
                    className="self-end text-micro font-black uppercase tracking-wider px-2 py-1"
                    style={{ color: "color-mix(in srgb, var(--primary) 40%, transparent)" }}
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      type="text"
                      value={nombreNuevo}
                      onChange={(e) => setNombreNuevo(e.target.value)}
                      placeholder="Nombre (ej. Visión en la oscuridad, Segundo aliento…)"
                      className="flex-1 bg-transparent outline-none text-micro font-black uppercase tracking-wider placeholder:normal-case placeholder:font-normal"
                      style={{ color: "var(--primary)" }}
                    />
                    <select
                      value={origenNuevo}
                      onChange={(e) => setOrigenNuevo(e.target.value as RasgoEspecial["origen"])}
                      className="shrink-0 bg-transparent outline-none text-micro font-bold"
                      style={{
                        color: "color-mix(in srgb, var(--primary) 55%, transparent)",
                        borderBottom: "1px dashed color-mix(in srgb, var(--primary) 25%, transparent)",
                      }}
                    >
                      <option value="raza">Especie</option>
                      <option value="clase">Clase</option>
                      <option value="otro">Otro</option>
                    </select>
                  </div>
                  <textarea
                    value={descNueva}
                    onChange={(e) => setDescNueva(e.target.value)}
                    placeholder="Descripción (opcional)"
                    rows={2}
                    className="bg-transparent outline-none resize-none text-micro"
                    style={{ color: "color-mix(in srgb, var(--primary) 55%, transparent)" }}
                  />
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      type="button"
                      onClick={resetFormulario}
                      className="text-micro font-black uppercase tracking-wider px-2 py-1"
                      style={{ color: "color-mix(in srgb, var(--primary) 40%, transparent)" }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={agregarRasgo}
                      className="text-micro font-black uppercase tracking-wider px-2 py-1"
                      style={{ color: "var(--primary)" }}
                    >
                      Guardar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAgregando(true)}
              className="flex items-center gap-1.5 self-start text-micro font-black uppercase tracking-wider px-2.5 py-1.5 cursor-pointer"
              style={{
                color: "color-mix(in srgb, var(--primary) 45%, transparent)",
                border: "1px dashed color-mix(in srgb, var(--primary) 20%, transparent)",
                borderRadius: "2px",
              }}
            >
              <Plus size={11} />
              Agregar rasgo o dote
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ─── Lanzamiento de conjuros ────────────────────────────────────────────────
// Solo aparece si la ficha tiene lanzador_conjuros=true, o si es editable (el
// dueño puede activarlo). Muestra característica de conjuros, CD/bono de
// ataque derivados, espacios de conjuro por nivel y la lista de conjuros
// conocidos/preparados.

const NIVELES_CONJURO = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

function PanelConjuros({
  ficha,
  editable,
  editableStats,
  onEditarCampo,
}: {
  ficha: FichaDnd;
  editable: boolean;
  editableStats: boolean;
  onEditarCampo?: (campo: keyof FichaDnd, valor: CampoFichaValor) => void;
}) {
  const [agregando, setAgregando] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [nivelNuevo, setNivelNuevo] = useState(0);

  if (!ficha.lanzador_conjuros && !editable) return null;

  // ── Sin activar todavía: solo el dueño ve un botón chico para activarlo. ──
  if (!ficha.lanzador_conjuros) {
    return (
      <div
        className="px-5 py-4"
        style={{ borderTop: "1px solid color-mix(in srgb, var(--primary) 8%, transparent)" }}
      >
        <button
          type="button"
          onClick={() => onEditarCampo?.("lanzador_conjuros", true)}
          className="flex items-center gap-1.5 text-micro font-black uppercase tracking-wider px-2.5 py-1.5"
          style={{
            color: "color-mix(in srgb, var(--primary) 45%, transparent)",
            border: "1px dashed color-mix(in srgb, var(--primary) 20%, transparent)",
            borderRadius: "2px",
          }}
        >
          <Wand2 size={11} />
          Es lanzador de conjuros
        </button>
      </div>
    );
  }

  const cd = cdSalvacionConjuros(ficha as unknown as Parameters<typeof cdSalvacionConjuros>[0]);
  const bonoAtaque = bonoAtaqueConjuros(ficha as unknown as Parameters<typeof bonoAtaqueConjuros>[0]);
  const espacios = ficha.espacios_conjuro ?? {};
  const espacioUnico = espacios["1"] ?? { max: 0, usados: 0 };
  const conjuros = ficha.conjuros ?? [];
  const trucos = conjuros.filter((c) => c.nivel === 0);
  const conNivel = conjuros.filter((c) => c.nivel > 0).sort((a, b) => a.nivel - b.nivel);

  const actualizarEspacio = (nivel: number, cambios: Partial<{ max: number; usados: number }>) => {
    const key = String(nivel);
    const actual = espacios[key] ?? { max: 0, usados: 0 };
    onEditarCampo?.("espacios_conjuro", { ...espacios, [key]: { ...actual, ...cambios } });
  };

  const agregarConjuro = () => {
    const nombre = nombreNuevo.trim();
    if (!nombre) {
      setAgregando(false);
      return;
    }
    const nuevo: ConjuroFicha = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      nombre,
      nivel: nivelNuevo,
      preparado: true,
    };
    onEditarCampo?.("conjuros", [...conjuros, nuevo]);
    setNombreNuevo("");
    setNivelNuevo(0);
    setAgregando(false);
  };

  const quitarConjuro = (id: string) => {
    onEditarCampo?.("conjuros", conjuros.filter((c) => c.id !== id));
  };

  const togglePreparado = (id: string) => {
    onEditarCampo?.(
      "conjuros",
      conjuros.map((c) => (c.id === id ? { ...c, preparado: !c.preparado } : c)),
    );
  };

  const filaConjuro = (c: ConjuroFicha) => (
    <div
      key={c.id}
      className="flex items-center gap-2 px-2.5 py-1.5"
      style={{
        border: "1px solid color-mix(in srgb, var(--primary) 10%, transparent)",
        borderRadius: "2px",
        background: "color-mix(in srgb, var(--primary) 3%, transparent)",
      }}
    >
      <button
        type="button"
        disabled={!editable}
        onClick={() => togglePreparado(c.id)}
        title={c.preparado ? "Preparado" : "No preparado"}
        className="shrink-0 rounded-full transition-colors disabled:cursor-default"
        style={{
          width: 10,
          height: 10,
          border: "1.5px solid var(--primary)",
          background: c.preparado ? "var(--primary)" : "transparent",
        }}
      />
      <span className="flex-1 min-w-0 text-xs font-semibold text-primary/75 truncate">
        {c.nombre}
      </span>
      <span className="shrink-0 text-micro font-bold tabular-nums text-primary/40">
        {c.nivel === 0 ? "Truco" : `Nv. ${c.nivel}`}
      </span>
      {editable && (
        <button
          type="button"
          onClick={() => quitarConjuro(c.id)}
          className="shrink-0 cursor-pointer hover:text-red-500 transition-colors"
          style={{ color: "color-mix(in srgb, var(--primary) 30%, transparent)" }}
        >
          <Trash2 size={11} />
        </button>
      )}
    </div>
  );

  return (
    <div
      className="px-5 py-4 flex flex-col gap-3"
      style={{ borderTop: "1px solid color-mix(in srgb, var(--primary) 8%, transparent)" }}
    >
      <SeparadorLabel label="Conjuros" />

      {/* ── Característica + CD + Ataque + Espacios, todo en una fila
          de 4 columnas, cajas un poco más chicas para que entren bien. ── */}
      <div className="grid grid-cols-4 gap-1.5">
        <div
          className="flex flex-col gap-0.5 px-1.5 py-1.5"
          style={{
            border: "1px solid color-mix(in srgb, var(--primary) 10%, transparent)",
            borderRadius: "2px",
            background: "color-mix(in srgb, var(--primary) 3%, transparent)",
          }}
        >
          <span
            className="text-micro font-black uppercase tracking-wider"
            style={{ color: "color-mix(in srgb, var(--primary) 40%, transparent)" }}
          >
            Caracts.
          </span>
          {editable ? (
            <select
              value={ficha.caracteristica_conjuros ?? ""}
              onChange={(e) => onEditarCampo?.("caracteristica_conjuros", e.target.value || null)}
              className="bg-transparent outline-none text-xs font-black"
              style={{
                color: "var(--primary)",
                borderBottom: "1px dashed color-mix(in srgb, var(--primary) 25%, transparent)",
              }}
            >
              <option value="">Elegir…</option>
              <option value="inteligencia">Inteligencia</option>
              <option value="sabiduria">Sabiduría</option>
              <option value="carisma">Carisma</option>
            </select>
          ) : (
            <span className="text-xs font-black capitalize" style={{ color: "var(--primary)" }}>
              {ficha.caracteristica_conjuros ?? "—"}
            </span>
          )}
        </div>
        <div
          className="flex flex-col gap-0.5 px-1.5 py-1.5"
          style={{
            border: "1px solid color-mix(in srgb, var(--primary) 10%, transparent)",
            borderRadius: "2px",
            background: "color-mix(in srgb, var(--primary) 3%, transparent)",
          }}
          title="CD = 8 + bono de competencia + mod. de la característica de conjuros"
        >
          <span
            className="text-micro font-black uppercase tracking-wider"
            style={{ color: "color-mix(in srgb, var(--primary) 40%, transparent)" }}
          >
            CD
          </span>
          <span className="text-sm font-black tabular-nums" style={{ color: "var(--primary)" }}>
            {cd ?? "—"}
          </span>
        </div>
        <div
          className="flex flex-col gap-0.5 px-1.5 py-1.5"
          style={{
            border: "1px solid color-mix(in srgb, var(--primary) 10%, transparent)",
            borderRadius: "2px",
            background: "color-mix(in srgb, var(--primary) 3%, transparent)",
          }}
          title="Bono de ataque con conjuros = bono de competencia + mod. de la característica de conjuros"
        >
          <span
            className="text-micro font-black uppercase tracking-wider"
            style={{ color: "color-mix(in srgb, var(--primary) 40%, transparent)" }}
          >
            Ataque
          </span>
          <span className="text-sm font-black tabular-nums" style={{ color: "var(--primary)" }}>
            {bonoAtaque === null ? "—" : bonoAtaque >= 0 ? `+${bonoAtaque}` : bonoAtaque}
          </span>
        </div>
        <div
          className="flex flex-col gap-0.5 px-1.5 py-1.5"
          style={{
            border: "1px solid color-mix(in srgb, var(--primary) 10%, transparent)",
            borderRadius: "2px",
            background: "color-mix(in srgb, var(--primary) 3%, transparent)",
          }}
        >
          <span
            className="text-micro font-black uppercase tracking-wider"
            style={{ color: "color-mix(in srgb, var(--primary) 40%, transparent)" }}
          >
            Espacios
          </span>
          <span className="flex items-center gap-0.5 text-sm font-black tabular-nums" style={{ color: "var(--primary)" }}>
            <CampoEditable
              valor={espacioUnico.usados}
              editable={editableStats}
              tipo="number"
              align="center"
              width={16}
              onCommit={(v) => actualizarEspacio(1, { usados: Number(v) || 0 })}
              className="text-sm font-black tabular-nums"
              style={{ color: "var(--primary)" }}
            />
            /
            <CampoEditable
              valor={espacioUnico.max}
              editable={editableStats}
              tipo="number"
              align="center"
              width={16}
              onCommit={(v) => actualizarEspacio(1, { max: Number(v) || 0 })}
              className="text-sm font-black tabular-nums"
              style={{ color: "var(--primary)" }}
            />
          </span>
        </div>
      </div>

      {/* ── Trucos + conjuros conocidos/preparados ── */}
      <div className="flex flex-col gap-1.5">
        {trucos.length > 0 && (
          <div className="flex flex-col gap-1.5">{trucos.map(filaConjuro)}</div>
        )}
        {conNivel.length > 0 && (
          <div className="flex flex-col gap-1.5">{conNivel.map(filaConjuro)}</div>
        )}
        {conjuros.length === 0 && !agregando && (
          <p
            className="text-micro italic"
            style={{ color: "color-mix(in srgb, var(--primary) 35%, transparent)" }}
          >
            Sin conjuros anotados aún.
          </p>
        )}

        {editable && (
          <>
            {agregando ? (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1.5"
                style={{
                  border: "1px solid color-mix(in srgb, var(--primary) 15%, transparent)",
                  borderRadius: "2px",
                }}
              >
                <input
                  autoFocus
                  type="text"
                  value={nombreNuevo}
                  onChange={(e) => setNombreNuevo(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && agregarConjuro()}
                  placeholder="Nombre del conjuro"
                  className="flex-1 min-w-0 bg-transparent outline-none text-xs"
                  style={{ color: "var(--primary)" }}
                />
                <select
                  value={nivelNuevo}
                  onChange={(e) => setNivelNuevo(Number(e.target.value))}
                  className="shrink-0 bg-transparent outline-none text-micro font-bold"
                  style={{ color: "color-mix(in srgb, var(--primary) 55%, transparent)" }}
                >
                  <option value={0}>Truco</option>
                  {NIVELES_CONJURO.map((n) => (
                    <option key={n} value={n}>
                      Nv. {n}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={agregarConjuro}
                  className="shrink-0 text-micro font-black uppercase tracking-wider px-1.5"
                  style={{ color: "var(--primary)" }}
                >
                  Ok
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAgregando(true)}
                className="flex items-center gap-1.5 self-start text-micro font-black uppercase tracking-wider px-2.5 py-1.5"
                style={{
                  color: "color-mix(in srgb, var(--primary) 45%, transparent)",
                  border: "1px dashed color-mix(in srgb, var(--primary) 20%, transparent)",
                  borderRadius: "2px",
                }}
              >
                <Plus size={11} />
                Agregar conjuro
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Inventario + ataques derivados ────────────────────────────────────────
// Vive como componente aparte porque usa su propio hook de datos
// (useInventarioFicha cargando por fichaId) — separarlo evita que
// FichaStatsPanel dispare esa consulta cuando no hace falta mostrarla.

// ── Badge/selector de la Maestría de Arma (PHB 2024) activa en una fila de
//    inventario equipada. Fuera de edición muestra un badge con tooltip
//    (title) con la descripción; en edición es un <select> chico. ──
function MaestriaArmaFilaInventario({
  valor,
  editable,
  onCambiar,
}: {
  valor: MaestriaArma | null;
  editable: boolean;
  onCambiar: (maestria: MaestriaArma | null) => void;
}) {
  if (editable) {
    return (
      <select
        value={valor ?? ""}
        onChange={(e) => onCambiar((e.target.value || null) as MaestriaArma | null)}
        onClick={(e) => e.stopPropagation()}
        className="shrink-0 h-6 px-1 rounded text-micro font-semibold outline-none"
        style={{
          border: "1px solid color-mix(in srgb, var(--primary) 12%, transparent)",
          background: "color-mix(in srgb, var(--primary) 3%, transparent)",
          color: "color-mix(in srgb, var(--primary) 65%, transparent)",
        }}
      >
        <option value="">Maestría…</option>
        {MAESTRIAS_ARMA_DND.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    );
  }
  if (!valor) return null;
  return (
    <span
      title={DESCRIPCION_MAESTRIA_ARMA[valor]}
      className="shrink-0 text-micro font-black uppercase tracking-wide px-1.5 py-0.5 rounded"
      style={{
        background: "color-mix(in srgb, var(--primary) 10%, transparent)",
        color: "color-mix(in srgb, var(--primary) 60%, transparent)",
      }}
    >
      {valor}
    </span>
  );
}

function PanelInventarioFicha({
  fichaId,
  editable,
  monedas,
  tiposMoneda,
  editableMonedas,
  onEditarMonedas,
  maestriasArmas,
  onEditarMaestrias,
}: {
  fichaId: string;
  editable: boolean;
  monedas?: Record<string, number>;
  tiposMoneda: Array<{ id: string; nombre: string; simbolo?: string | null }>;
  editableMonedas: boolean;
  onEditarMonedas: (monedas: Record<string, number>) => void;
  /** Maestría activa por fila de inventario (PHB 2024): { inventario_id: "Vex" }. */
  maestriasArmas?: Record<string, string>;
  onEditarMaestrias?: (maestrias: Record<string, string>) => void;
}) {
  const { items, loading, agregar, quitar, toggleEquipado, editarCantidad } =
    useInventarioFicha(fichaId);
  const [buscando, setBuscando] = useState(false);

  return (
    <>
      {/* ── Monedas: vivía junto a Velocidad/Percepción en el panel
          principal — se movió acá porque es un dato de inventario, no de
          combate. En bloques (grilla), no en filas verticales — mismo
          criterio visual que las estadísticas de la tab Stats, para
          escanear los montos de un vistazo en vez de leer fila por fila. ── */}
      <div
        className="px-5 py-4"
        style={{
          borderTop: "1px solid color-mix(in srgb, var(--primary) 8%, transparent)",
        }}
      >
        <SeparadorLabel label="Monedas" />
        {tiposMoneda.length === 0 ? (
          // Sin tipos definidos en el reino todavía (o ficha vieja migrada):
          // se muestra el total genérico bajo la clave "legado" para no
          // perder el dato, editable igual que antes.
          <div
            className="flex flex-col items-center justify-center gap-1 py-3 rounded-xl"
            style={{ border: "1px solid color-mix(in srgb, var(--primary) 10%, transparent)" }}
          >
            <span
              className="text-micro font-black uppercase tracking-widest"
              style={{ color: "color-mix(in srgb, var(--primary) 35%, transparent)" }}
            >
              Total
            </span>
            <CampoEditable
              valor={monedas?.legado ?? 0}
              editable={editableMonedas}
              tipo="number"
              align="center"
              onCommit={(v) => onEditarMonedas({ ...monedas, legado: Number(v) || 0 })}
              className="text-base font-black tabular-nums"
              style={{ color: "var(--primary)" }}
            />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {tiposMoneda.map((tipo) => (
              <div
                key={tipo.id}
                className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl"
                style={{ border: "1px solid color-mix(in srgb, var(--primary) 10%, transparent)" }}
              >
                <span
                  className="text-micro font-black uppercase tracking-widest truncate max-w-full px-1"
                  style={{ color: "color-mix(in srgb, var(--primary) 35%, transparent)" }}
                  title={tipo.nombre}
                >
                  {tipo.simbolo || tipo.nombre}
                </span>
                <CampoEditable
                  valor={monedas?.[tipo.id] ?? 0}
                  editable={editableMonedas}
                  tipo="number"
                  align="center"
                  onCommit={(v) =>
                    onEditarMonedas({
                      ...monedas,
                      [tipo.id]: Number(v) || 0,
                    })
                  }
                  className="text-base font-black tabular-nums"
                  style={{ color: "var(--primary)" }}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Inventario completo. Cualquiera con `editable` puede agregar
          ítems del catálogo del mundo, ajustar cantidad, marcar equipado
          o quitarlos — mismo criterio que el resto de datos de rol-play. ── */}
      <div
        className="px-5 py-4"
        style={{
          borderTop: "1px solid color-mix(in srgb, var(--primary) 8%, transparent)",
        }}
      >
        <SeparadorLabel label="Inventario" />

        {editable && (
          <div className="mb-2">
            {buscando ? (
              <SelectorEntidad
                placeholder="Buscar ítem del mundo…"
                buscar={buscarItems}
                onSeleccionar={async (item) => {
                  await agregar(item.id);
                  setBuscando(false);
                }}
              />
            ) : (
              <button
                type="button"
                onClick={() => setBuscando(true)}
                className="flex items-center gap-1.5 text-micro font-bold uppercase tracking-wider transition-colors"
                style={{ color: "color-mix(in srgb, var(--primary) 45%, transparent)" }}
              >
                <Plus size={11} />
                Agregar ítem
              </button>
            )}
          </div>
        )}

        {loading ? (
          <div className="py-4 flex items-center justify-center">
            <Loader2 size={14} className="animate-spin text-primary/30" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-xs text-primary/30 flex items-center gap-1.5">
            <Backpack size={12} />
            Sin ítems todavía.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {items.map((fila) => (
              <div
                key={fila.id}
                className="flex items-center gap-2 px-2.5 py-1.5"
                style={{
                  border: fila.equipado
                    ? "1px solid color-mix(in srgb, var(--primary) 30%, transparent)"
                    : "1px solid color-mix(in srgb, var(--primary) 10%, transparent)",
                  borderRadius: "2px",
                  background: fila.equipado
                    ? "color-mix(in srgb, var(--primary) 6%, transparent)"
                    : "color-mix(in srgb, var(--primary) 3%, transparent)",
                }}
              >
                <div className="w-6 h-6 shrink-0 rounded overflow-hidden bg-primary/5">
                  {fila.item?.imagen_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={fila.item.imagen_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <span className="flex-1 min-w-0 text-xs font-semibold text-primary/75 truncate">
                  {fila.item?.nombre ?? "Ítem"}
                </span>

                {fila.item?.es_arma && fila.equipado && (
                  <MaestriaArmaFilaInventario
                    valor={(maestriasArmas?.[fila.id] as MaestriaArma | undefined) ?? null}
                    editable={editable}
                    onCambiar={(m) => {
                      const actualizado = { ...(maestriasArmas ?? {}) };
                      if (m) actualizado[fila.id] = m;
                      else delete actualizado[fila.id];
                      onEditarMaestrias?.(actualizado);
                    }}
                  />
                )}

                {editable ? (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => editarCantidad(fila.id, fila.cantidad - 1)}
                      disabled={fila.cantidad <= 1}
                      className="flex items-center justify-center rounded hover:bg-primary/10 transition-colors disabled:opacity-30"
                      style={{ width: 16, height: 16 }}
                    >
                      <Minus size={9} className="text-primary/50" />
                    </button>
                    <span className="text-micro font-bold tabular-nums w-4 text-center text-primary/60">
                      {fila.cantidad}
                    </span>
                    <button
                      type="button"
                      onClick={() => editarCantidad(fila.id, fila.cantidad + 1)}
                      className="flex items-center justify-center rounded hover:bg-primary/10 transition-colors"
                      style={{ width: 16, height: 16 }}
                    >
                      <Plus size={9} className="text-primary/50" />
                    </button>
                  </div>
                ) : (
                  <span className="shrink-0 text-micro font-bold tabular-nums text-primary/40">
                    ×{fila.cantidad}
                  </span>
                )}

                {editable && (
                  <button
                    type="button"
                    onClick={() => toggleEquipado(fila)}
                    title={fila.equipado ? "Quitar equipamiento" : "Equipar"}
                    className="shrink-0 flex items-center justify-center rounded-full transition-colors"
                    style={{
                      width: 22,
                      height: 22,
                      color: fila.equipado
                        ? "var(--primary)"
                        : "color-mix(in srgb, var(--primary) 30%, transparent)",
                    }}
                  >
                    <Shield size={12} fill={fila.equipado ? "var(--primary)" : "none"} />
                  </button>
                )}

                {editable && (
                  <button
                    type="button"
                    onClick={() => quitar(fila.id)}
                    className="shrink-0 flex items-center justify-center rounded-full hover:bg-red-500/10 hover:text-red-500 text-primary/25 transition-colors"
                    style={{ width: 22, height: 22 }}
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Tirada de dados ────────────────────────────────────────────────────────
// Set clásico de D&D (D4/D6/D8/D10/D12/D20/D100). Cada tap tira y anima el
// resultado; guarda las últimas tiradas en una lista corta. Sin persistencia
// en base — es solo una herramienta de mesa, vive en el estado del cliente.

const CARAS_DADO = [4, 6, 8, 10, 12, 20, 100] as const;
type CaraDado = (typeof CARAS_DADO)[number];

interface TiradaHistorial {
  id: string;
  caras: CaraDado;
  resultado: number;
}

function DadoBoton({
  caras,
  onTirar,
  activo,
}: {
  caras: CaraDado;
  onTirar: (caras: CaraDado) => void;
  activo: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onTirar(caras)}
      disabled={activo}
      className="w-full flex items-center justify-center py-1.5 rounded-lg border transition-all disabled:opacity-60"
      style={{
        borderColor: "color-mix(in srgb, var(--primary) 12%, transparent)",
        background: activo
          ? "color-mix(in srgb, var(--primary) 10%, transparent)"
          : "color-mix(in srgb, var(--primary) 3%, transparent)",
      }}
    >
      <span
        className={`text-micro font-black uppercase tracking-wider ${activo ? "animate-pulse" : ""}`}
        style={{ color: "color-mix(in srgb, var(--primary) 55%, transparent)" }}
      >
        d{caras}
      </span>
    </button>
  );
}

export function TiradaDados() {
  const [tirando, setTirando] = useState<CaraDado | null>(null);
  const [ultima, setUltima] = useState<TiradaHistorial | null>(null);
  const [historial, setHistorial] = useState<TiradaHistorial[]>([]);

  const tirar = useCallback((caras: CaraDado) => {
    setTirando(caras);
    // Pequeña animación antes de revelar el resultado — se siente más a
    // "tirar el dado" que a que el número aparezca instantáneo.
    window.setTimeout(() => {
      const resultado = 1 + Math.floor(Math.random() * caras);
      const nueva: TiradaHistorial = { id: `${Date.now()}-${caras}`, caras, resultado };
      setUltima(nueva);
      setHistorial((prev) => [nueva, ...prev].slice(0, 20));
      setTirando(null);
    }, 420);
  }, []);

  return (
    <div
      className="overflow-hidden flex flex-col"
      style={{
        background: "var(--white-custom)",
        borderRadius: "var(--radius-card)",
        border: "1px solid color-mix(in srgb, var(--primary) 12%, transparent)",
      }}
    >
      {/* ── Resultado de la última tirada: arriba, ocupando todo el ancho. ── */}
      <div
        className="px-5 pt-4 pb-3 min-h-[28px] flex items-center justify-center"
        style={{ borderBottom: "1px solid color-mix(in srgb, var(--primary) 8%, transparent)" }}
      >
        <AnimatePresence mode="wait">
          {ultima && !tirando && (
            <MotionDiv
              key={ultima.id}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              initial={{ opacity: 0, scale: 0.8 }}
              className="flex items-baseline gap-1"
            >
              <span
                className="text-micro font-black uppercase tracking-wider"
                style={{ color: "color-mix(in srgb, var(--primary) 35%, transparent)" }}
              >
                d{ultima.caras}
              </span>
              <span className="text-xl font-black tabular-nums" style={{ color: "var(--primary)" }}>
                {ultima.resultado}
              </span>
            </MotionDiv>
          )}
        </AnimatePresence>
      </div>

      {/* ── Debajo: dados y recientes en columnas verticales paralelas. ── */}
      <div className="flex">
        <div
          className="w-14 shrink-0 flex flex-col gap-1 p-2"
          style={{ borderRight: "1px solid color-mix(in srgb, var(--primary) 8%, transparent)" }}
        >
          {CARAS_DADO.map((caras) => (
            <DadoBoton key={caras} caras={caras} activo={tirando === caras} onTirar={tirar} />
          ))}
        </div>

        {/* ── Recientes: última tirada aparte no cuenta. Se apilan en
            columna, en paralelo a los dados, y se cortan solas por altura
            del contenedor (overflow-hidden) — no hay un tope fijo de
            cantidad, entran las que alcancen sin generar scroll. ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-1 p-2 overflow-hidden">
          {historial.slice(1).map((t) => (
            <span
              key={t.id}
              className="shrink-0 text-micro font-bold tabular-nums px-2 py-1.5 rounded-lg text-center"
              style={{
                color: "color-mix(in srgb, var(--primary) 45%, transparent)",
                background: "color-mix(in srgb, var(--primary) 5%, transparent)",
              }}
            >
              d{t.caras}: {t.resultado}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Fila de misiones aceptadas ─────────────────────────────────────────────
// Ya no es un botón que abre un panel aparte: se muestra directo, en fila,
// debajo de la info del personaje. Solo lista lo que la identidad activa ya
// aceptó (en curso o lista para reclamar) — para nada de "tablón" acá.

interface MisionesProps {
  /** Identidad activa (ficha D&D) para la que se cargan/actualizan misiones. */
  ficha: FichaDnd;
  /** Se dispara tras reclamar una recompensa, para refrescar la ficha en el padre. */
  onFichaActualizada?: () => void;
}

const ICONO_ESTADO: Record<string, typeof Clock> = {
  en_curso: Clock,
  completada: CheckCircle2,
};

const LABEL_ESTADO: Record<string, string> = {
  en_curso: "En curso",
  completada: "Lista para reclamar",
};

export default function Misiones({ ficha, onFichaActualizada }: MisionesProps) {
  const [misionModal, setMisionModal] = useState<MisionConProgreso | null>(null);
  const [misiones, setMisiones] = useState<MisionConProgreso[]>([]);
  const [cargando, setCargando] = useState(true);
  const [reclamandoId, setReclamandoId] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const showAviso = (msg: string) => {
    setAviso(msg);
    setTimeout(() => setAviso(null), 3500);
  };

  // Combina catálogo + progreso del usuario en una sola lista para la UI.
  const combinarMisiones = useCallback(
    (catalogo: any[], progresoRows: any[]): MisionConProgreso[] => {
      const progresoPorMision = new Map(progresoRows.map((p: any) => [p.mision_id, p]));
      return catalogo.map((m: any) => {
        const prog = progresoPorMision.get(m.id);
        return {
          id: m.id,
          titulo: m.titulo,
          descripcion: m.descripcion,
          dificultad: (m.dificultad as Dificultad) ?? "facil",
          categoria: m.categoria,
          imagen_url: m.imagen_url,
          requisitos: m.requisitos,
          vence_en: m.vence_en,
          recompensa: {
            xp: m.recompensa_xp ?? 0,
            monedas: m.recompensa_monedas ?? undefined,
            item_nombre: m.recompensa_item_nombre ?? undefined,
            item_imagen_url: m.recompensa_item_imagen_url ?? undefined,
          },
          recompensa_item_id: m.recompensa_item_id ?? null,
          user_estado: prog?.estado ?? null,
          progreso: prog?.progreso ?? 0,
        };
      });
    },
    [],
  );

  // ── Carga inicial ─────────────────────────────────────────────────────
  useEffect(() => {
    async function cargarTodo() {
      setCargando(true);
      try {
        const [catalogo, progresoRows] = await Promise.all([
          loadMisiones((catalogoActualizado) => {
            setMisiones((prev) => {
              const progresoActual = prev.map((m) => ({
                mision_id: m.id,
                estado: m.user_estado,
                progreso: m.progreso,
              }));
              return combinarMisiones(catalogoActualizado, progresoActual);
            });
          }),
          loadMisionesUsuario(ficha.id, (progresoActualizado) => {
            setMisiones((prev) => {
              const catalogoActual = prev.map((m) => ({
                id: m.id,
                titulo: m.titulo,
                descripcion: m.descripcion,
                dificultad: m.dificultad,
                categoria: m.categoria,
                imagen_url: m.imagen_url,
                requisitos: m.requisitos,
                vence_en: m.vence_en,
                recompensa_xp: m.recompensa.xp,
                recompensa_monedas: m.recompensa.monedas,
                recompensa_item_nombre: m.recompensa.item_nombre,
                recompensa_item_imagen_url: m.recompensa.item_imagen_url,
                recompensa_item_id: m.recompensa_item_id ?? null,
              }));
              return combinarMisiones(catalogoActual, progresoActualizado);
            });
          }),
        ]);

        setMisiones(combinarMisiones(catalogo, progresoRows));
      } catch (err) {
        console.error("[Misiones] Error inesperado:", err);
      } finally {
        setCargando(false);
      }
    }

    void cargarTodo();
  }, [combinarMisiones, ficha.id]);

  // ── Reclamar recompensa ───────────────────────────────────────────────
  const handleReclamarMision = async (mision: MisionConProgreso) => {
    setReclamandoId(mision.id);
    try {
      // El reclamo NUNCA se aplica de forma optimista: la suma de XP/monedas
      // solo la valida y ejecuta la función reclamar_mision en Supabase.
      // Sin conexión, esto devuelve ok:false con reason "offline" en vez de
      // fingir éxito — evitamos que el cliente decida cuánto XP otorgarse.
      const resultado = await reclamarMisionOffline(mision.id, ficha.id);

      if (resultado.ok) {
        setMisiones((prev) =>
          prev.map((m) => (m.id === mision.id ? { ...m, user_estado: "reclamada" } : m)),
        );
        setMisionModal(null);
        await invalidateSessionCache(`misiones_usuario:${ficha.id}`);
        // El XP/monedas/item se entregaron en el servidor — notificamos al
        // padre para que refresque la ficha (y su panel de stats).
        onFichaActualizada?.();
      } else if (resultado.reason === "offline") {
        setOffline(true);
        showAviso("Necesitas conexión a internet para reclamar la recompensa.");
      } else {
        console.warn("[Misiones] Error reclamando misión:", resultado.message);
        showAviso("No se pudo reclamar la recompensa. Intenta de nuevo.");
      }
    } finally {
      setReclamandoId(null);
    }
  };

  // Solo lo que la identidad ya aceptó: en curso o completada (lista para
  // reclamar). Lo reclamado ya no aporta nada nuevo, se deja de mostrar.
  const misionesAceptadas = misiones.filter(
    (m) => m.user_estado === "en_curso" || m.user_estado === "completada",
  );

  if (cargando) {
    return (
      <div className="flex items-center gap-2 py-3">
        <Loader2
          className="animate-spin"
          size={14}
          style={{ color: "color-mix(in srgb, var(--primary) 30%, transparent)" }}
        />
        <span
          className="text-micro font-black uppercase tracking-[0.2em]"
          style={{ color: "color-mix(in srgb, var(--primary) 30%, transparent)" }}
        >
          Cargando misiones…
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <AnimatePresence>
        {misionModal && (
          <ModalMision
            aceptando={false}
            mision={misionModal}
            reclamando={reclamandoId === misionModal.id}
            onClose={() => setMisionModal(null)}
            onReclamar={handleReclamarMision}
          />
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Scroll size={11} style={{ color: "color-mix(in srgb, var(--primary) 40%, transparent)" }} />
          <span
            className="text-micro font-black uppercase tracking-[0.22em]"
            style={{ color: "color-mix(in srgb, var(--primary) 40%, transparent)" }}
          >
            Misiones aceptadas
          </span>
        </div>
        {offline && (
          <div className="flex items-center gap-1 shrink-0">
            <WifiOff size={9} style={{ color: "#d97706" }} />
            <span className="text-micro font-black uppercase tracking-wider" style={{ color: "#d97706" }}>
              Sin conexión
            </span>
          </div>
        )}
      </div>

      {aviso && (
        <div
          className="px-2.5 py-1.5 text-micro font-bold"
          style={{
            borderRadius: "2px",
            border: "1px solid color-mix(in srgb, #d97706 30%, transparent)",
            background: "color-mix(in srgb, #d97706 8%, var(--white-custom))",
            color: "#d97706",
          }}
        >
          {aviso}
        </div>
      )}

      {misionesAceptadas.length === 0 ? (
        <div
          className="px-3 py-3 text-center"
          style={{
            borderRadius: "2px",
            border: "1px dashed color-mix(in srgb, var(--primary) 14%, transparent)",
          }}
        >
          <p
            className="text-micro font-bold"
            style={{ color: "color-mix(in srgb, var(--primary) 35%, transparent)" }}
          >
            Todavía no aceptaste ninguna misión.
          </p>
        </div>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {misionesAceptadas.map((mision) => {
            const IconoEstado = ICONO_ESTADO[mision.user_estado ?? "en_curso"] ?? Clock;
            const lista = mision.user_estado === "completada";
            return (
              <button
                key={mision.id}
                type="button"
                onClick={() => setMisionModal(mision)}
                className="shrink-0 flex flex-col gap-1.5 px-3 py-2.5 text-left transition-colors"
                style={{
                  width: 168,
                  borderRadius: "2px",
                  border: lista
                    ? "1px solid color-mix(in srgb, var(--primary) 30%, transparent)"
                    : "1px solid color-mix(in srgb, var(--primary) 10%, transparent)",
                  background: lista
                    ? "color-mix(in srgb, var(--primary) 5%, transparent)"
                    : "color-mix(in srgb, var(--primary) 2%, transparent)",
                }}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <EstrellasDificultad dificultad={mision.dificultad} />
                  <IconoEstado
                    size={11}
                    style={{
                      color: lista
                        ? "var(--primary)"
                        : "color-mix(in srgb, var(--primary) 40%, transparent)",
                    }}
                  />
                </div>
                <p
                  className="text-xs font-bold leading-tight line-clamp-2"
                  style={{ color: "var(--primary)" }}
                >
                  {mision.titulo}
                </p>
                <span
                  className="text-micro font-black uppercase tracking-wider"
                  style={{
                    color: lista
                      ? "var(--primary)"
                      : "color-mix(in srgb, var(--primary) 40%, transparent)",
                  }}
                >
                  {LABEL_ESTADO[mision.user_estado ?? "en_curso"]}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
