"use client";

/**
 * AventuraSection
 * ───────────────────────────────────────────────────────────────────────────
 * Tab "Aventura" (primera, junto a Línea de Tiempo) en myself/garlia.
 *
 * Flujo:
 *   1. Lista de aventuras (ej "El Bosque Sombrío", "La Ciudad Portuaria").
 *      Se crean nuevas con un nombre.
 *   2. Al entrar a una aventura: buscador para AGREGAR entidades de
 *      cualquier tabla (criaturas, items, PNJs...) — esto solo las
 *      preselecciona, no las hace visibles a jugadores todavía.
 *   3. Cada entidad agregada tiene un toggle Publicar/Ocultar — así el DM
 *      va revelando una por una en vivo durante la sesión.
 */

import { AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  BookOpen,
  Compass,
  Coins,
  Eye,
  EyeOff,
  Heart,
  Loader2,
  Maximize2,
  Plus,
  Search,
  Shield,
  Trash2,
  TreeDeciduous,
  Users,
  Waves,
  X,
} from "lucide-react";
import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";

import { MotionDiv } from "@/components/ui/Motion";

import {
  buscarEntidades,
  OBSTACULO_LABEL,
  TABLA_LABEL,
  useAventuraEntidades,
  useAventuraObstaculos,
  useAventurasList,
  type AventuraEntidad,
  type ObstaculoForma,
  type ObstaculoTipo,
  type ResultadoBusqueda,
} from "../hooks/aventuras/useAventuras";
import {
  TABLERO_CARD_SIZE,
  TableroAventura,
  type TableroItem,
} from "../components/aventuras/TableroAventura";
import { PanelManualDnd } from "../components/aventuras/PanelManualDnd";
import { PanelTiposMoneda } from "@/domains/garlia/_legacy-public/views/PanelTiposMoneda";
import { useTableroEscala, CARD_SCALE_MIN, CARD_SCALE_MAX } from "@/domains/garlia/_legacy-public/hooks/useTableroEscala";
import { FichaDetalle } from "@/domains/garlia/_legacy-public/views/fichaComponents";
import type { FichaDnd } from "@/domains/garlia/_legacy-public/hooks/useFichasDnd";
import { CriaturaStatsDndEditor } from "@/domains/garlia/criaturas/CriaturaStatsDnd";
import type { CriaturaStatsDnd } from "../hooks/types";
import { supabase } from "@/lib/api/client/supabase";

const AdminDescubrimientos = lazy(() => import("./editorRelaciones"));

type SubPanel = "aventuras" | "relaciones" | "monedas" | "manual";

const SUB_PANELES: { key: SubPanel; label: string; Icon: React.ElementType }[] = [
  { key: "aventuras", label: "Aventuras", Icon: Compass },
  { key: "relaciones", label: "Relaciones", Icon: Heart },
  { key: "monedas", label: "Monedas", Icon: Coins },
  { key: "manual", label: "Manual", Icon: BookOpen },
];

// ── Zoom del pizarrón del DM: mismo mecanismo (CSS transform sobre el
// lienzo, prop `zoom`) y mismo tamaño base de tarjeta (TABLERO_CARD_SIZE)
// que ve el jugador en /garlia/aventura — así el DM ve exactamente el
// mismo layout mientras arma la aventura. Solo el nivel de zoom en sí es
// una preferencia local del DM, persistida por aventura. ──

function SubPanelFallback() {
  return (
    <div className="flex-1 flex items-center justify-center text-primary/30 py-16">
      <Loader2 className="animate-spin" size={18} />
    </div>
  );
}

export function AventuraSection() {
  const [subPanel, setSubPanel] = useState<SubPanel>("aventuras");
  const [aventuraActiva, setAventuraActiva] = useState<string | null>(null);

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* ── Sub-selector: Aventuras / Relaciones ─────────────── */}
      <div className="shrink-0 flex items-center gap-1 px-4 py-2 border-b border-primary/10">
        {SUB_PANELES.map(({ key, label, Icon }) => {
          const active = subPanel === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                setSubPanel(key);
                if (key !== "aventuras") setAventuraActiva(null);
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                active
                  ? "bg-primary/10 text-primary"
                  : "text-primary/50 hover:bg-primary/5 hover:text-primary/80"
              }`}
            >
              <Icon size={13} />
              {label}
            </button>
          );
        })}
      </div>

      {/* ── Contenido del sub-panel activo ──────────────────────────────── */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {subPanel === "aventuras" &&
          (aventuraActiva ? (
            <AventuraDetalle aventuraId={aventuraActiva} onVolver={() => setAventuraActiva(null)} />
          ) : (
            <AventuraIndice onSeleccionar={setAventuraActiva} />
          ))}

        {subPanel === "relaciones" && (
          <Suspense fallback={<SubPanelFallback />}>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <AdminDescubrimientos />
            </div>
          </Suspense>
        )}

        {subPanel === "monedas" && (
          <div className="flex-1 min-h-0 overflow-y-auto p-4">
            <PanelTiposMoneda />
          </div>
        )}

        {subPanel === "manual" && <PanelManualDnd />}
      </div>
    </div>
  );
}

// ── Índice de aventuras ─────────────────────────────────────────────────

function AventuraIndice({ onSeleccionar }: { onSeleccionar: (id: string) => void }) {
  const { aventuras, loading, crear, eliminar } = useAventurasList();
  const [nombreNueva, setNombreNueva] = useState("");
  const [creando, setCreando] = useState(false);

  const handleCrear = async () => {
    const nombre = nombreNueva.trim();
    if (!nombre) return;
    setCreando(true);
    try {
      const nueva = await crear(nombre);
      setNombreNueva("");
      onSeleccionar(nueva.id);
    } finally {
      setCreando(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-primary/10">
        <input
          type="text"
          value={nombreNueva}
          onChange={(e) => setNombreNueva(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCrear()}
          placeholder="Nombre de la nueva aventura… ej. El Bosque Sombrío"
          className="flex-1 h-9 px-3 rounded-lg border border-primary/10 bg-primary/[0.03] outline-none text-xs text-primary/80 placeholder:text-primary/30 focus:border-primary/30 transition-colors"
        />
        <button
          type="button"
          disabled={!nombreNueva.trim() || creando}
          onClick={handleCrear}
          className="shrink-0 h-9 px-3 flex items-center gap-1.5 rounded-lg bg-primary text-white text-xs font-bold disabled:opacity-40 transition-opacity"
        >
          {creando ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
          Crear
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        {loading && aventuras.length === 0 ? (
          <div className="py-16 flex items-center justify-center text-primary/30">
            <Loader2 className="animate-spin" size={18} />
          </div>
        ) : aventuras.length === 0 ? (
          <div className="py-16 text-center text-xs text-primary/30">
            Aún no has creado ninguna aventura.
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
            {aventuras.map((a) => (
              <div
                key={a.id}
                className="group relative flex flex-col text-left overflow-hidden rounded-xl border border-primary/10 bg-primary/[0.02] hover:border-primary/25 transition-all"
              >
                <button
                  type="button"
                  onClick={() => onSeleccionar(a.id)}
                  className="flex-1 p-4 text-left"
                >
                  <h3 className="font-serif italic text-base text-primary truncate">
                    {a.nombre}
                  </h3>
                  <span className="text-micro text-primary/35">
                    Creada el{" "}
                    {new Date(a.created_at).toLocaleDateString("es", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`¿Eliminar "${a.nombre}" y todo su contenido asociado?`)) {
                      eliminar(a.id);
                    }
                  }}
                  className="absolute top-2 right-2 p-1.5 rounded-full opacity-0 group-hover:opacity-100 bg-black/5 hover:bg-red-500/10 hover:text-red-500 text-primary/30 transition-all"
                  title="Eliminar aventura"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Grupo/horda de criaturas ────────────────────────────────────────────
// Input de texto libre con datalist de nombres ya usados en la aventura,
// para que el DM junte varias criaturas bajo un mismo nombre de grupo
// (ej. "Horda de goblins"). Debounced: no llama a onCambiar en cada tecla,
// solo cuando el usuario deja de escribir o al perder foco.

function GrupoCriaturaInput({
  valor,
  opciones,
  onCambiar,
}: {
  valor: string | null;
  opciones: string[];
  onCambiar: (v: string | null) => void;
}) {
  const [texto, setTexto] = useState(valor ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const datalistId = useRef(`grupos-${Math.random().toString(36).slice(2)}`).current;

  useEffect(() => {
    setTexto(valor ?? "");
  }, [valor]);

  const disparar = (v: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onCambiar(v.trim() || null), 500);
  };

  return (
    <div
      className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-primary/10 bg-primary/[0.03]"
    >
      <Users size={14} className="text-primary/35 shrink-0" />
      <input
        type="text"
        list={datalistId}
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          disparar(e.target.value);
        }}
        onBlur={(e) => {
          if (debounceRef.current) clearTimeout(debounceRef.current);
          onCambiar(e.target.value.trim() || null);
        }}
        placeholder="Sin grupo — escribí un nombre para juntarla con otras (ej. Horda de goblins)"
        className="flex-1 bg-transparent outline-none text-xs text-primary/80 placeholder:text-primary/30"
      />
      <datalist id={datalistId}>
        {opciones.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
      {texto.trim() && (
        <button
          type="button"
          onClick={() => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            setTexto("");
            onCambiar(null);
          }}
          className="shrink-0 text-micro font-bold text-primary/35 hover:text-primary/60 transition-colors"
          title="Quitar del grupo"
        >
          Quitar
        </button>
      )}
    </div>
  );
}

// ── Detalle de una aventura ──────────────────────────────────────────────

function AventuraDetalle({
  aventuraId,
  onVolver,
}: {
  aventuraId: string;
  onVolver: () => void;
}) {
  const { aventuras, toggleNiebla } = useAventurasList();
  const {
    entidades,
    loading,
    agregar,
    quitar,
    togglePublicado,
    moverPosicion,
    asignarGrupo,
    redimensionar,
    asignarContenedor,
  } = useAventuraEntidades(aventuraId);
  const {
    obstaculos,
    agregar: agregarObstaculo,
    mover: moverObstaculo,
    redimensionar: redimensionarObstaculo,
    eliminar: eliminarObstaculo,
  } = useAventuraObstaculos(aventuraId);
  const aventura = aventuras.find((a) => a.id === aventuraId);

  // ── Modo "colocar obstáculo": si está activo, un click en el pizarrón
  // crea un obstáculo del tipo/forma elegidos en vez de mover nada. Se
  // apaga solo después de colocar uno (así no hay que acordarse de
  // apagarlo, pero se puede volver a activar para poner varios seguidos). ──
  const [modoObstaculo, setModoObstaculo] = useState<{ tipo: ObstaculoTipo; forma: ObstaculoForma } | null>(null);

  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<ResultadoBusqueda[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [pendientes, setPendientes] = useState<Set<string>>(new Set());
  const [seleccion, setSeleccion] = useState<AventuraEntidad | null>(null);
  const [fichaSeleccion, setFichaSeleccion] = useState<FichaDnd | null>(null);
  const [cargandoFicha, setCargandoFicha] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { escala, actualizar: actualizarEscala } = useTableroEscala(aventuraId);

  // ── Al seleccionar un token de tipo "fichas_dnd" en el pizarrón del DM,
  // se trae la ficha completa (todos los campos) para poder editarla sin
  // restricciones — a diferencia del jugador, el DM puede tocar clase,
  // inventario, stats, condiciones, todo. ──
  useEffect(() => {
    if (!seleccion || seleccion.tabla !== "fichas_dnd") {
      setFichaSeleccion(null);
      return;
    }
    let cancelado = false;
    setCargandoFicha(true);
    supabase
      .from("fichas_dnd")
      .select("*")
      .eq("id", seleccion.entidad_id)
      .single()
      .then(({ data, error }) => {
        if (cancelado) return;
        setFichaSeleccion(!error && data ? (data as FichaDnd) : null);
        setCargandoFicha(false);
      });
    return () => {
      cancelado = true;
    };
  }, [seleccion]);

  const handleActualizarFicha = useCallback(async (id: string, cambios: Partial<FichaDnd>) => {
    setFichaSeleccion((prev) => (prev ? { ...prev, ...cambios } : prev));
    const { error } = await supabase.from("fichas_dnd").update(cambios).eq("id", id);
    if (error) {
      // Revierte trayendo el estado real si falló en el servidor.
      const { data } = await supabase.from("fichas_dnd").select("*").eq("id", id).single();
      if (data) setFichaSeleccion(data as FichaDnd);
      throw error;
    }
  }, []);

  const handleEliminarFicha = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("fichas_dnd").delete().eq("id", id);
      if (error) throw error;
      setSeleccion(null);
      setFichaSeleccion(null);
      // La fila en aventura_entidades apunta a una ficha que ya no existe;
      // se limpia también para no dejar un token roto en el tablero.
      if (seleccion) void quitar(seleccion.id);
    },
    [seleccion, quitar],
  );

  // ── Edición de stats de monstruo (criaturas.stats_dnd) desde el token
  // del tablero: mismo editor completo que en el editor de criaturas
  // (CA, HP, características, salvaciones, acciones…), pero acá con
  // guardado debounced porque CriaturaStatsDndEditor entrega el objeto
  // completo en cada tecla — un UPDATE por cada cambio sería demasiado
  // ruido de red. ──
  const [criaturaSeleccion, setCriaturaSeleccion] = useState<{
    id: string;
    nombre: string;
    stats_dnd: CriaturaStatsDnd | null;
  } | null>(null);
  const [cargandoCriatura, setCargandoCriatura] = useState(false);
  const [guardandoCriatura, setGuardandoCriatura] = useState(false);
  const statsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!seleccion || seleccion.tabla !== "criaturas") {
      setCriaturaSeleccion(null);
      return;
    }
    let cancelado = false;
    setCargandoCriatura(true);
    supabase
      .from("criaturas")
      .select("id, nombre, stats_dnd")
      .eq("id", seleccion.entidad_id)
      .single()
      .then(({ data, error }) => {
        if (cancelado) return;
        setCriaturaSeleccion(!error && data ? (data as typeof criaturaSeleccion) : null);
        setCargandoCriatura(false);
      });
    return () => {
      cancelado = true;
      if (statsDebounceRef.current) clearTimeout(statsDebounceRef.current);
    };
  }, [seleccion]);

  const handleCambiarStatsCriatura = useCallback(
    (v: CriaturaStatsDnd) => {
      setCriaturaSeleccion((prev) => (prev ? { ...prev, stats_dnd: v } : prev));
      if (statsDebounceRef.current) clearTimeout(statsDebounceRef.current);
      const id = criaturaSeleccion?.id;
      if (!id) return;
      statsDebounceRef.current = setTimeout(async () => {
        setGuardandoCriatura(true);
        const { error } = await supabase.from("criaturas").update({ stats_dnd: v }).eq("id", id);
        setGuardandoCriatura(false);
        if (error) {
          // eslint-disable-next-line no-console
          console.error("[AventuraSection] Error guardando stats de criatura:", error);
        }
      }, 500);
    },
    [criaturaSeleccion?.id],
  );

  // Nombres de grupo ya usados en esta aventura (para el datalist del
  // input de grupo — así el DM reutiliza el mismo nombre en vez de crear
  // variantes tipo "Goblins"/"goblins " por accidente).
  const gruposExistentes = Array.from(
    new Set(
      entidades
        .filter((e) => e.tabla === "criaturas" && e.grupo_nombre)
        .map((e) => e.grupo_nombre as string),
    ),
  ).sort();

  // Arrastrar una criatura sobre otra en el pizarrón: las agrupa en una
  // horda, sin pasar por el input de texto. Reglas de resolución:
  //   - Si el objetivo ya tiene grupo, la arrastrada se une a ESE grupo
  //     (así arrastrar de a una sobre una horda existente la va sumando).
  //   - Si la arrastrada ya tenía grupo pero el objetivo no, se propaga el
  //     grupo de la arrastrada al objetivo (misma idea, en el otro sentido).
  //   - Si ninguna tenía grupo, se crea uno nuevo con el nombre del
  //     objetivo (ej. soltar "Goblin" sobre "Goblin" → grupo "Goblin"),
  //     evitando colisión con nombres ya usados agregando un sufijo.
  //   - Solo aplica entre dos criaturas — soltar una ficha de jugador u
  //     otra entidad sobre algo no hace nada (los grupos/hordas son
  //     puramente de criaturas, ver UMBRAL_COMBATE en aventura.tsx).
  const handleDropAgrupar = useCallback(
    (draggedId: string, targetId: string) => {
      const arrastrada = entidades.find((e) => e.id === draggedId);
      const objetivo = entidades.find((e) => e.id === targetId);
      if (!arrastrada || !objetivo) return;
      if (arrastrada.tabla !== "criaturas" || objetivo.tabla !== "criaturas") return;

      // Tras agrupar, la arrastrada se reubica levemente al lado del
      // objetivo (offset fijo) en vez de quedar tapándola — visualmente
      // dos tarjetas contiguas comunican "ahora son del mismo grupo" mejor
      // que una encima de la otra, y siguen quedando fáciles de separar a
      // mano si el DM quiere reordenar la horda después.
      const offsetX = TABLERO_CARD_SIZE.width + 16;
      if (objetivo.pos_x !== null && objetivo.pos_y !== null) {
        void moverPosicion(draggedId, objetivo.pos_x + offsetX, objetivo.pos_y);
      }

      if (objetivo.grupo_nombre) {
        if (arrastrada.grupo_nombre !== objetivo.grupo_nombre) {
          void asignarGrupo(draggedId, objetivo.grupo_nombre);
        }
        return;
      }
      if (arrastrada.grupo_nombre) {
        void asignarGrupo(targetId, arrastrada.grupo_nombre);
        return;
      }
      // Ninguna tenía grupo todavía: se crea uno nuevo a partir del
      // nombre de la criatura objetivo, evitando pisar un nombre ya usado.
      let nombreBase = objetivo.nombre;
      let nombreFinal = nombreBase;
      let sufijo = 2;
      while (gruposExistentes.includes(nombreFinal)) {
        nombreFinal = `${nombreBase} ${sufijo}`;
        sufijo += 1;
      }
      void asignarGrupo(targetId, nombreFinal);
      void asignarGrupo(draggedId, nombreFinal);
    },
    [entidades, asignarGrupo, moverPosicion, gruposExistentes],
  );

  // Soltar cualquier tarjeta (personaje, criatura, ítem, etc.) DENTRO del
  // área de un reino agrandado en el pizarrón: la marca como "contenida"
  // en ese reino. Cualquier entidad puede entrar en cualquier otra
  // (incluido meter un reino dentro de otro reino, si alguna vez hace
  // falta un "sub-reino") — TableroAventura ya filtra que el contenedor
  // sea sensiblemente más grande que la tarjeta soltada antes de llamar
  // a esto, así que acá no hace falta repetir esa validación.
  const handleDropInsideContainer = useCallback(
    (draggedId: string, containerId: string) => {
      void asignarContenedor(draggedId, containerId);
    },
    [asignarContenedor],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResultados([]);
      return;
    }
    setBuscando(true);
    debounceRef.current = setTimeout(async () => {
      const r = await buscarEntidades(query);
      setResultados(r);
      setBuscando(false);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const yaAgregada = (tabla: string, id: string) =>
    entidades.some((e) => e.tabla === tabla && e.entidad_id === id);

  const marcarPendiente = (key: string, activo: boolean) => {
    setPendientes((prev) => {
      const next = new Set(prev);
      if (activo) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const handleAgregar = async (r: ResultadoBusqueda) => {
    const key = `${r.tabla}:${r.id}`;
    // Guard sincrónico: evita el doble-click/carrera antes de que el
    // estado de React (pendientes/entidades) alcance a re-renderizar. Para
    // criaturas NO bloquea por "ya agregada" — ahí clickear de nuevo es
    // justamente cómo se suma otro miembro a la horda.
    if (pendientes.has(key)) return;
    if (r.tabla !== "criaturas" && yaAgregada(r.tabla, r.id)) return;
    marcarPendiente(key, true);
    try {
      await agregar(r.tabla, r.id, r.nombre);
    } finally {
      marcarPendiente(key, false);
    }
  };

  const handleToggle = async (e: AventuraEntidad) => {
    marcarPendiente(e.id, true);
    try {
      await togglePublicado(e);
    } finally {
      marcarPendiente(e.id, false);
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* ── Cabecera ─────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-primary/10">
        <button
          type="button"
          onClick={onVolver}
          className="shrink-0 p-1.5 -ml-1.5 rounded-full hover:bg-primary/10 transition-colors"
        >
          <ArrowLeft size={14} className="text-primary/50" />
        </button>
        <h2 className="text-xs font-black uppercase tracking-widest text-primary/70 truncate">
          {aventura?.nombre ?? "Aventura"}
        </h2>
        <span className="text-micro font-bold text-primary/35">
          {entidades.filter((e) => e.publicado).length} publicada
          {entidades.filter((e) => e.publicado).length === 1 ? "" : "s"} de {entidades.length}
        </span>
      </div>

      {/* ── Buscador para agregar ───────────────────────────────────── */}
      <div className="shrink-0 px-4 py-2.5 border-b border-primary/10 relative">
        <div
          className="flex items-center gap-2 px-3 rounded-lg border border-primary/10 bg-primary/[0.03] focus-within:border-primary/30 transition-colors"
          style={{ height: "34px" }}
        >
          <Search size={13} className="text-primary/35 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar criaturas, items, PNJs… para añadir a esta aventura"
            className="flex-1 bg-transparent outline-none text-xs text-primary/80 placeholder:text-primary/30"
          />
          {buscando && <Loader2 size={12} className="animate-spin text-primary/30" />}
          {query && !buscando && (
            <button type="button" onClick={() => setQuery("")}>
              <X size={12} className="text-primary/40" />
            </button>
          )}
        </div>

        {resultados.length > 0 && (
          <div className="absolute left-4 right-4 top-full mt-1 z-20 max-h-72 overflow-y-auto rounded-xl border border-primary/10 bg-[var(--white-custom)] shadow-lg">
            {resultados.map((r) => {
              const key = `${r.tabla}:${r.id}`;
              const cantidadAgregada = entidades.filter(
                (e) => e.tabla === r.tabla && e.entidad_id === r.id,
              ).length;
              const yaEsta = cantidadAgregada > 0;
              const esCriatura = r.tabla === "criaturas";
              const isPending = pendientes.has(key);
              return (
                <button
                  key={key}
                  type="button"
                  disabled={(yaEsta && !esCriatura) || isPending}
                  onClick={() => handleAgregar(r)}
                  title={esCriatura && yaEsta ? "Sumar otra a la horda" : undefined}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-primary/5 disabled:opacity-50 transition-colors"
                >
                  <div className="w-8 h-8 shrink-0 rounded-md overflow-hidden bg-primary/5">
                    {r.imagen_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.imagen_url} alt="" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-primary/80 truncate">
                      {r.nombre}
                    </div>
                    <div className="text-micro text-primary/35">
                      {TABLA_LABEL[r.tabla].singular}
                    </div>
                  </div>
                  {isPending ? (
                    <Loader2 size={12} className="animate-spin text-primary/40" />
                  ) : esCriatura ? (
                    yaEsta ? (
                      <span className="flex items-center gap-1 text-micro font-bold text-primary/40">
                        ×{cantidadAgregada}
                        <Plus size={12} className="text-primary/50" />
                      </span>
                    ) : (
                      <Plus size={13} className="text-primary/40" />
                    )
                  ) : yaEsta ? (
                    <span className="text-micro font-bold text-primary/30">Añadida</span>
                  ) : (
                    <Plus size={13} className="text-primary/40" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Tablero libre (izq) + Identidades en dropdowns (der) ──────── */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        <div className="flex-1 min-h-0 min-w-0 flex flex-col p-4 gap-2 overflow-hidden">
          <div className="shrink-0 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-micro text-primary/35">
              Arrastrá las tarjetas para ordenarlas como quieras en el pizarrón.
              El ojo publica/oculta para los jugadores; la X quita del todo.
            </p>
            <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
              {/* ── Colocar obstáculo: elegí tipo + forma, después click en
                  el pizarrón para soltarlo. Se puede editar arrastrando o
                  redimensionando el handle; el ícono de tacho lo borra. ── */}
              {(
                [
                  { tipo: "pared" as ObstaculoTipo, Icono: Shield },
                  { tipo: "rio" as ObstaculoTipo, Icono: Waves },
                  { tipo: "bosque" as ObstaculoTipo, Icono: TreeDeciduous },
                ]
              ).map(({ tipo, Icono }) => {
                const activo = modoObstaculo?.tipo === tipo;
                return (
                  <button
                    key={tipo}
                    type="button"
                    onClick={() =>
                      setModoObstaculo((prev) =>
                        prev?.tipo === tipo ? null : { tipo, forma: "rect" },
                      )
                    }
                    title={`Colocar ${OBSTACULO_LABEL[tipo].toLowerCase()} (click en el pizarrón)`}
                    className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
                    style={{
                      background: activo ? "var(--primary)" : "color-mix(in srgb, var(--primary) 8%, transparent)",
                      color: activo ? "var(--btn-text)" : "var(--primary)",
                    }}
                  >
                    <Icono size={13} />
                  </button>
                );
              })}
              {modoObstaculo && (
                <button
                  type="button"
                  onClick={() =>
                    setModoObstaculo((prev) =>
                      prev ? { ...prev, forma: prev.forma === "rect" ? "circulo" : "rect" } : prev,
                    )
                  }
                  className="text-micro font-bold text-primary/50 hover:text-primary/70 px-2 py-1 rounded-full"
                  style={{ background: "color-mix(in srgb, var(--primary) 8%, transparent)" }}
                >
                  {modoObstaculo.forma === "rect" ? "▭ rect." : "◯ círculo"}
                </button>
              )}
              <button
                type="button"
                onClick={() => aventuraId && toggleNiebla(aventuraId, !aventura?.niebla_activa)}
                title="Niebla de guerra para los jugadores (vos siempre ves todo)"
                className="flex items-center gap-1 text-micro font-bold px-2 py-1 rounded-full transition-colors"
                style={{
                  background: aventura?.niebla_activa
                    ? "color-mix(in srgb, var(--primary) 18%, transparent)"
                    : "color-mix(in srgb, var(--primary) 8%, transparent)",
                  color: "var(--primary)",
                }}
              >
                {aventura?.niebla_activa ? <Eye size={12} /> : <EyeOff size={12} />}
                Niebla
              </button>
              <Maximize2 size={11} className="text-primary/35" />
              <input
                type="range"
                min={CARD_SCALE_MIN}
                max={CARD_SCALE_MAX}
                step={0.05}
                value={escala}
                onChange={(e) => actualizarEscala(Number(e.target.value))}
                className="w-24 accent-[var(--primary)]"
                title="Tamaño de las tarjetas (solo en tu vista de DM)"
              />
              <span className="text-micro font-bold tabular-nums text-primary/40 w-9">
                {Math.round(escala * 100)}%
              </span>
            </div>
          </div>
          {loading && entidades.length === 0 ? (
            <div className="py-16 flex items-center justify-center text-primary/30">
              <Loader2 className="animate-spin" size={18} />
            </div>
          ) : (
            <TableroAventura
              editable
              emptyHint="Busca arriba y añade lo que quieras tener a mano para esta aventura."
              zoom={escala}
              obstaculos={obstaculos.map((o) => ({ ...o, bloqueaVision: o.bloquea_vision }))}
              onMoveObstaculo={(id, x, y) => moverObstaculo(id, x, y)}
              onResizeObstaculo={(id, w, h) => redimensionarObstaculo(id, w, h)}
              onClickObstaculo={(id) => {
                // Click corto sobre un obstáculo ya puesto: lo borra. Es
                // deliberadamente simple (sin confirmación) porque un
                // obstáculo se recrea en dos clicks si fue sin querer.
                if (!modoObstaculo) eliminarObstaculo(id);
              }}
              onCanvasClick={
                modoObstaculo
                  ? (x, y) => {
                      agregarObstaculo(modoObstaculo.tipo, modoObstaculo.forma, x, y);
                      setModoObstaculo(null);
                    }
                  : undefined
              }
              items={entidades.map(
              (e): TableroItem => ({
                id: e.id,
                nombre: e.nombre,
                imagen_url: e.imagen_url,
                subtitulo:
                  e.tabla === "criaturas" && e.grupo_nombre
                    ? `${TABLA_LABEL[e.tabla].singular} · 🛡️ ${e.grupo_nombre}`
                    : TABLA_LABEL[e.tabla].singular,
                pos_x: e.pos_x,
                pos_y: e.pos_y,
                destacado: e.tabla === "fichas_dnd",
                ancho: e.ancho,
                alto: e.alto,
                contenedorId: e.contenedor_id,
                grupoNombre: e.tabla === "criaturas" ? e.grupo_nombre : null,
              }),
            )}
            renderBadge={(item) => {
              const e = entidades.find((x) => x.id === item.id);
              if (!e) return null;
              const isPending = pendientes.has(e.id);
              return (
                <div className="flex items-center gap-1">
                  {e.contenedor_id && (
                    <button
                      type="button"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        void asignarContenedor(e.id, null);
                      }}
                      onPointerDown={(ev) => ev.stopPropagation()}
                      className="w-6 h-6 rounded-full flex items-center justify-center bg-black/30 hover:bg-blue-500/70 text-white transition-colors"
                      title="Sacar del reino"
                    >
                      ⛺
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      handleToggle(e);
                    }}
                    onPointerDown={(ev) => ev.stopPropagation()}
                    className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      e.publicado ? "bg-primary text-white" : "bg-black/30 text-white/70"
                    }`}
                    title={e.publicado ? "Publicado (click para ocultar)" : "Oculto (click para publicar)"}
                  >
                    {isPending ? (
                      <Loader2 size={11} className="animate-spin" />
                    ) : e.publicado ? (
                      <Eye size={11} />
                    ) : (
                      <EyeOff size={11} />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      quitar(e.id);
                    }}
                    onPointerDown={(ev) => ev.stopPropagation()}
                    className="w-6 h-6 rounded-full flex items-center justify-center bg-black/30 hover:bg-red-500/70 text-white transition-colors"
                    title="Quitar de esta aventura"
                  >
                    <X size={11} />
                  </button>
                </div>
              );
            }}
              onMove={(id, x, y) => moverPosicion(id, x, y)}
              onDropOnItem={handleDropAgrupar}
              onDropInsideContainer={handleDropInsideContainer}
              onResizeItem={(id, ancho, alto) => redimensionar(id, ancho, alto)}
              onClickItem={(id) => {
                const e = entidades.find((x) => x.id === id);
                if (e) setSeleccion(e);
              }}
            />
          )}
        </div>
      </div>

      {/* ── Modal de detalle: para fichas_dnd, la hoja completa editable
          (misma UI que /myself/garlia, con FichaDetalle en modo modal). Para
          el resto de entidades, la misma vista simple que ve el jugador. ── */}
      <AnimatePresence>
        {seleccion && (
          <MotionDiv
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            style={{ background: "rgba(0,0,0,0.5)" }}
            onClick={() => setSeleccion(null)}
          >
            <MotionDiv
              animate={{ opacity: 1, scale: 1 }}
              className={`relative w-full max-h-[85vh] overflow-y-auto rounded-2xl p-6 ${
                seleccion.tabla === "fichas_dnd" || seleccion.tabla === "criaturas"
                  ? "max-w-3xl"
                  : "max-w-lg"
              }`}
              exit={{ opacity: 0, scale: 0.96 }}
              initial={{ opacity: 0, scale: 0.96 }}
              style={{ background: "var(--white-custom)" }}
              onClick={(e) => e.stopPropagation()}
            >
              {seleccion.tabla === "fichas_dnd" ? (
                cargandoFicha ? (
                  <div className="py-16 flex items-center justify-center">
                    <Loader2 className="animate-spin text-primary/30" size={20} />
                  </div>
                ) : fichaSeleccion ? (
                  <FichaDetalle
                    key={fichaSeleccion.id}
                    ficha={fichaSeleccion}
                    esActiva
                    variant="modal"
                    onVolver={() => setSeleccion(null)}
                    onActualizar={handleActualizarFicha}
                    onEliminar={handleEliminarFicha}
                    onElegirActiva={async () => {}}
                  />
                ) : (
                  <p className="text-sm text-primary/30 italic py-8 text-center">
                    No se pudo cargar esta ficha.
                  </p>
                )
              ) : seleccion.tabla === "criaturas" ? (
                cargandoCriatura ? (
                  <div className="py-16 flex items-center justify-center">
                    <Loader2 className="animate-spin text-primary/30" size={20} />
                  </div>
                ) : criaturaSeleccion ? (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {seleccion.imagen_url && (
                          <div className="w-12 h-12 shrink-0 rounded-lg overflow-hidden bg-primary/5">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={seleccion.imagen_url}
                              alt={criaturaSeleccion.nombre}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <div className="min-w-0">
                          <span className="text-micro font-black uppercase tracking-widest text-primary/35">
                            Ficha de combate
                          </span>
                          <h2 className="font-serif italic text-xl text-primary truncate">
                            {criaturaSeleccion.nombre}
                          </h2>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {guardandoCriatura && (
                          <Loader2 size={13} className="animate-spin text-primary/30" />
                        )}
                        <button
                          type="button"
                          onClick={() => setSeleccion(null)}
                          className="p-1.5 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors"
                        >
                          <X size={14} className="text-primary/60" />
                        </button>
                      </div>
                    </div>
                    <GrupoCriaturaInput
                      key={seleccion.id}
                      valor={seleccion.grupo_nombre}
                      opciones={gruposExistentes}
                      onCambiar={(v) => asignarGrupo(seleccion.id, v)}
                    />
                    <CriaturaStatsDndEditor
                      valor={criaturaSeleccion.stats_dnd}
                      onCambiar={handleCambiarStatsCriatura}
                    />
                  </div>
                ) : (
                  <p className="text-sm text-primary/30 italic py-8 text-center">
                    No se pudo cargar esta criatura.
                  </p>
                )
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setSeleccion(null)}
                    className="absolute top-4 right-4 p-1.5 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors"
                  >
                    <X size={14} className="text-primary/60" />
                  </button>

                  {seleccion.imagen_url && (
                    <div className="w-full h-48 rounded-xl overflow-hidden mb-4 bg-primary/5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={seleccion.imagen_url}
                        alt={seleccion.nombre}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  <span className="text-micro font-black uppercase tracking-widest text-primary/35">
                    {TABLA_LABEL[seleccion.tabla].singular}
                  </span>
                  <h2 className="font-serif italic text-2xl text-primary mb-3">{seleccion.nombre}</h2>

                  {seleccion.descripcion ? (
                    <p className="text-sm text-primary/70 whitespace-pre-wrap leading-relaxed">
                      {seleccion.descripcion}
                    </p>
                  ) : (
                    <p className="text-sm text-primary/30 italic">Sin descripción todavía.</p>
                  )}

                  <div className="mt-4 flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-micro font-black uppercase ${
                        seleccion.publicado ? "bg-primary text-white" : "bg-primary/10 text-primary/50"
                      }`}
                    >
                      {seleccion.publicado ? <Eye size={10} /> : <EyeOff size={10} />}
                      {seleccion.publicado ? "Publicado" : "Oculto"}
                    </span>
                  </div>
                </>
              )}
            </MotionDiv>
          </MotionDiv>
        )}
      </AnimatePresence>
    </div>
  );
}
