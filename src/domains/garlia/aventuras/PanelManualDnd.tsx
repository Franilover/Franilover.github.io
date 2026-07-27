"use client";

/**
 * PanelManualDnd
 * ───────────────────────────────────────────────────────────────────────────
 * Sub-panel "Manual" dentro de AventuraSection (junto a Aventuras, Relaciones
 * y Monedas). Muestra en solo-lectura los tres catálogos de reglas D&D que
 * alimentan el creador de fichas:
 *
 *   - Dotes      → tabla dotes_dnd (catálogo fijo de reglas, no un grupo del
 *                   mundo — origen / general / épica).
 *   - Clases     → grupos_mundo (tipo="personajes", subtipo="Clase").
 *   - Trasfondos → grupos_mundo (tipo="personajes", subtipo="Trasfondo"),
 *                   incluye la Dote de Origen que otorga cada uno.
 *
 * Es una vista de referencia rápida para el DM mientras arma su mundo — para
 * editar contenido, sigue yendo al editor de Grupos (Clases/Trasfondos) o
 * directo a Supabase (Dotes, por ahora sin UI de edición propia).
 */

import { BookOpen, Compass, Loader2, Scroll, Search, Sparkles, Users, X } from "lucide-react";
import React, { useMemo, useState } from "react";

import {
  useClasesDisponibles,
  useDotesDisponibles,
  useTrasfondosDisponibles,
  type DoteDnd,
} from "@/domains/garlia/aventuras/public/useFichasDnd";

type SubTab = "dotes" | "clases" | "trasfondos";

const SUB_TABS: { key: SubTab; label: string; Icon: React.ElementType }[] = [
  { key: "dotes", label: "Dotes", Icon: Sparkles },
  { key: "clases", label: "Clases", Icon: Compass },
  { key: "trasfondos", label: "Trasfondos", Icon: Scroll },
];

const CATEGORIA_LABEL: Record<DoteDnd["categoria"], string> = {
  origen: "Origen",
  general: "General",
  epica: "Épica",
};

const CATEGORIA_COLOR: Record<DoteDnd["categoria"], string> = {
  origen: "#4ade80",
  general: "var(--primary)",
  epica: "#a78bfa",
};

export function PanelManualDnd() {
  const [tab, setTab] = useState<SubTab>("dotes");
  const [busqueda, setBusqueda] = useState("");

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* ── Sub-tabs internas: Dotes / Clases / Trasfondos ────────────── */}
      <div className="shrink-0 flex items-center gap-1 px-4 pt-3 pb-2">
        {SUB_TABS.map(({ key, label, Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                active
                  ? "bg-primary/10 text-primary"
                  : "text-primary/50 hover:bg-primary/5 hover:text-primary/80"
              }`}
            >
              <Icon size={12} />
              {label}
            </button>
          );
        })}
      </div>

      {/* ── Buscador ─────────────────────────────────────────────────── */}
      <div className="shrink-0 px-4 pb-2.5">
        <div
          className="flex items-center gap-2 px-3 rounded-lg border border-primary/10 bg-primary/[0.03] focus-within:border-primary/30 transition-colors"
          style={{ height: "34px" }}
        >
          <Search size={13} className="text-primary/35 shrink-0" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder={`Buscar en ${SUB_TABS.find((t) => t.key === tab)?.label.toLowerCase()}…`}
            className="flex-1 bg-transparent outline-none text-xs text-primary/80 placeholder:text-primary/30"
          />
          {busqueda && (
            <button type="button" onClick={() => setBusqueda("")}>
              <X size={12} className="text-primary/40" />
            </button>
          )}
        </div>
      </div>

      {/* ── Contenido ────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
        {tab === "dotes" && <ListaDotes busqueda={busqueda} />}
        {tab === "clases" && <ListaClases busqueda={busqueda} />}
        {tab === "trasfondos" && <ListaTrasfondos busqueda={busqueda} />}
      </div>
    </div>
  );
}

function EstadoVacio({ texto }: { texto: string }) {
  return (
    <div className="py-16 flex flex-col items-center gap-2 text-center">
      <BookOpen className="text-primary/15" size={22} strokeWidth={1} />
      <p className="text-micro font-black uppercase tracking-widest text-primary/25">{texto}</p>
    </div>
  );
}

function EstadoCargando() {
  return (
    <div className="py-16 flex items-center justify-center text-primary/30">
      <Loader2 className="animate-spin" size={18} />
    </div>
  );
}

// ─── Dotes (tabla dotes_dnd) ────────────────────────────────────────────────

function ListaDotes({ busqueda }: { busqueda: string }) {
  const { dotes, loading } = useDotesDisponibles();

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return dotes;
    return dotes.filter(
      (d) =>
        d.nombre.toLowerCase().includes(q) ||
        d.descripcion?.toLowerCase().includes(q),
    );
  }, [dotes, busqueda]);

  const porCategoria = useMemo(() => {
    const map: Record<DoteDnd["categoria"], DoteDnd[]> = { origen: [], general: [], epica: [] };
    for (const d of filtradas) map[d.categoria].push(d);
    return map;
  }, [filtradas]);

  if (loading) return <EstadoCargando />;
  if (dotes.length === 0) return <EstadoVacio texto="Sin dotes cargadas aún" />;
  if (filtradas.length === 0) return <EstadoVacio texto="Sin resultados" />;

  return (
    <div className="flex flex-col gap-4">
      {(["origen", "general", "epica"] as const).map((cat) =>
        porCategoria[cat].length === 0 ? null : (
          <div key={cat}>
            <div className="flex items-center gap-1.5 mb-1.5 px-0.5">
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: CATEGORIA_COLOR[cat] }}
              />
              <span className="text-micro font-black uppercase tracking-[0.25em] text-primary/40">
                {CATEGORIA_LABEL[cat]}
              </span>
              <span className="text-micro text-primary/25 tabular-nums">
                {porCategoria[cat].length}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {porCategoria[cat].map((d) => (
                <div
                  key={d.id}
                  className="px-3 py-2 rounded-lg border border-primary/10 bg-primary/[0.02]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-primary/80">{d.nombre}</span>
                    {d.prerequisito && (
                      <span className="shrink-0 text-micro font-bold text-primary/30 whitespace-nowrap">
                        {d.prerequisito}
                      </span>
                    )}
                  </div>
                  {d.descripcion && (
                    <p className="mt-0.5 text-micro text-primary/45 leading-relaxed">
                      {d.descripcion}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ),
      )}
    </div>
  );
}

// ─── Clases (grupos_mundo, subtipo="Clase") ────────────────────────────────

function ListaClases({ busqueda }: { busqueda: string }) {
  const { clases, loading } = useClasesDisponibles();

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return clases;
    return clases.filter(
      (c) =>
        c.nombre.toLowerCase().includes(q) ||
        c.descripcion?.toLowerCase().includes(q),
    );
  }, [clases, busqueda]);

  if (loading) return <EstadoCargando />;
  if (clases.length === 0)
    return <EstadoVacio texto="Sin clases cargadas — crealas en Grupos" />;
  if (filtradas.length === 0) return <EstadoVacio texto="Sin resultados" />;

  return (
    <div className="flex flex-col gap-2">
      {filtradas.map((c) => (
        <div key={c.id} className="px-3 py-2.5 rounded-lg border border-primary/10 bg-primary/[0.02]">
          <div className="flex items-center gap-1.5">
            <Compass size={11} className="text-primary/35 shrink-0" />
            <span className="text-xs font-semibold text-primary/80">{c.nombre}</span>
          </div>
          {c.descripcion ? (
            <p className="mt-1 text-micro text-primary/45 leading-relaxed whitespace-pre-wrap">
              {c.descripcion}
            </p>
          ) : (
            <p className="mt-1 text-micro text-primary/25 italic">Sin descripción aún.</p>
          )}
          {c.salvaciones_clase && c.salvaciones_clase.length > 0 && (
            <p className="mt-1.5 text-micro text-primary/50">
              <span className="font-black uppercase tracking-wide text-primary/35">Salvaciones: </span>
              {c.salvaciones_clase.join(", ")}
            </p>
          )}
          {c.habilidades_a_elegir != null && (c.habilidades_disponibles?.length ?? 0) > 0 && (
            <p className="mt-0.5 text-micro text-primary/50">
              <span className="font-black uppercase tracking-wide text-primary/35">Habilidades: </span>
              elegí {c.habilidades_a_elegir} de {c.habilidades_disponibles!.length}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Trasfondos (grupos_mundo, subtipo="Trasfondo") ────────────────────────

function ListaTrasfondos({ busqueda }: { busqueda: string }) {
  const { trasfondos, loading } = useTrasfondosDisponibles();

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return trasfondos;
    return trasfondos.filter(
      (t) =>
        t.nombre.toLowerCase().includes(q) ||
        t.descripcion?.toLowerCase().includes(q),
    );
  }, [trasfondos, busqueda]);

  if (loading) return <EstadoCargando />;
  if (trasfondos.length === 0)
    return <EstadoVacio texto="Sin trasfondos cargados — crealos en Grupos" />;
  if (filtrados.length === 0) return <EstadoVacio texto="Sin resultados" />;

  return (
    <div className="flex flex-col gap-2">
      {filtrados.map((t) => (
        <div key={t.id} className="px-3 py-2.5 rounded-lg border border-primary/10 bg-primary/[0.02]">
          <div className="flex items-center gap-1.5">
            <Users size={11} className="text-primary/35 shrink-0" />
            <span className="text-xs font-semibold text-primary/80">{t.nombre}</span>
          </div>
          {t.descripcion ? (
            <p className="mt-1 text-micro text-primary/45 leading-relaxed whitespace-pre-wrap">
              {t.descripcion}
            </p>
          ) : (
            <p className="mt-1 text-micro text-primary/25 italic">Sin descripción aún.</p>
          )}
          {t.dote_origen && (
            <div className="mt-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-micro font-semibold"
              style={{
                background: "color-mix(in srgb, #4ade80 10%, transparent)",
                color: "color-mix(in srgb, #4ade80 55%, transparent)",
              }}
            >
              <Sparkles size={9} />
              Dote de origen: {t.dote_origen.nombre}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
