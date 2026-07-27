"use client";

import { User, ChevronRight, Music2 } from "lucide-react";
import Link from "next/link";
import React, { useState, useMemo, useEffect } from "react";

import { Loading } from "@/components/ui";
import { MotionDiv } from "@/components/ui/Motion";
import { SmartImage } from "@/components/ui/SmartImage";
import { useSupabaseData } from "@/hooks/data/useSupabaseData";
import { supabase } from "@/lib/api/client/supabase";
import { estaEnTauri, navegarRutaDinamica } from "@/lib/utils/navegacionTauri";
import { toSlug } from "@/lib/utils/slugify";

interface Personaje {
  id: string;
  nombre: string;
  img_url?: string;
}

interface Cancion {
  id: string;
  titulo: string;
  personaje_id?: string | null;
  personaje?: Personaje | Personaje[] | null;
  cantante?: string;
  compositor?: string;
  idioma?: string;
  portada_url?: string;
  visible?: boolean;
}

function normPersonaje(
  v: Personaje | Personaje[] | null | undefined,
): Personaje | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

const CancionCardGrid = ({
  cancion,
  index,
}: {
  cancion: Cancion;
  index: number;
}) => (
  <MotionDiv
    animate={{ opacity: 1, y: 0 }}
    className="relative group h-full"
    initial={{ opacity: 0, y: 20 }}
    transition={{ delay: index * 0.04 }}
  >
    <Link
      href={`/garlia/canciones/${toSlug(cancion.titulo)}`}
      onClick={(e) => {
        if (estaEnTauri()) {
          e.preventDefault();
          navegarRutaDinamica(`/garlia/canciones/${toSlug(cancion.titulo)}`);
        }
      }}
    >
      <MotionDiv
        className="cursor-pointer h-full"
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        whileHover={{ y: -4, rotate: -0.4 }}
      >
        <div
          className="relative aspect-square overflow-hidden"
          style={{
            borderRadius: "2px",
            border:
              "1px solid color-mix(in srgb, var(--primary) 20%, transparent)",
            boxShadow:
              "3px 3px 0 color-mix(in srgb, var(--primary) 8%, transparent), var(--shadow-card)",
          }}
        >
          <div
            className="w-full h-full"
            style={{ filter: "sepia(30%) contrast(0.93) brightness(0.93)" }}
          >
            <SmartImage
              alt={cancion.titulo}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              fallbackIcon={<Music2 size={22} />}
              src={cancion.portada_url || "/placeholder-cover.jpg"}
            />
          </div>
          <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/15 to-transparent" />
          {/* Esquina doblada estilo papel */}
          <div
            className="absolute top-0 right-0 w-5 h-5 opacity-70"
            style={{
              background: "var(--bg-main)",
              clipPath: "polygon(100% 0, 0 0, 100% 100%)",
            }}
          />
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <div className="flex items-center gap-1 mb-1.5 opacity-40">
              <div className="h-px flex-1 bg-white/50" />
              <span className="text-white/60 text-micro">✦</span>
              <div className="h-px w-3 bg-white/50" />
            </div>
            <h2 className="text-white font-black uppercase text-xs leading-tight tracking-wider italic line-clamp-2 drop-shadow-sm group-hover:text-accent transition-colors duration-300">
              {cancion.titulo}
            </h2>
            {cancion.cantante && (
              <p className="text-white/45 text-micro font-bold uppercase tracking-[0.2em] mt-1 truncate">
                {cancion.cantante}
              </p>
            )}
          </div>
        </div>
      </MotionDiv>
    </Link>
  </MotionDiv>
);

const CancionCardFila = ({
  cancion,
  index,
}: {
  cancion: Cancion;
  index: number;
}) => (
  <MotionDiv
    animate={{ opacity: 1, y: 0 }}
    initial={{ opacity: 0, y: 6 }}
    transition={{ delay: index * 0.03 }}
  >
    <Link
      href={`/garlia/canciones/${toSlug(cancion.titulo)}`}
      onClick={(e) => {
        if (estaEnTauri()) {
          e.preventDefault();
          navegarRutaDinamica(`/garlia/canciones/${toSlug(cancion.titulo)}`);
        }
      }}
    >
      <div
        className="group flex items-center gap-3 bg-primary/[0.03] hover:bg-primary/[0.06] px-3 py-2 transition-all duration-300 cursor-pointer"
        style={{
          borderRadius: "2px",
          border:
            "1px solid color-mix(in srgb, var(--primary) 10%, transparent)",
          boxShadow:
            "1px 1px 0 color-mix(in srgb, var(--primary) 5%, transparent)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor =
            "color-mix(in srgb, var(--primary) 22%, transparent)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor =
            "color-mix(in srgb, var(--primary) 10%, transparent)";
        }}
      >
        <span className="font-mono text-micro font-black text-primary/15 w-6 text-right shrink-0 select-none group-hover:text-primary/35 transition-colors tracking-wider">
          {String(index + 1).padStart(3, "0")}
        </span>
        <div className="w-px h-7 bg-primary/10 shrink-0" />
        <div
          className="w-10 h-10 overflow-hidden shrink-0"
          style={{
            borderRadius: "1px",
            border:
              "1px solid color-mix(in srgb, var(--primary) 12%, transparent)",
            filter: "sepia(20%) contrast(0.95)",
          }}
        >
          <SmartImage
            alt={cancion.titulo}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            fallbackIcon={<Music2 size={14} />}
            src={cancion.portada_url || "/placeholder-cover.jpg"}
          />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-primary font-black uppercase text-micro group-hover:text-accent transition-colors tracking-wide italic truncate">
            {cancion.titulo}
          </h2>
          {cancion.cantante && (
            <p className="text-primary/35 text-micro font-bold uppercase tracking-[0.2em] truncate mt-0.5">
              {cancion.cantante}
            </p>
          )}
        </div>
        <ChevronRight
          className="text-primary/15 group-hover:text-primary/45 transition-colors shrink-0"
          size={12}
        />
      </div>
    </Link>
  </MotionDiv>
);

const PersonajeBloque = ({
  personaje,
  canciones,
  vistaFila,
  globalOffset,
  imgUrl,
}: {
  personaje: string;
  canciones: Cancion[];
  vistaFila: boolean;
  globalOffset: number;
  imgUrl?: string;
}) => (
  <MotionDiv
    animate={{ opacity: 1, y: 0 }}
    className="mb-24 flex flex-col md:flex-row gap-8 lg:gap-12 items-start"
    initial={{ opacity: 0, y: 24 }}
    transition={{ duration: 0.5 }}
  >
    {/* COLUMNA IZQUIERDA: Personaje en Grande */}
    <div className="w-full md:w-1/3 lg:w-1/4 shrink-0 flex flex-col items-center md:items-start text-center md:text-left md:sticky md:top-24">
      {imgUrl ? (
        <div
          className="w-48 h-48 md:w-full mb-5 overflow-hidden bg-primary/5"
          style={{
            borderRadius: "2px",
            border:
              "1px solid color-mix(in srgb, var(--primary) 20%, transparent)",
            boxShadow:
              "4px 4px 0 color-mix(in srgb, var(--primary) 8%, transparent)",
            filter: "sepia(15%)",
          }}
        >
          <img
            alt={personaje}
            className="w-full h-auto object-contain block"
            src={imgUrl}
          />
        </div>
      ) : (
        <div
          className="w-48 h-48 md:w-full mb-5 flex items-center justify-center bg-primary/5"
          style={{
            borderRadius: "2px",
            border:
              "1px solid color-mix(in srgb, var(--primary) 20%, transparent)",
            boxShadow:
              "4px 4px 0 color-mix(in srgb, var(--primary) 8%, transparent)",
            aspectRatio: "1 / 1",
          }}
        >
          <User className="text-primary/20" size={64} />
        </div>
      )}

      <h2 className="text-3xl lg:text-4xl font-black uppercase text-primary tracking-tighter leading-none mb-2">
        {personaje}
      </h2>
      <div className="flex items-center gap-2 mb-4 w-full justify-center md:justify-start">
        <div
          className="h-px w-8"
          style={{
            background: "color-mix(in srgb, var(--primary) 20%, transparent)",
          }}
        />
        <p className="text-micro font-mono font-bold text-primary/40 tracking-widest uppercase whitespace-nowrap">
          {canciones.length} {canciones.length !== 1 ? "canciones" : "canción"}
        </p>
        <div
          className="h-px flex-1"
          style={{
            background:
              "linear-gradient(to right, color-mix(in srgb, var(--primary) 20%, transparent), transparent)",
          }}
        />
      </div>
    </div>

    {/* COLUMNA DERECHA: Canciones en Pequeñito */}
    <div className="w-full md:w-2/3 lg:w-3/4 flex-1">
      {vistaFila ? (
        <div className="flex flex-col gap-2">
          {canciones.map((c, i) => (
            <CancionCardFila key={c.id} cancion={c} index={globalOffset + i} />
          ))}
        </div>
      ) : (
        // Utilizamos un grid más denso (más columnas) para que las tarjetas se vean más pequeñas
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {canciones.map((c, i) => (
            <CancionCardGrid key={c.id} cancion={c} index={globalOffset + i} />
          ))}
        </div>
      )}
    </div>
  </MotionDiv>
);

export default function CancionesPage() {
  const { data: cancionesCacheadas, loading } =
    useSupabaseData<Cancion>("canciones");
  const [canciones, setCanciones] = useState<Cancion[]>([]);
  const [vistaFila, _setVistaFila] = useState(false);

  useEffect(() => {
    if (cancionesCacheadas.length > 0) {
      setCanciones(cancionesCacheadas);
    }
  }, [cancionesCacheadas]);

  useEffect(() => {
    supabase
      .from("canciones")
      .select("*, personaje:personajes!personaje_id(id, nombre, img_url)")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setCanciones(data as Cancion[]);
      });
  }, []);

  const filtradas = useMemo(
    () => canciones.filter((c) => c.visible !== false),
    [canciones],
  );

  const grupos = useMemo(() => {
    const SIN_PERSONAJE = "Sin personaje";
    const mapa = new Map<string, { canciones: Cancion[]; imgUrl?: string }>();

    for (const c of filtradas) {
      const p = normPersonaje(c.personaje);
      const key = p?.nombre?.trim() || SIN_PERSONAJE;
      if (!mapa.has(key)) mapa.set(key, { canciones: [], imgUrl: p?.img_url });
      mapa.get(key)!.canciones.push(c);
      if (!mapa.get(key)!.imgUrl && p?.img_url) {
        mapa.get(key)!.imgUrl = p.img_url;
      }
    }

    const entries = [...mapa.entries()];
    const conPersonaje = entries.filter(([k]) => k !== SIN_PERSONAJE);
    const sinPersonaje = entries.filter(([k]) => k === SIN_PERSONAJE);

    return [...conPersonaje, ...sinPersonaje];
  }, [filtradas]);

  if (loading) return <Loading text="Cargando" />;

  let offsetAccumulator = 0;

  return (
    <div
      className="min-h-screen bg-bg-main pb-20"
      style={{
        backgroundImage:
          "radial-gradient(ellipse at 20% 50%, color-mix(in srgb, var(--primary) 2%, transparent) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, color-mix(in srgb, var(--primary) 1.5%, transparent) 0%, transparent 50%)",
      }}
    >
      <div className="max-w-6xl mx-auto pt-16 px-6">
        {/* Header corregido: sin PageHeader wrapper que duplica el flex layout */}
        <div className="flex items-end justify-between mb-10 gap-4">
          <div className="flex items-end gap-3">
            <div>
              <h1 className="text-4xl font-black italic tracking-tighter text-primary leading-none">
                Soliloquios
              </h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6">
        {grupos.length === 0 ? (
          <p className="text-center text-primary/30 font-bold text-xs uppercase tracking-widest py-24 italic">
            No has descubierto canciones
          </p>
        ) : (
          grupos.map(([personaje, { canciones: cancionesList, imgUrl }]) => {
            const currentOffset = offsetAccumulator;
            offsetAccumulator += cancionesList.length;
            return (
              <PersonajeBloque
                key={personaje}
                canciones={cancionesList}
                globalOffset={currentOffset}
                imgUrl={imgUrl}
                personaje={personaje}
                vistaFila={vistaFila}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
