"use client";

/**
 * fichaComponents
 * ───────────────────────────────────────────────────────────────────────────
 * Componentes compartidos para crear/editar fichas de personaje jugable
 * (D&D-style). Extraídos de la antigua página /garlia/personal/identidades
 * para poder reutilizarlos como modal desde el dropdown de /garlia/aventura.
 */

import { AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Check,
  Heart,
  Loader2,
  Plus,
  Search,
  Shield,
  Sparkles,
  Swords,
  Trash2,
  X,
} from "lucide-react";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { MotionDiv } from "@/components/ui/Motion";

import {
  buscarCriaturas,
  buscarItems,
  caCalculadaDesdeInventario,
  DESCRIPCION_MAESTRIA_ARMA,
  MAESTRIAS_ARMA_DND,
  statEfectivo,
  statMod,
  STATS_DND,
  useClasesDisponibles,
  useInventarioFicha,
  useSubclasesDisponibles,
  useTrasfondosDisponibles,
  type EspecieResumen,
  type FichaDnd,
  type ItemResumen,
  type MaestriaArma,
  type NuevaFicha,
} from "../hooks/useFichasDnd";

export const STATS: {
  key: keyof Pick<
    FichaDnd,
    "fuerza" | "destreza" | "constitucion" | "inteligencia" | "sabiduria" | "carisma"
  >;
  label: string;
}[] = [
  { key: "fuerza", label: "FUE" },
  { key: "destreza", label: "DES" },
  { key: "constitucion", label: "CON" },
  { key: "inteligencia", label: "INT" },
  { key: "sabiduria", label: "SAB" },
  { key: "carisma", label: "CAR" },
];

export function fmtMod(score: number): string {
  const m = statMod(score);
  return m >= 0 ? `+${m}` : `${m}`;
}

// ── Modal crear ficha ────────────────────────────────────────────────────

export function ModalCrearFicha({
  onClose,
  onCrear,
}: {
  onClose: () => void;
  onCrear: (datos: NuevaFicha) => Promise<void>;
}) {
  const { clases, loading: cargandoClases } = useClasesDisponibles();
  const { trasfondos, loading: cargandoTrasfondos } = useTrasfondosDisponibles();
  const [nombre, setNombre] = useState("");
  const [especie, setEspecie] = useState<EspecieResumen | null>(null);
  const [clase, setClase] = useState("");
  const [subclase, setSubclase] = useState("");
  const claseElegidaId = clases.find((c) => c.nombre === clase)?.id ?? null;
  const { subclases, loading: cargandoSubclases } = useSubclasesDisponibles(claseElegidaId);
  const [trasfondoMecanico, setTrasfondoMecanico] = useState("");
  const [alineamiento, setAlineamiento] = useState("");
  const [nivel, setNivel] = useState(1);
  const [stats, setStats] = useState({
    fuerza: 10,
    destreza: 10,
    constitucion: 10,
    inteligencia: 10,
    sabiduria: 10,
    carisma: 10,
  });
  const [hpMax, setHpMax] = useState(10);
  const [ca, setCa] = useState(10);
  const [velocidad, setVelocidad] = useState(30);
  const [guardando, setGuardando] = useState(false);

  const handleCrear = async () => {
    if (!nombre.trim()) return;
    setGuardando(true);
    try {
      const claseElegida = clases.find((c) => c.nombre === clase);
      const subclaseElegida = subclases.find((s) => s.nombre === subclase);
      const trasfondoElegido = trasfondos.find((t) => t.nombre === trasfondoMecanico);
      await onCrear({
        nombre: nombre.trim(),
        especie_id: especie?.id ?? null,
        clase: clase.trim() || null,
        rasgo_clase: claseElegida?.descripcion?.trim() || null,
        salvaciones_competentes: claseElegida?.salvaciones_clase ?? [],
        subclase: subclase.trim() || null,
        rasgo_subclase: subclaseElegida?.descripcion?.trim() || null,
        trasfondo_mecanico: trasfondoMecanico.trim() || null,
        rasgo_trasfondo: trasfondoElegido?.descripcion?.trim() || null,
        alineamiento: alineamiento.trim() || null,
        nivel,
        ...stats,
        hp_max: hpMax,
        hp_actual: hpMax,
        ca,
        velocidad,
      });
    } finally {
      setGuardando(false);
    }
  };

  const inputClase =
    "h-10 px-3 rounded-lg border border-primary/10 bg-primary/[0.03] outline-none text-sm text-primary/80 placeholder:text-primary/30 focus:border-primary/30 transition-colors w-full min-w-0";

  return (
    <MotionDiv
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      exit={{ opacity: 0 }}
      initial={{ opacity: 0 }}
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <MotionDiv
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl p-6"
        exit={{ opacity: 0, scale: 0.96 }}
        initial={{ opacity: 0, scale: 0.96 }}
        style={{ background: "var(--white-custom)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors"
        >
          <X size={14} className="text-primary/60" />
        </button>

        <h2 className="font-serif italic text-xl text-primary mb-4">Nueva ficha</h2>

        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <input
              autoFocus
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre del personaje"
              className={`flex-[1.4] min-w-0 ${inputClase}`}
            />
            <div className="flex-1 min-w-0">
              <SelectorEntidad
                placeholder="Especie…"
                buscar={buscarCriaturas}
                seleccionActual={especie}
                onSeleccionar={(c) => setEspecie(c)}
                onQuitar={() => setEspecie(null)}
              />
            </div>
          </div>

          <select
            value={clase}
            onChange={(e) => {
              setClase(e.target.value);
              setSubclase("");
            }}
            disabled={cargandoClases}
            className={`w-full ${inputClase} ${!clase ? "text-primary/30" : ""}`}
          >
            <option value="">{cargandoClases ? "Cargando clases…" : "Clase…"}</option>
            {clases.map((c) => (
              <option key={c.id} value={c.nombre}>
                {c.nombre}
              </option>
            ))}
          </select>

          <div className="flex gap-2">
            <select
              value={subclase}
              onChange={(e) => setSubclase(e.target.value)}
              disabled={!claseElegidaId || cargandoSubclases}
              className={`flex-1 min-w-0 ${inputClase} ${!subclase ? "text-primary/30" : ""}`}
            >
              <option value="">
                {!claseElegidaId ? "Elegí una clase primero" : cargandoSubclases ? "Cargando subclases…" : "Subclase…"}
              </option>
              {subclases.map((s) => (
                <option key={s.id} value={s.nombre}>
                  {s.nombre}
                </option>
              ))}
            </select>
            <select
              value={trasfondoMecanico}
              onChange={(e) => setTrasfondoMecanico(e.target.value)}
              disabled={cargandoTrasfondos}
              className={`flex-1 min-w-0 ${inputClase} ${!trasfondoMecanico ? "text-primary/30" : ""}`}
            >
              <option value="">{cargandoTrasfondos ? "Cargando trasfondos…" : "Trasfondo…"}</option>
              {trasfondos.map((t) => (
                <option key={t.id} value={t.nombre}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={alineamiento}
              onChange={(e) => setAlineamiento(e.target.value)}
              placeholder="Alineamiento"
              className={`flex-1 min-w-0 ${inputClase}`}
            />
            <input
              type="text"
              inputMode="numeric"
              value={nivel}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9]/g, "");
                setNivel(v === "" ? 0 : Number(v));
              }}
              placeholder="Nivel"
              className={`w-20 shrink-0 text-center ${inputClase}`}
            />
          </div>

          <h3 className="text-micro font-black uppercase tracking-widest text-primary/40 mt-1">
            Estadísticas
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {STATS.map(({ key, label }) => (
              <div key={key} className="flex flex-col items-center gap-1 py-2 rounded-lg border border-primary/10 bg-primary/[0.02]">
                <span className="text-micro font-black uppercase tracking-widest text-primary/35">
                  {label}
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={stats[key]}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9]/g, "");
                    setStats((prev) => ({ ...prev, [key]: v === "" ? 0 : Number(v) }));
                  }}
                  className="w-12 text-center bg-transparent outline-none text-base font-black text-primary"
                />
              </div>
            ))}
          </div>

          <h3 className="text-micro font-black uppercase tracking-widest text-primary/40 mt-1">
            Vitales
          </h3>
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col items-center gap-1 py-2 rounded-lg border border-primary/10 bg-primary/[0.02]">
              <span className="text-micro font-black uppercase tracking-widest text-primary/35">HP</span>
              <input
                type="text"
                inputMode="numeric"
                value={hpMax}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9]/g, "");
                  setHpMax(v === "" ? 0 : Number(v));
                }}
                className="w-12 text-center bg-transparent outline-none text-base font-black text-primary"
              />
            </div>
            <div className="flex flex-col items-center gap-1 py-2 rounded-lg border border-primary/10 bg-primary/[0.02]">
              <span className="text-micro font-black uppercase tracking-widest text-primary/35">CA</span>
              <input
                type="text"
                inputMode="numeric"
                value={ca}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9]/g, "");
                  setCa(v === "" ? 0 : Number(v));
                }}
                className="w-12 text-center bg-transparent outline-none text-base font-black text-primary"
              />
            </div>
            <div className="flex flex-col items-center gap-1 py-2 rounded-lg border border-primary/10 bg-primary/[0.02]">
              <span className="text-micro font-black uppercase tracking-widest text-primary/35">Vel.</span>
              <input
                type="text"
                inputMode="numeric"
                value={velocidad}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9]/g, "");
                  setVelocidad(v === "" ? 0 : Number(v));
                }}
                className="w-12 text-center bg-transparent outline-none text-base font-black text-primary"
              />
            </div>
          </div>

          <button
            type="button"
            disabled={!nombre.trim() || guardando}
            onClick={handleCrear}
            className="h-10 flex items-center justify-center gap-1.5 rounded-lg bg-primary text-white text-sm font-bold disabled:opacity-40 transition-opacity mt-1"
          >
            {guardando ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Crear ficha
          </button>
          <p className="text-micro text-primary/30 text-center">
            Podrás editar todo esto y el inventario después.
          </p>
        </div>
      </MotionDiv>
    </MotionDiv>
  );
}

// ── Detalle / edición de una ficha ───────────────────────────────────────

export function FichaDetalle({
  ficha,
  esActiva,
  onVolver,
  onActualizar,
  onEliminar,
  onElegirActiva,
  variant = "page",
}: {
  ficha: FichaDnd;
  esActiva: boolean;
  onVolver: () => void;
  onActualizar: (id: string, cambios: Partial<FichaDnd>) => Promise<void>;
  onEliminar: (id: string) => Promise<void>;
  onElegirActiva: (id: string) => Promise<void>;
  /** "page" = uso standalone en una página propia. "modal" = dentro de un overlay (sin min-height de pantalla completa, botón "Cerrar"). */
  variant?: "page" | "modal";
}) {
  const { items, agregar, quitar, toggleEquipado } = useInventarioFicha(ficha.id);
  const { clases } = useClasesDisponibles();
  const { trasfondos } = useTrasfondosDisponibles();
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState<Partial<FichaDnd>>(ficha);
  const [guardando, setGuardando] = useState(false);
  const claseElegidaId = clases.find((c) => c.nombre === (borrador.clase as string))?.id ?? null;
  const { subclases } = useSubclasesDisponibles(claseElegidaId);
  const caCalculada = caCalculadaDesdeInventario(items, statMod(statEfectivo(ficha, "destreza")));

  const guardar = async () => {
    setGuardando(true);
    try {
      const { especie, ...cambiosPersistibles } = borrador;
      await onActualizar(ficha.id, cambiosPersistibles);
      setEditando(false);
    } finally {
      setGuardando(false);
    }
  };

  const campo = (key: keyof FichaDnd, placeholder: string, tipo: "text" | "number" = "text") => (
    <input
      type="text"
      inputMode={tipo === "number" ? "numeric" : undefined}
      value={(borrador[key] as any) ?? ""}
      onChange={(e) => {
        if (tipo === "number") {
          const v = e.target.value.replace(/[^0-9]/g, "");
          setBorrador((prev) => ({ ...prev, [key]: v === "" ? 0 : Number(v) }));
        } else {
          setBorrador((prev) => ({ ...prev, [key]: e.target.value }));
        }
      }}
      placeholder={placeholder}
      className="h-9 px-2.5 rounded-lg border border-primary/10 bg-primary/[0.03] outline-none text-xs text-primary/80 placeholder:text-primary/30 focus:border-primary/30 transition-colors w-full"
    />
  );

  return (
    <div
      className={
        variant === "modal"
          ? "flex flex-col gap-6"
          : "flex flex-col p-4 md:p-8 gap-6 max-w-2xl mx-auto"
      }
      style={variant === "page" ? { minHeight: "calc(100svh - 64px)" } : undefined}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onVolver}
          className="flex items-center gap-1.5 text-xs font-bold text-primary/40 hover:text-primary/70 transition-colors"
        >
          <ArrowLeft size={14} />
          {variant === "modal" ? "Cerrar" : "Mis fichas"}
        </button>
        <div className="flex-1" />
        {!esActiva && (
          <button
            type="button"
            onClick={() => onElegirActiva(ficha.id)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary/10 text-primary text-micro font-bold uppercase tracking-wide hover:bg-primary/15 transition-colors"
          >
            <Check size={12} /> Usar esta ficha
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            if (confirm(`¿Eliminar a ${ficha.nombre}? Esto no se puede deshacer.`)) {
              onEliminar(ficha.id);
            }
          }}
          className="p-2 rounded-lg text-primary/30 hover:bg-red-500/10 hover:text-red-500 transition-colors"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="flex items-start gap-4">
        <div className="w-20 h-20 shrink-0 rounded-2xl overflow-hidden bg-primary/5 relative">
          {ficha.imagen_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ficha.imagen_url} alt={ficha.nombre} className="w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Swords size={22} className="text-primary/15" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          {editando ? (
            <div className="flex gap-2">
              <div className="flex-[1.4] min-w-0">{campo("nombre", "Nombre")}</div>
              <div className="flex-1 min-w-0">
                <SelectorEntidad
                  placeholder="Especie…"
                  buscar={buscarCriaturas}
                  seleccionActual={borrador.especie_id ? borrador.especie ?? ficha.especie ?? null : null}
                  onSeleccionar={(c) => setBorrador((prev) => ({ ...prev, especie_id: c.id, especie: c }))}
                  onQuitar={() => setBorrador((prev) => ({ ...prev, especie_id: null, especie: null }))}
                />
              </div>
            </div>
          ) : (
            <h1 className="font-serif italic text-2xl text-primary">{ficha.nombre}</h1>
          )}
          <span className="text-xs font-bold uppercase tracking-wide text-primary/40">
            {[ficha.especie?.nombre, [ficha.clase, ficha.subclase].filter(Boolean).join(" — "), `Nivel ${ficha.nivel}`].filter(Boolean).join(" · ")}
          </span>
          {esActiva && (
            <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary text-white text-micro font-black uppercase">
              <Check size={9} /> Activa ahora
            </div>
          )}
        </div>
      </div>

      {/* ── Vitales ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <VitalCard icon={<Heart size={14} />} label="HP" value={`${ficha.hp_actual}/${ficha.hp_max}`} />
        <VitalCard
          icon={<Shield size={14} />}
          label="CA"
          value={String(ficha.ca)}
          referencia={
            caCalculada !== ficha.ca ? `Calculada: ${caCalculada}` : undefined
          }
        />
        <VitalCard icon={<Sparkles size={14} />} label="Velocidad" value={`${ficha.velocidad} ft`} />
      </div>

      {/* ── Stats ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {STATS.map(({ key, label }) => {
          const bono = ficha.mejora_trasfondo?.[key] ?? 0;
          const efectivo = statEfectivo(ficha, key);
          return (
            <div
              key={key}
              className="flex flex-col items-center justify-center gap-0.5 py-3 rounded-xl border border-primary/10 bg-primary/[0.02]"
            >
              <span className="text-micro font-black uppercase tracking-widest text-primary/35">
                {label}
              </span>
              {editando ? (
                <input
                  type="text"
                  inputMode="numeric"
                  value={(borrador[key] as number) ?? 10}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9]/g, "");
                    setBorrador((prev) => ({ ...prev, [key]: v === "" ? 0 : Number(v) }));
                  }}
                  className="w-12 text-center bg-transparent outline-none text-lg font-black text-primary"
                />
              ) : (
                <span className="text-lg font-black text-primary">
                  {efectivo}
                  {bono > 0 && <span className="text-micro text-emerald-500 font-bold"> +{bono}</span>}
                </span>
              )}
              <span className="text-micro text-primary/30">{fmtMod(efectivo)}</span>
            </div>
          );
        })}
      </div>

      {/* ── Mejora de característica del trasfondo (PHB 2024) ──────────── */}
      {editando && (
        <MejoraTrasfondoSelector
          caracteristicas={
            trasfondos.find((t) => t.nombre === (borrador.trasfondo_mecanico as string))
              ?.caracteristicas_trasfondo ?? null
          }
          valor={(borrador.mejora_trasfondo as FichaDnd["mejora_trasfondo"]) ?? {}}
          onCambiar={(mejora) => setBorrador((prev) => ({ ...prev, mejora_trasfondo: mejora }))}
        />
      )}

      {/* ── Edición de datos base ───────────────────────────────────── */}
      {editando && (
        <div className="grid grid-cols-2 gap-2">
          <select
            value={(borrador.clase as string) ?? ""}
            onChange={(e) => {
              const nombreElegido = e.target.value;
              const elegido = clases.find((c) => c.nombre === nombreElegido);
              setBorrador((prev) => ({
                ...prev,
                clase: nombreElegido,
                rasgo_clase: elegido?.descripcion?.trim() || null,
                subclase: null,
                rasgo_subclase: null,
              }));
            }}
            className="h-9 px-2.5 rounded-lg border border-primary/10 bg-primary/[0.03] outline-none text-xs text-primary/80 focus:border-primary/30 transition-colors w-full"
          >
            <option value="">Clase…</option>
            {clases.map((c) => (
              <option key={c.id} value={c.nombre}>
                {c.nombre}
              </option>
            ))}
          </select>
          <select
            value={(borrador.subclase as string) ?? ""}
            onChange={(e) => {
              const nombreElegido = e.target.value;
              const elegido = subclases.find((s) => s.nombre === nombreElegido);
              setBorrador((prev) => ({
                ...prev,
                subclase: nombreElegido,
                rasgo_subclase: elegido?.descripcion?.trim() || null,
              }));
            }}
            disabled={!claseElegidaId}
            className="h-9 px-2.5 rounded-lg border border-primary/10 bg-primary/[0.03] outline-none text-xs text-primary/80 focus:border-primary/30 transition-colors w-full"
          >
            <option value="">{!claseElegidaId ? "Elegí una clase primero" : "Subclase…"}</option>
            {subclases.map((s) => (
              <option key={s.id} value={s.nombre}>
                {s.nombre}
              </option>
            ))}
          </select>
          <select
            value={(borrador.trasfondo_mecanico as string) ?? ""}
            onChange={(e) => {
              const nombreElegido = e.target.value;
              const elegido = trasfondos.find((t) => t.nombre === nombreElegido);
              setBorrador((prev) => ({
                ...prev,
                trasfondo_mecanico: nombreElegido,
                rasgo_trasfondo: elegido?.descripcion?.trim() || null,
              }));
            }}
            className="h-9 px-2.5 rounded-lg border border-primary/10 bg-primary/[0.03] outline-none text-xs text-primary/80 focus:border-primary/30 transition-colors w-full"
          >
            <option value="">Trasfondo…</option>
            {trasfondos.map((t) => (
              <option key={t.id} value={t.nombre}>
                {t.nombre}
              </option>
            ))}
          </select>
          {campo("nivel", "Nivel", "number")}
          {campo("alineamiento", "Alineamiento")}
          {campo("hp_max", "HP máximo", "number")}
          {campo("hp_actual", "HP actual", "number")}
          {campo("ca", "Clase de armadura", "number")}
          {campo("velocidad", "Velocidad", "number")}
          {campo("imagen_url", "URL de imagen")}
        </div>
      )}

      {/* ── Características de especie ──────────────────────────────── */}
      {ficha.especie?.descripcion_dnd && (
        <div className="p-3 rounded-lg border border-primary/10 bg-primary/[0.02]">
          <span className="text-micro font-black uppercase tracking-widest text-primary/35">
            Rasgos de {ficha.especie.nombre}
          </span>
          <p className="mt-1 text-xs text-primary/60 whitespace-pre-wrap leading-relaxed">
            {ficha.especie.descripcion_dnd}
          </p>
        </div>
      )}

      {/* ── Rasgos de clase / subclase ──────────────────────────────── */}
      {(ficha.rasgo_clase || ficha.rasgo_subclase) && (
        <div className="flex flex-col gap-2">
          {ficha.rasgo_clase && (
            <div className="p-3 rounded-lg border border-primary/10 bg-primary/[0.02]">
              <span className="text-micro font-black uppercase tracking-widest text-primary/35">
                Rasgo de {ficha.clase ?? "clase"}
              </span>
              <p className="mt-1 text-xs text-primary/60 whitespace-pre-wrap leading-relaxed">
                {ficha.rasgo_clase}
              </p>
            </div>
          )}
          {ficha.rasgo_subclase && (
            <div className="p-3 rounded-lg border border-primary/10 bg-primary/[0.02]">
              <span className="text-micro font-black uppercase tracking-widest text-primary/35">
                Rasgo de {ficha.subclase ?? "subclase"}
              </span>
              <p className="mt-1 text-xs text-primary/60 whitespace-pre-wrap leading-relaxed">
                {ficha.rasgo_subclase}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Trasfondo / notas ────────────────────────────────────────── */}
      <div>
        <h3 className="text-xs font-black uppercase tracking-widest text-primary/50 mb-2">
          Trasfondo
        </h3>
        {editando ? (
          <textarea
            value={borrador.trasfondo ?? ""}
            onChange={(e) => setBorrador((prev) => ({ ...prev, trasfondo: e.target.value }))}
            placeholder="Historia, personalidad, motivaciones…"
            rows={4}
            className="w-full p-3 rounded-lg border border-primary/10 bg-primary/[0.03] outline-none text-sm text-primary/80 placeholder:text-primary/30 focus:border-primary/30 transition-colors resize-none"
          />
        ) : (
          <p className="text-sm text-primary/60 whitespace-pre-wrap leading-relaxed">
            {ficha.trasfondo || <span className="text-primary/30 italic">Sin trasfondo todavía.</span>}
          </p>
        )}
        {ficha.rasgo_trasfondo && (
          <div className="mt-3 p-3 rounded-lg border border-primary/10 bg-primary/[0.02]">
            <span className="text-micro font-black uppercase tracking-widest text-primary/35">
              Rasgo de {ficha.trasfondo_mecanico ?? "trasfondo"}
            </span>
            <p className="mt-1 text-xs text-primary/60 whitespace-pre-wrap leading-relaxed">
              {ficha.rasgo_trasfondo}
            </p>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => (editando ? guardar() : setEditando(true))}
        disabled={guardando}
        className="h-10 rounded-lg bg-primary text-white text-sm font-bold disabled:opacity-40 transition-opacity"
      >
        {guardando ? <Loader2 size={14} className="animate-spin mx-auto" /> : editando ? "Guardar cambios" : "Editar ficha"}
      </button>

      {/* ── Inventario ───────────────────────────────────────────────── */}
      <div>
        <h3 className="text-xs font-black uppercase tracking-widest text-primary/50 mb-2">
          Inventario
        </h3>
        <div className="mb-3">
          <SelectorEntidad
            placeholder="Buscar objeto del mundo para añadir…"
            buscar={buscarItems}
            onSeleccionar={(item) => agregar(item.id)}
          />
        </div>

        {items.length === 0 ? (
          <p className="text-xs text-primary/30 italic">Sin objetos todavía.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {items.map((item) => (
              <div
                key={item.id}
                className="group flex items-center gap-2 px-3 py-2 rounded-lg border border-primary/10 bg-primary/[0.02]"
              >
                <div className="w-6 h-6 shrink-0 rounded overflow-hidden bg-primary/5">
                  {item.item?.imagen_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.item.imagen_url} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => toggleEquipado(item)}
                  className={`shrink-0 text-micro font-black uppercase tracking-wide px-1.5 py-0.5 rounded ${
                    item.equipado ? "bg-primary/15 text-primary" : "text-primary/25"
                  }`}
                >
                  {item.equipado ? "Equipado" : "Equipar"}
                </button>
                <span className="flex-1 text-xs text-primary/70 truncate">
                  {item.item?.nombre ?? "(objeto eliminado)"}
                </span>
                {item.item?.es_arma && item.equipado && (
                  <MaestriaArmaSelector
                    valor={(ficha.maestrias_armas?.[item.id] as MaestriaArma | undefined) ?? null}
                    editable={editando}
                    onCambiar={(maestria) => {
                      const actualizado = { ...(borrador.maestrias_armas ?? ficha.maestrias_armas ?? {}) };
                      if (maestria) actualizado[item.id] = maestria;
                      else delete actualizado[item.id];
                      setBorrador((prev) => ({ ...prev, maestrias_armas: actualizado }));
                      // Persiste directo: la maestría no depende del resto del
                      // formulario de edición, así el jugador la puede cambiar
                      // aunque no esté en modo "Editar ficha".
                      if (!editando) onActualizar(ficha.id, { maestrias_armas: actualizado });
                    }}
                  />
                )}
                {item.cantidad > 1 && (
                  <span className="text-micro text-primary/35">×{item.cantidad}</span>
                )}
                <button
                  type="button"
                  onClick={() => quitar(item.id)}
                  className="shrink-0 p-1 rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-500 text-primary/30 transition-all"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Badge/selector de la Maestría de Arma (PHB 2024) activa en un arma
 *  equipada. Fuera de edición muestra un badge con tooltip nativo (title);
 *  en edición se convierte en un <select> chico para elegir/cambiar. */
function MaestriaArmaSelector({
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
        className="shrink-0 h-6 px-1 rounded border border-primary/10 bg-primary/[0.03] outline-none text-micro text-primary/70"
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
      className="shrink-0 text-micro font-black uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600"
    >
      {valor}
    </span>
  );
}

/** Selector de la mejora de característica del trasfondo (PHB 2024): el
 *  jugador reparte +2/+1 entre dos de las 3 stats que el trasfondo habilita,
 *  o +1/+1/+1 a las tres. Si el trasfondo elegido no tiene
 *  caracteristicas_trasfondo cargado (mundo homebrew sin ese dato todavía),
 *  no se muestra nada — no hay entre qué elegir. */
function MejoraTrasfondoSelector({
  caracteristicas,
  valor,
  onCambiar,
}: {
  caracteristicas: string[] | null;
  valor: Partial<Record<(typeof STATS_DND)[number], number>>;
  onCambiar: (mejora: Partial<Record<(typeof STATS_DND)[number], number>>) => void;
}) {
  if (!caracteristicas || caracteristicas.length === 0) return null;

  const puntosUsados = Object.values(valor).reduce((acc, v) => acc + (v ?? 0), 0);
  const puntosMax = 3; // +2/+1 o +1/+1/+1: siempre 3 puntos en total (PHB 2024).

  const setPunto = (stat: string, delta: number) => {
    const actual = valor[stat as (typeof STATS_DND)[number]] ?? 0;
    const nuevo = actual + delta;
    // Tope por stat: máximo 2 (el patrón +2/+1 no permite +3 en una sola).
    if (nuevo < 0 || nuevo > 2) return;
    if (delta > 0 && puntosUsados >= puntosMax) return;
    const actualizado = { ...valor, [stat]: nuevo };
    if (nuevo === 0) delete actualizado[stat as (typeof STATS_DND)[number]];
    onCambiar(actualizado);
  };

  return (
    <div className="p-3 rounded-lg border border-primary/10 bg-primary/[0.02]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-micro font-black uppercase tracking-widest text-primary/35">
          Mejora de característica (trasfondo)
        </span>
        <span className="text-micro text-primary/30">
          {puntosUsados}/{puntosMax} puntos
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {caracteristicas.map((stat) => {
          const bono = valor[stat as (typeof STATS_DND)[number]] ?? 0;
          const label = STATS.find((s) => s.key === stat)?.label ?? stat.slice(0, 3).toUpperCase();
          return (
            <div
              key={stat}
              className="flex items-center gap-1.5 h-8 px-2 rounded-lg border border-primary/10 bg-primary/[0.03]"
            >
              <span className="text-micro font-bold uppercase tracking-wide text-primary/50">
                {label}
              </span>
              <button
                type="button"
                onClick={() => setPunto(stat, -1)}
                disabled={bono <= 0}
                className="w-5 h-5 rounded-full text-primary/40 hover:bg-primary/10 disabled:opacity-20 transition-colors"
              >
                −
              </button>
              <span className="w-4 text-center text-xs font-black text-primary">+{bono}</span>
              <button
                type="button"
                onClick={() => setPunto(stat, 1)}
                disabled={bono >= 2 || puntosUsados >= puntosMax}
                className="w-5 h-5 rounded-full text-primary/40 hover:bg-primary/10 disabled:opacity-20 transition-colors"
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

function VitalCard({
  icon,
  label,
  value,
  referencia,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  /** Texto chico opcional debajo del valor, ej. la CA calculada por armadura
   *  cuando difiere de la CA guardada a mano en la ficha. */
  referencia?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-3 rounded-xl border border-primary/10 bg-primary/[0.02]">
      <div className="text-primary/40">{icon}</div>
      <span className="text-base font-black text-primary">{value}</span>
      <span className="text-micro font-bold uppercase tracking-widest text-primary/35">{label}</span>
      {referencia && (
        <span className="text-micro text-primary/30">{referencia}</span>
      )}
    </div>
  );
}

// ── Selector genérico con búsqueda (especie / item) ──────────────────────

interface EntidadOpcion {
  id: string;
  nombre: string;
  imagen_url: string | null;
}

export function SelectorEntidad<T extends EntidadOpcion>({
  placeholder,
  buscar,
  onSeleccionar,
  seleccionActual,
  onQuitar,
  variante = "caja",
}: {
  placeholder: string;
  buscar: (q: string) => Promise<T[]>;
  onSeleccionar: (item: T) => void;
  seleccionActual?: EntidadOpcion | null;
  onQuitar?: () => void;
  /** "caja": look por defecto (borde, fondo, h-10). "plano": mismo look que
   *  los <select> de texto de Clase/Subclase/Trasfondo — sin borde ni fondo,
   *  solo se activa el buscador real al hacer click. */
  variante?: "caja" | "plano";
}) {
  const [query, setQuery] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [resultados, setResultados] = useState<T[]>([]);
  const [buscando, setBuscando] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const anclaRef = useRef<HTMLDivElement | null>(null);
  const [posicion, setPosicion] = useState<{ top: number; left: number; width: number } | null>(
    null,
  );

  useEffect(() => {
    if (!abierto) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setBuscando(true);
    debounceRef.current = setTimeout(async () => {
      const r = await buscar(query);
      setResultados(r);
      setBuscando(false);
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, abierto]);

  // ── Posicionamiento del dropdown ──────────────────────────────────────
  // El selector suele vivir dentro de contenedores con overflow:hidden u
  // overflow-y:auto (panel del DM, tarjetas del pizarrón, feed de aventura),
  // que recortan cualquier <div absolute> que se salga de sus límites. Para
  // que la lista de opciones siempre se vea completa, se renderiza en un
  // portal a document.body y se posiciona "a mano" siguiendo al input.
  useLayoutEffect(() => {
    if (!abierto) return;
    const calcular = () => {
      const rect = anclaRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPosicion({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    };
    calcular();
    window.addEventListener("scroll", calcular, true);
    window.addEventListener("resize", calcular);
    return () => {
      window.removeEventListener("scroll", calcular, true);
      window.removeEventListener("resize", calcular);
    };
  }, [abierto]);

  if (seleccionActual && !abierto) {
    if (variante === "plano") {
      return (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="w-full min-w-0 flex items-center justify-between gap-1.5 text-left group"
        >
          <span className="text-sm font-semibold truncate" style={{ color: "var(--primary)" }}>
            {seleccionActual.nombre}
          </span>
          {onQuitar && (
            <span
              role="button"
              onClick={(e) => {
                e.stopPropagation();
                onQuitar();
              }}
              className="shrink-0 opacity-0 group-hover:opacity-100 p-0.5 rounded-full hover:bg-red-500/10 hover:text-red-500 text-primary/30 transition-opacity"
            >
              <X size={11} />
            </span>
          )}
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="w-full min-w-0 flex items-center gap-2.5 h-10 px-2.5 rounded-lg border border-primary/10 bg-primary/[0.03] hover:border-primary/25 transition-colors text-left"
      >
        <div className="w-6 h-6 shrink-0 rounded overflow-hidden bg-primary/5">
          {seleccionActual.imagen_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={seleccionActual.imagen_url} alt="" className="w-full h-full object-cover" />
          )}
        </div>
        <span className="flex-1 text-xs text-primary/80 truncate">{seleccionActual.nombre}</span>
        {onQuitar && (
          <span
            role="button"
            onClick={(e) => {
              e.stopPropagation();
              onQuitar();
            }}
            className="shrink-0 p-1 rounded-full hover:bg-red-500/10 hover:text-red-500 text-primary/30 transition-colors"
          >
            <X size={11} />
          </span>
        )}
      </button>
    );
  }

  return (
    <div ref={anclaRef} className="relative w-full min-w-0">
      <div
        className={
          variante === "plano"
            ? "flex items-center gap-1.5 w-full"
            : "flex items-center gap-2 px-2.5 h-10 rounded-lg border border-primary/10 bg-primary/[0.03] focus-within:border-primary/30 transition-colors"
        }
      >
        {variante !== "plano" && <Search size={12} className="text-primary/35 shrink-0" />}
        <input
          autoFocus={abierto}
          type="text"
          value={query}
          onFocus={() => setAbierto(true)}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className={
            variante === "plano"
              ? "flex-1 bg-transparent outline-none text-sm font-semibold placeholder:text-primary/30"
              : "flex-1 bg-transparent outline-none text-xs text-primary/80 placeholder:text-primary/30"
          }
          style={variante === "plano" ? { color: "var(--primary)" } : undefined}
        />
        {buscando && <Loader2 size={11} className="animate-spin text-primary/30" />}
      </div>

      {abierto &&
        posicion &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[70]" onClick={() => setAbierto(false)} />
            <div
              className="fixed z-[71] max-h-56 overflow-y-auto rounded-xl border border-primary/10 bg-[var(--white-custom)] shadow-lg"
              style={{ top: posicion.top, left: posicion.left, width: posicion.width }}
            >
              {resultados.length === 0 && !buscando ? (
                <div className="px-3 py-3 text-micro text-primary/30 text-center">
                  Sin resultados.
                </div>
              ) : (
                resultados.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      onSeleccionar(r);
                      setAbierto(false);
                      setQuery("");
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-primary/5 transition-colors"
                  >
                    <div className="w-7 h-7 shrink-0 rounded-md overflow-hidden bg-primary/5">
                      {r.imagen_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.imagen_url} alt="" className="w-full h-full object-cover" />
                      )}
                    </div>
                    <span className="text-xs text-primary/80 truncate">{r.nombre}</span>
                  </button>
                ))
              )}
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}
