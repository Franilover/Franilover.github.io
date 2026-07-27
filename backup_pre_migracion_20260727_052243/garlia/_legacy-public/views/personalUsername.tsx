"use client";

import { AnimatePresence } from "framer-motion";
import {
  User,
  Sword,
  Cat,
  X,
  Loader2,
  Music2,
  ChevronRight,
  Star,
  MapPin,
  Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { estaEnTauri, navegarRutaDinamica } from "@/lib/utils/navegacionTauri";
import React, { useEffect, useState } from "react";

import { MotionDiv } from "@/components/ui/Motion";
import {
  ModalDetalle,
  EntidadCard,
  EmptyTab,
  type EntidadModal,
  type Descubrimiento,
  type ItemInventario,
} from "@/domains/garlia/_legacy-public/views/PersonalComponents";
import { db } from "@/lib/api/client/db";
import { supabase } from "@/lib/api/client/supabase";
import {
  loadDescubrimientos,
  loadReinosCiudadesUsuario,
  loadInventarioUsuario,
  loadPerfilesResumen,
  loadCancionesPersonaje,
  type PerfilResumen,
  type ReinoDesbloqueado,
  type CiudadDesbloqueada,
} from "@/lib/api/client/syncEngine";

// Caché en memoria para perfiles públicos por username (navegación SPA)

const PERFIL_PUBLICO_TTL = 10 * 60_000;

const _perfilPublicoCache = new Map<string, { data: PerfilData; ts: number }>();

interface PerfilData {
  id: string;
  username: string;
  status?: string;
  avatar_url?: string;
  descripcion?: string;
  titulo?: string;
  personaje_favorito?: { id: string; nombre: string; img_url?: string } | null;
  mascota?: { id: string; nombre: string; imagen_url?: string } | null;
}

interface PersonalUsernameProps {
  username: string;
}

export default function PersonalUsername({ username }: PersonalUsernameProps) {
  const [perfil, setPerfil] = useState<PerfilData | null>(null);
  const [inventario, setInventario] = useState<ItemInventario[]>([]);
  const [descubrimientos, setDescubrimientos] = useState<Descubrimiento[]>([]);
  const [otrosPerfiles, setOtrosPerfiles] = useState<PerfilResumen[]>([]);
  const [cargando, setCargando] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState<
    "items" | "criaturas" | "personajes" | "reinos"
  >("personajes");
  const [modalD, setModalD] = useState<EntidadModal | null>(null);
  const [modalPersonaje, setModalPersonaje] = useState<Descubrimiento | null>(
    null,
  );
  const [cancionesPersonaje, setCancionesPersonaje] = useState<any[]>([]);
  const [cargandoCanciones, setCargandoCanciones] = useState(false);
  const [reinos, setReinos] = useState<ReinoDesbloqueado[]>([]);
  const [ciudades, setCiudades] = useState<CiudadDesbloqueada[]>([]);
  const [ciudadesReino, setCiudadesReino] = useState<CiudadDesbloqueada[]>([]);

  useEffect(() => {
    if (!username) return;

    async function cargar() {
      setCargando(true);

      // ── Paso 1: resolver el perfil público por username ───────────────────
      // Primero caché en memoria (navegación SPA entre perfiles = 0ms)
      const memHit = _perfilPublicoCache.get(username);
      let perfilData: PerfilData | null =
        memHit && Date.now() - memHit.ts < PERFIL_PUBLICO_TTL
          ? memHit.data
          : null;

      if (!perfilData) {
        // Intentar desde session_cache de Dexie (~5ms, offline-ready)
        try {
          const row = await db?.session_cache?.get(
            `perfil_publico:${username}`,
          );
          if (row && Date.now() - row.updated_at < PERFIL_PUBLICO_TTL) {
            perfilData = row.value as PerfilData;
            _perfilPublicoCache.set(username, {
              data: perfilData,
              ts: Date.now(),
            });
          }
        } catch {}
      }

      if (!perfilData) {
        // Supabase como último recurso
        const { data } = await supabase
          .from("perfiles")
          .select(
            "id, username, status, avatar_url, descripcion, titulo, personajes:personaje_favorito_id(id, nombre, img_url), mascota:mascota_id(id, nombre, imagen_url)",
          )
          .eq("username", username)
          .maybeSingle();

        if (!data) {
          setNotFound(true);
          setCargando(false);
          return;
        }
        perfilData = data as unknown as PerfilData;
        _perfilPublicoCache.set(username, { data: perfilData, ts: Date.now() });
        try {
          await db?.session_cache?.put({
            key: `perfil_publico:${username}`,
            value: perfilData,
            updated_at: Date.now(),
          });
        } catch {}
      }

      setPerfil(perfilData);
      const uid = perfilData.id;

      // ── Paso 2: todo el contenido en paralelo con caché Dexie ────────────
      // Las mismas funciones que usa personal.tsx → si el usuario vio su
      // propio perfil antes, los datos ya están en caché y llegan al instante.
      const [descData, reinosCiudadesData, invData] = await Promise.all([
        loadDescubrimientos(uid, (fresh) =>
          setDescubrimientos(fresh as Descubrimiento[]),
        ),
        loadReinosCiudadesUsuario(uid, (r, c) => {
          setReinos(r);
          setCiudades(c);
        }),
        loadInventarioUsuario(uid, (fresh) =>
          setInventario(fresh as ItemInventario[]),
        ),
      ]);

      if (descData.length) setDescubrimientos(descData as Descubrimiento[]);
      if (reinosCiudadesData.reinos.length)
        setReinos(reinosCiudadesData.reinos);
      if (reinosCiudadesData.ciudades.length)
        setCiudades(reinosCiudadesData.ciudades);
      if (invData.length) setInventario(invData as ItemInventario[]);

      // ── Paso 3: sidebar de exploradores (baja prioridad) ─────────────────
      loadPerfilesResumen(uid, setOtrosPerfiles)
        .then(setOtrosPerfiles)
        .catch(() => {});

      setCargando(false);
    }

    void cargar();
  }, [username]);

  const misPersonajes = descubrimientos.filter((d) => d.tipo === "personaje");
  const misCriaturas = descubrimientos.filter((d) => d.tipo === "criatura");
  const misItemsDesc = descubrimientos.filter((d) => d.tipo === "item");

  const handleOpenPersonajeModal = async (d: Descubrimiento) => {
    setCancionesPersonaje([]);
    setModalPersonaje(d);
    if (!d.entidad_id) return;
    setCargandoCanciones(true);
    try {
      // Cacheado: segunda visita al mismo personaje es instantánea
      const data = await loadCancionesPersonaje(d.entidad_id);
      setCancionesPersonaje(data);
    } catch (err) {
      console.warn("[PersonalUsername] Error cargando canciones:", err);
    } finally {
      setCargandoCanciones(false);
    }
  };

  const tabs = [
    { id: "personajes", label: "Agenda", icon: User },
    { id: "criaturas", label: "Bestiario", icon: Cat },
    { id: "items", label: "Inventario", icon: Sword },
    { id: "reinos", label: "Mapa", icon: MapPin },
  ] as const;

  /* ── Loading ── */
  if (cargando)
    return (
      <div className="flex items-center justify-center min-h-60">
        <div className="flex flex-col items-center gap-3">
          <Loader2
            className="animate-spin"
            size={20}
            style={{
              color: "color-mix(in srgb, var(--primary) 30%, transparent)",
            }}
          />
          <span
            className="text-micro font-black uppercase tracking-[0.3em]"
            style={{
              color: "color-mix(in srgb, var(--primary) 30%, transparent)",
            }}
          >
            Cargando perfil…
          </span>
        </div>
      </div>
    );

  /* ── Not found ── */
  if (notFound)
    return (
      <div className="flex flex-col items-center justify-center min-h-60 gap-4">
        <p
          className="font-serif italic"
          style={{
            fontSize: "0.9rem",
            color: "color-mix(in srgb, var(--primary) 30%, transparent)",
          }}
        >
          &quot;Explorador no encontrado&quot;
        </p>
        <Link
          className="font-serif italic text-micro flex items-center gap-1.5 hover:opacity-70"
          href="/garlia/personal"
          style={{ color: "var(--primary)" }}
        >
          ← Volver a mi perfil
        </Link>
      </div>
    );

  return (
    <>
      {/* Modales: items, criaturas, ciudades */}
      {modalD && modalD.tipo !== "reino" && (
        <ModalDetalle entidad={modalD} onClose={() => setModalD(null)} />
      )}

      {/* Modal custom para reinos con ciudades */}
      <AnimatePresence>
        {modalD && modalD.tipo === "reino" && (
          <>
            <MotionDiv
              animate={{ opacity: 1 }}
              className="fixed inset-0 z-40 backdrop-blur-sm"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              style={{ background: "rgba(0,0,0,0.45)" }}
              onClick={() => {
                setModalD(null);
                setCiudadesReino([]);
              }}
            />
            <MotionDiv
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 md:inset-x-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[30rem]"
              exit={{ opacity: 0, scale: 0.94, y: 24 }}
              initial={{ opacity: 0, scale: 0.94, y: 24 }}
              style={{
                background: "var(--white-custom)",
                borderRadius: "var(--radius-card)",
                border:
                  "1px solid color-mix(in srgb, var(--primary) 12%, transparent)",
                boxShadow:
                  "0 24px 64px color-mix(in srgb, var(--primary) 18%, transparent), 0 4px 16px color-mix(in srgb, var(--primary) 10%, transparent)",
                maxHeight: "88dvh",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
              transition={{ type: "spring", stiffness: 340, damping: 30 }}
            >
              <div
                className="w-full shrink-0 overflow-hidden relative"
                style={{
                  height:
                    modalD.data.imagen_url || modalD.data.img_url
                      ? "220px"
                      : "80px",
                  background:
                    "color-mix(in srgb, var(--primary) 6%, var(--bg-main))",
                }}
              >
                {modalD.data.imagen_url && (
                  <img
                    alt={modalD.data.nombre}
                    className="w-full h-full object-cover"
                    src={modalD.data.imagen_url}
                    style={{ opacity: 0.35 }}
                  />
                )}
                {modalD.data.img_url && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <img
                      alt={`Logo ${modalD.data.nombre}`}
                      className="object-contain drop-shadow-lg transition-transform duration-700 hover:scale-105"
                      src={modalD.data.img_url}
                      style={{ maxHeight: "140px", maxWidth: "60%" }}
                    />
                  </div>
                )}
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(to top, var(--white-custom) 0%, color-mix(in srgb, var(--white-custom) 20%, transparent) 50%, transparent 100%)",
                  }}
                />
                <button
                  className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center transition-all hover:scale-110"
                  style={{
                    color: "var(--primary)",
                    background:
                      "color-mix(in srgb, var(--white-custom) 85%, transparent)",
                    borderRadius: "var(--radius-btn)",
                    border:
                      "1px solid color-mix(in srgb, var(--primary) 12%, transparent)",
                    backdropFilter: "blur(6px)",
                  }}
                  onClick={() => {
                    setModalD(null);
                    setCiudadesReino([]);
                  }}
                >
                  <X size={13} />
                </button>
                {(modalD.data.imagen_url || modalD.data.img_url) && (
                  <div className="absolute bottom-0 left-0 right-0 px-6 pb-4">
                    <h2
                      className="font-serif italic capitalize leading-tight"
                      style={{
                        fontSize: "1.75rem",
                        color: "var(--primary)",
                        lineHeight: 1.15,
                      }}
                    >
                      {modalD.data.nombre ?? "Reino"}
                    </h2>
                  </div>
                )}
              </div>

              <div
                className="overflow-y-auto flex-1 px-6 pb-6"
                style={{ paddingTop: "1.25rem" }}
              >
                {!modalD.data.imagen_url && !modalD.data.img_url && (
                  <h2
                    className="font-serif italic capitalize leading-tight mb-4"
                    style={{ fontSize: "1.75rem", color: "var(--primary)" }}
                  >
                    {modalD.data.nombre ?? "Reino"}
                  </h2>
                )}
                {modalD.data.descripcion && (
                  <p
                    className="font-serif italic leading-relaxed mb-5"
                    style={{
                      fontSize: "0.88rem",
                      color:
                        "color-mix(in srgb, var(--foreground) 68%, transparent)",
                      lineHeight: 1.7,
                    }}
                  >
                    {modalD.data.descripcion}
                  </p>
                )}

                {ciudadesReino.length > 0 && (
                  <>
                    <div className="flex items-center gap-3 mb-4">
                      <div
                        className="flex-1 h-px"
                        style={{
                          background:
                            "color-mix(in srgb, var(--primary) 8%, transparent)",
                        }}
                      />
                      <div className="flex items-center gap-1.5">
                        <MapPin
                          size={10}
                          style={{
                            color:
                              "color-mix(in srgb, var(--primary) 28%, transparent)",
                          }}
                        />
                        <span
                          className="font-serif italic text-micro font-black uppercase tracking-widest"
                          style={{
                            color:
                              "color-mix(in srgb, var(--primary) 28%, transparent)",
                          }}
                        >
                          Ciudades
                        </span>
                      </div>
                      <div
                        className="flex-1 h-px"
                        style={{
                          background:
                            "color-mix(in srgb, var(--primary) 8%, transparent)",
                        }}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      {ciudadesReino.map((lugar, i) => (
                        <button
                          key={lugar.id ?? i}
                          className="group flex items-center gap-3 px-3 py-3 transition-all text-left w-full"
                          style={{
                            background:
                              "color-mix(in srgb, var(--primary) 3%, var(--white-custom))",
                            border:
                              "1px solid color-mix(in srgb, var(--primary) 8%, transparent)",
                            borderRadius: "var(--radius-btn)",
                          }}
                          onClick={() => {
                            setModalD(null);
                            setCiudadesReino([]);
                            setTimeout(
                              () =>
                                setModalD({
                                  tipo: "ciudad",
                                  data: {
                                    tipo: "item",
                                    entidad_id: lugar.id,
                                    nombre: lugar.nombre,
                                    imagen_url: lugar.imagen_url ?? undefined,
                                    descripcion: lugar.descripcion ?? undefined,
                                    fecha_descubrimiento: "",
                                  },
                                }),
                              120,
                            );
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.borderColor =
                              "color-mix(in srgb, var(--primary) 22%, transparent)";
                            (e.currentTarget as HTMLElement).style.background =
                              "color-mix(in srgb, var(--primary) 6%, var(--white-custom))";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.borderColor =
                              "color-mix(in srgb, var(--primary) 8%, transparent)";
                            (e.currentTarget as HTMLElement).style.background =
                              "color-mix(in srgb, var(--primary) 3%, var(--white-custom))";
                          }}
                        >
                          {lugar.imagen_url ? (
                            <div
                              className="w-11 h-11 shrink-0 overflow-hidden"
                              style={{
                                borderRadius: "var(--radius-btn)",
                                background:
                                  "color-mix(in srgb, var(--primary) 8%, transparent)",
                              }}
                            >
                              <img
                                alt={lugar.nombre}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                src={lugar.imagen_url}
                              />
                            </div>
                          ) : (
                            <div
                              className="w-11 h-11 shrink-0 flex items-center justify-center"
                              style={{
                                borderRadius: "var(--radius-btn)",
                                background:
                                  "color-mix(in srgb, var(--primary) 6%, transparent)",
                              }}
                            >
                              <MapPin
                                size={14}
                                style={{
                                  color:
                                    "color-mix(in srgb, var(--primary) 30%, transparent)",
                                }}
                              />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <span
                              className="font-serif italic text-sm truncate block group-hover:underline"
                              style={{ color: "var(--primary)" }}
                            >
                              {lugar.nombre}
                            </span>
                            {lugar.descripcion && (
                              <span
                                className="text-micro font-black uppercase tracking-wider truncate block mt-0.5"
                                style={{
                                  color:
                                    "color-mix(in srgb, var(--primary) 35%, transparent)",
                                }}
                              >
                                {lugar.descripcion.slice(0, 60)}
                                {lugar.descripcion.length > 60 ? "…" : ""}
                              </span>
                            )}
                          </div>
                          <ChevronRight
                            className="group-hover:translate-x-0.5 transition-transform"
                            size={13}
                            style={{
                              color:
                                "color-mix(in srgb, var(--primary) 25%, transparent)",
                              flexShrink: 0,
                            }}
                          />
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </MotionDiv>
          </>
        )}
      </AnimatePresence>

      {/* Modal personaje */}
      <AnimatePresence>
        {modalPersonaje && (
          <>
            <MotionDiv
              animate={{ opacity: 1 }}
              className="fixed inset-0 z-40 backdrop-blur-sm"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              style={{ background: "rgba(0,0,0,0.45)" }}
              onClick={() => {
                setModalPersonaje(null);
                setCancionesPersonaje([]);
              }}
            />
            <MotionDiv
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 md:inset-x-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[30rem]"
              exit={{ opacity: 0, scale: 0.94, y: 24 }}
              initial={{ opacity: 0, scale: 0.94, y: 24 }}
              style={{
                background: "var(--white-custom)",
                borderRadius: "var(--radius-card)",
                border:
                  "1px solid color-mix(in srgb, var(--primary) 12%, transparent)",
                boxShadow:
                  "0 24px 64px color-mix(in srgb, var(--primary) 18%, transparent)",
                maxHeight: "88dvh",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
              transition={{ type: "spring", stiffness: 340, damping: 30 }}
            >
              {/* Hero imagen */}
              <div
                className="w-full shrink-0 overflow-hidden relative"
                style={{
                  height: modalPersonaje.imagen_url ? "220px" : "0px",
                  background:
                    "color-mix(in srgb, var(--primary) 5%, var(--bg-main))",
                }}
              >
                {modalPersonaje.imagen_url && (
                  <img
                    alt={modalPersonaje.nombre}
                    className="w-full h-full object-cover transition-transform duration-700"
                    src={modalPersonaje.imagen_url}
                    style={{
                      objectPosition: "center center",
                      transform: "scale(1.8)",
                      transformOrigin: "center center",
                    }}
                  />
                )}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      "linear-gradient(to top, var(--white-custom) 0%, color-mix(in srgb, var(--white-custom) 15%, transparent) 45%, transparent 100%)",
                  }}
                />
                <button
                  className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center transition-all hover:scale-110"
                  style={{
                    color: "var(--primary)",
                    background:
                      "color-mix(in srgb, var(--white-custom) 85%, transparent)",
                    borderRadius: "var(--radius-btn)",
                    border:
                      "1px solid color-mix(in srgb, var(--primary) 12%, transparent)",
                    backdropFilter: "blur(6px)",
                  }}
                  onClick={() => {
                    setModalPersonaje(null);
                    setCancionesPersonaje([]);
                  }}
                >
                  <X size={13} />
                </button>
                {modalPersonaje.imagen_url && (
                  <div className="absolute bottom-0 left-0 right-0 px-6 pb-4">
                    <h2
                      className="font-serif italic capitalize leading-tight"
                      style={{
                        fontSize: "1.75rem",
                        color: "var(--primary)",
                        lineHeight: 1.15,
                      }}
                    >
                      {modalPersonaje.nombre ?? "Personaje"}
                    </h2>
                    {(modalPersonaje.reino || modalPersonaje.especie) && (
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        {modalPersonaje.reino && (
                          <span
                            className="font-serif italic text-micro px-2 py-0.5"
                            style={{
                              background:
                                "color-mix(in srgb, var(--primary) 8%, transparent)",
                              border:
                                "1px solid color-mix(in srgb, var(--primary) 14%, transparent)",
                              borderRadius: "var(--radius-btn)",
                              color:
                                "color-mix(in srgb, var(--primary) 55%, transparent)",
                            }}
                          >
                            {modalPersonaje.reino}
                          </span>
                        )}
                        {modalPersonaje.especie && (
                          <span
                            className="font-serif italic text-micro px-2 py-0.5"
                            style={{
                              background:
                                "color-mix(in srgb, var(--primary) 8%, transparent)",
                              border:
                                "1px solid color-mix(in srgb, var(--primary) 14%, transparent)",
                              borderRadius: "var(--radius-btn)",
                              color:
                                "color-mix(in srgb, var(--primary) 55%, transparent)",
                            }}
                          >
                            {modalPersonaje.especie}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Contenido scrollable */}
              <div
                className="overflow-y-auto flex-1 px-6 pb-6"
                style={{ paddingTop: "1.25rem" }}
              >
                {!modalPersonaje.imagen_url && (
                  <>
                    <button
                      className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center transition-all hover:scale-110"
                      style={{
                        color: "var(--primary)",
                        background:
                          "color-mix(in srgb, var(--white-custom) 85%, transparent)",
                        borderRadius: "var(--radius-btn)",
                        border:
                          "1px solid color-mix(in srgb, var(--primary) 12%, transparent)",
                      }}
                      onClick={() => {
                        setModalPersonaje(null);
                        setCancionesPersonaje([]);
                      }}
                    >
                      <X size={13} />
                    </button>
                    <div className="mb-4">
                      <h2
                        className="font-serif italic capitalize leading-tight mb-2"
                        style={{ fontSize: "1.75rem", color: "var(--primary)" }}
                      >
                        {modalPersonaje.nombre ?? "Personaje"}
                      </h2>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {modalPersonaje.reino && (
                          <span
                            className="font-serif italic text-micro px-2 py-0.5"
                            style={{
                              background:
                                "color-mix(in srgb, var(--primary) 6%, transparent)",
                              border:
                                "1px solid color-mix(in srgb, var(--primary) 12%, transparent)",
                              borderRadius: "var(--radius-btn)",
                              color:
                                "color-mix(in srgb, var(--primary) 50%, transparent)",
                            }}
                          >
                            {modalPersonaje.reino}
                          </span>
                        )}
                        {modalPersonaje.especie && (
                          <span
                            className="font-serif italic text-micro px-2 py-0.5"
                            style={{
                              background:
                                "color-mix(in srgb, var(--primary) 6%, transparent)",
                              border:
                                "1px solid color-mix(in srgb, var(--primary) 12%, transparent)",
                              borderRadius: "var(--radius-btn)",
                              color:
                                "color-mix(in srgb, var(--primary) 50%, transparent)",
                            }}
                          >
                            {modalPersonaje.especie}
                          </span>
                        )}
                      </div>
                    </div>
                  </>
                )}
                {modalPersonaje.descripcion && (
                  <p
                    className="font-serif italic leading-relaxed mb-5"
                    style={{
                      fontSize: "0.88rem",
                      color:
                        "color-mix(in srgb, var(--foreground) 68%, transparent)",
                      lineHeight: 1.7,
                    }}
                  >
                    {modalPersonaje.descripcion}
                  </p>
                )}
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="flex-1 h-px"
                    style={{
                      background:
                        "color-mix(in srgb, var(--primary) 8%, transparent)",
                    }}
                  />
                  <div className="flex items-center gap-1.5">
                    <Music2
                      size={10}
                      style={{
                        color:
                          "color-mix(in srgb, var(--primary) 28%, transparent)",
                      }}
                    />
                    <span
                      className="font-serif italic text-micro font-black uppercase tracking-widest"
                      style={{
                        color:
                          "color-mix(in srgb, var(--primary) 28%, transparent)",
                      }}
                    >
                      Canciones
                    </span>
                  </div>
                  <div
                    className="flex-1 h-px"
                    style={{
                      background:
                        "color-mix(in srgb, var(--primary) 8%, transparent)",
                    }}
                  />
                </div>
                {cargandoCanciones ? (
                  <div className="flex items-center gap-2 py-5 justify-center">
                    <Loader2
                      className="animate-spin"
                      size={13}
                      style={{
                        color:
                          "color-mix(in srgb, var(--primary) 30%, transparent)",
                      }}
                    />
                    <span
                      className="font-serif italic text-micro"
                      style={{
                        color:
                          "color-mix(in srgb, var(--primary) 30%, transparent)",
                      }}
                    >
                      Cargando canciones…
                    </span>
                  </div>
                ) : cancionesPersonaje.length === 0 ? (
                  <p
                    className="font-serif italic text-micro py-4 text-center"
                    style={{
                      color:
                        "color-mix(in srgb, var(--primary) 20%, transparent)",
                    }}
                  >
                    &quot;Este personaje no tiene canciones aún…&quot;
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {cancionesPersonaje.map((cancion, i) => (
                      <Link
                        key={cancion.id ?? i}
                        className="group flex items-center gap-3 px-3 py-3 transition-all"
                        href={`/garlia/canciones/${cancion.id}`}
                        onClick={(e) => {
                          if (estaEnTauri()) {
                            e.preventDefault();
                            navegarRutaDinamica(`/garlia/canciones/${cancion.id}`);
                          }
                        }}
                        style={{
                          background:
                            "color-mix(in srgb, var(--primary) 3%, var(--white-custom))",
                          border:
                            "1px solid color-mix(in srgb, var(--primary) 8%, transparent)",
                          borderRadius: "var(--radius-btn)",
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.borderColor =
                            "color-mix(in srgb, var(--primary) 22%, transparent)";
                          (e.currentTarget as HTMLElement).style.background =
                            "color-mix(in srgb, var(--primary) 6%, var(--white-custom))";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.borderColor =
                            "color-mix(in srgb, var(--primary) 8%, transparent)";
                          (e.currentTarget as HTMLElement).style.background =
                            "color-mix(in srgb, var(--primary) 3%, var(--white-custom))";
                        }}
                      >
                        {cancion.portada_url &&
                        !cancion.portada_url.includes("placeholder") ? (
                          <div
                            className="w-11 h-11 shrink-0 overflow-hidden"
                            style={{
                              borderRadius: "var(--radius-btn)",
                              background:
                                "color-mix(in srgb, var(--primary) 8%, transparent)",
                            }}
                          >
                            <Image
                              alt={cancion.titulo}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              src={cancion.portada_url}
                            />
                          </div>
                        ) : (
                          <div
                            className="w-11 h-11 shrink-0 flex items-center justify-center"
                            style={{
                              borderRadius: "var(--radius-btn)",
                              background:
                                "color-mix(in srgb, var(--primary) 6%, transparent)",
                            }}
                          >
                            <Music2
                              size={14}
                              style={{
                                color:
                                  "color-mix(in srgb, var(--primary) 30%, transparent)",
                              }}
                            />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <span
                            className="font-serif italic text-sm truncate block group-hover:underline"
                            style={{ color: "var(--primary)" }}
                          >
                            {cancion.titulo ?? `Canción ${i + 1}`}
                          </span>
                          {cancion.info_cancion && (
                            <p
                              className="font-serif italic text-micro truncate mt-0.5"
                              style={{
                                color:
                                  "color-mix(in srgb, var(--foreground) 45%, transparent)",
                              }}
                            >
                              {cancion.info_cancion}
                            </p>
                          )}
                        </div>
                        <ChevronRight
                          className="group-hover:translate-x-0.5 transition-transform"
                          size={12}
                          style={{
                            color:
                              "color-mix(in srgb, var(--primary) 25%, transparent)",
                            flexShrink: 0,
                          }}
                        />
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </MotionDiv>
          </>
        )}
      </AnimatePresence>

      {/* Botón volver */}
      <Link
        className="fixed top-4 left-4 z-[100] flex items-center justify-center w-9 h-9 transition-all hover:scale-110"
        href="/garlia/personal"
        style={{
          background: "var(--bg-menu)",
          borderRadius: "50%",
          border:
            "2px solid color-mix(in srgb, var(--menu-text) 20%, transparent)",
          boxShadow: "var(--shadow-card)",
        }}
        title="Volver a mi perfil"
      >
        <X size={14} style={{ color: "var(--menu-text)", opacity: 0.7 }} />
      </Link>

      {/* ═══════════════════════════════════════════
          HERO HEADER
      ═══════════════════════════════════════════ */}
      <div className="w-full animate-in fade-in duration-500">
        <div
          className="relative w-full overflow-hidden"
          style={{
            height: 96,
            background:
              "linear-gradient(135deg, color-mix(in srgb, var(--primary) 18%, var(--bg-main)) 0%, color-mix(in srgb, var(--primary) 8%, var(--bg-main)) 60%, color-mix(in srgb, var(--primary) 4%, var(--bg-main)) 100%)",
            borderBottom:
              "1px solid color-mix(in srgb, var(--primary) 10%, transparent)",
          }}
        >
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div
              className="absolute -top-8 -right-8 w-48 h-48 rounded-full opacity-[0.06]"
              style={{ background: "var(--primary)" }}
            />
            <div
              className="absolute top-2 right-1/4 w-24 h-24 rounded-full opacity-[0.04]"
              style={{ background: "var(--primary)" }}
            />
            <div
              className="absolute -bottom-6 left-1/3 w-32 h-32 rounded-full opacity-[0.04]"
              style={{ background: "var(--primary)" }}
            />
          </div>
        </div>

        {/* Zona identidad */}
        <div
          className="px-6 md:px-10 flex items-end gap-5 md:gap-7"
          style={{ marginTop: "-52px", paddingBottom: "20px" }}
        >
          <div
            className="relative shrink-0"
            style={{
              width: 104,
              height: 104,
              borderRadius: "50%",
              overflow: "hidden",
              background:
                "color-mix(in srgb, var(--primary) 8%, var(--bg-main))",
              border: "3px solid var(--bg-main)",
              boxShadow:
                "0 4px 20px color-mix(in srgb, var(--primary) 14%, transparent)",
              flexShrink: 0,
            }}
          >
            {perfil?.avatar_url ? (
              <Image
                alt={perfil?.username}
                className="w-full h-full object-contain"
                src={perfil.avatar_url}
              />
            ) : (
              <User
                className="absolute inset-0 m-auto"
                size={38}
                style={{
                  color: "color-mix(in srgb, var(--primary) 22%, transparent)",
                }}
              />
            )}
          </div>

          <div
            className="flex flex-col gap-1 pb-1"
            style={{ paddingTop: "56px" }}
          >
            <h1
              className="font-serif italic leading-none capitalize"
              style={{
                fontSize: "1.65rem",
                color: "var(--primary)",
                letterSpacing: "0.01em",
              }}
            >
              {perfil?.username}
            </h1>
            {perfil?.titulo && (
              <p
                className="text-micro font-black uppercase tracking-[0.28em]"
                style={{
                  color: "color-mix(in srgb, var(--primary) 38%, transparent)",
                }}
              >
                {perfil.titulo}
              </p>
            )}
            <p
              className="font-serif italic text-micro"
              style={{
                color: "color-mix(in srgb, var(--primary) 45%, transparent)",
              }}
            >
              {perfil?.status ?? "Explorador"}
            </p>
          </div>
        </div>

        {/* Separador decorativo */}
        <div className="px-6 md:px-10 flex items-center gap-3 mb-4">
          <div
            className="flex-1 h-px"
            style={{
              background: "color-mix(in srgb, var(--primary) 8%, transparent)",
            }}
          />
          <span
            className="text-base"
            style={{
              color: "color-mix(in srgb, var(--primary) 14%, transparent)",
            }}
          >
            ⚝
          </span>
          <div
            className="flex-1 h-px"
            style={{
              background: "color-mix(in srgb, var(--primary) 8%, transparent)",
            }}
          />
        </div>
      </div>

      {/* ═══════════════════════
          CONTENIDO PRINCIPAL
      ═══════════════════════ */}
      <div className="w-full max-w-7xl mx-auto pb-20">
        <div className="flex items-center gap-4 py-3 px-2">
          <div
            className="flex-1 h-px"
            style={{
              background: "color-mix(in srgb, var(--primary) 10%, transparent)",
            }}
          />
          <span
            className="font-serif italic text-micro select-none"
            style={{
              color: "color-mix(in srgb, var(--primary) 28%, transparent)",
            }}
          >
            {inventario.length +
              misItemsDesc.length +
              misCriaturas.length +
              misPersonajes.length}{" "}
            descubrimientos
          </span>
          <div
            className="flex-1 h-px"
            style={{
              background: "color-mix(in srgb, var(--primary) 10%, transparent)",
            }}
          />
        </div>

        <div className="flex flex-col md:flex-row gap-6 items-start mt-2 px-4 md:px-8">
          {/* ── LEFT SIDEBAR ── */}
          <div className="w-full md:w-64 xl:w-72 shrink-0 md:sticky md:top-16 self-start flex flex-col gap-4 animate-in fade-in duration-500">
            <div
              className="overflow-hidden"
              style={{
                background: "var(--white-custom)",
                borderRadius: "var(--radius-card)",
                border:
                  "1px solid color-mix(in srgb, var(--primary) 12%, transparent)",
              }}
            >
              {/* Stats HUD — Registro */}
              <div className="px-5 pt-5 pb-4">
                <div className="flex items-center gap-2 mb-4">
                  <div
                    className="flex-1 h-px"
                    style={{
                      background:
                        "color-mix(in srgb, var(--primary) 8%, transparent)",
                    }}
                  />
                  <p
                    className="text-micro font-black uppercase tracking-[0.3em]"
                    style={{
                      color:
                        "color-mix(in srgb, var(--primary) 28%, transparent)",
                    }}
                  >
                    Registro
                  </p>
                  <div
                    className="flex-1 h-px"
                    style={{
                      background:
                        "color-mix(in srgb, var(--primary) 8%, transparent)",
                    }}
                  />
                </div>
                <div className="space-y-3.5">
                  {[
                    {
                      icon: <User size={10} />,
                      label: "Amigos",
                      count: misPersonajes.length,
                      max: 20,
                    },
                    {
                      icon: <Cat size={10} />,
                      label: "Criaturas",
                      count: misCriaturas.length,
                      max: 30,
                    },
                    {
                      icon: <Sword size={10} />,
                      label: "Objetos",
                      count: inventario.length + misItemsDesc.length,
                      max: 50,
                    },
                    {
                      icon: <MapPin size={10} />,
                      label: "Ciudades",
                      count: reinos.length + ciudades.length,
                      max: 30,
                    },
                  ].map(({ icon, label, count, max }) => (
                    <div key={label}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div
                          className="flex items-center gap-1.5"
                          style={{
                            color:
                              "color-mix(in srgb, var(--primary) 40%, transparent)",
                          }}
                        >
                          {icon}
                          <span className="text-micro font-black uppercase tracking-wider">
                            {label}
                          </span>
                        </div>
                        <span
                          className="text-sm font-black tabular-nums"
                          style={{ color: "var(--primary)" }}
                        >
                          {count}
                        </span>
                      </div>
                      <div className="flex gap-0.5">
                        {Array.from({ length: 10 }).map((_, i) => (
                          <div
                            key={i}
                            className="flex-1 h-1 transition-all duration-700"
                            style={{
                              background:
                                i < Math.round((count / max) * 10)
                                  ? "color-mix(in srgb, var(--primary) 55%, transparent)"
                                  : "color-mix(in srgb, var(--primary) 8%, transparent)",
                              borderRadius: "1px",
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div
                style={{
                  height: "1px",
                  background:
                    "color-mix(in srgb, var(--primary) 8%, transparent)",
                }}
              />

              {/* Sobre mí */}
              <div>
                <div className="flex items-center gap-2 px-5 pt-4 pb-2">
                  <Star
                    size={8}
                    style={{
                      color:
                        "color-mix(in srgb, var(--primary) 30%, transparent)",
                    }}
                  />
                  <p
                    className="text-micro font-black uppercase tracking-[0.22em]"
                    style={{
                      color:
                        "color-mix(in srgb, var(--primary) 40%, transparent)",
                    }}
                  >
                    Sobre mí
                  </p>
                </div>
                <div className="px-5 pb-5">
                  {perfil?.descripcion ? (
                    <p
                      className="font-serif italic leading-relaxed"
                      style={{
                        fontSize: "0.85rem",
                        color:
                          "color-mix(in srgb, var(--foreground) 70%, transparent)",
                        lineHeight: 1.65,
                      }}
                    >
                      {perfil.descripcion}
                    </p>
                  ) : (
                    <p
                      className="font-serif italic"
                      style={{
                        fontSize: "0.82rem",
                        color:
                          "color-mix(in srgb, var(--primary) 20%, transparent)",
                      }}
                    >
                      &quot;Sin descripción aún…&quot;
                    </p>
                  )}
                </div>
              </div>

              <div
                style={{
                  height: "1px",
                  background:
                    "color-mix(in srgb, var(--primary) 8%, transparent)",
                }}
              />

              {/* Favoritos */}
              <div className="grid grid-cols-2">
                <div className="text-left px-4 py-4">
                  <div className="flex items-center gap-1 mb-2.5">
                    <Star
                      size={7}
                      style={{
                        color:
                          "color-mix(in srgb, var(--primary) 25%, transparent)",
                      }}
                    />
                    <p
                      className="text-micro font-black uppercase tracking-[0.18em]"
                      style={{
                        color:
                          "color-mix(in srgb, var(--primary) 32%, transparent)",
                      }}
                    >
                      Fav. personaje
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5">
                    {perfil?.personaje_favorito ? (
                      <>
                        <div
                          className="w-10 h-10 shrink-0 overflow-hidden"
                          style={{
                            borderRadius: "var(--radius-btn)",
                            background:
                              "color-mix(in srgb, var(--primary) 4%, transparent)",
                            border:
                              "1px solid color-mix(in srgb, var(--primary) 12%, transparent)",
                          }}
                        >
                          {perfil.personaje_favorito.img_url ? (
                            <Image
                              alt={perfil.personaje_favorito.nombre}
                              className="w-full h-full object-contain"
                              src={perfil.personaje_favorito.img_url}
                            />
                          ) : (
                            <User
                              className="m-auto mt-1.5"
                              size={16}
                              style={{
                                color:
                                  "color-mix(in srgb, var(--primary) 22%, transparent)",
                              }}
                            />
                          )}
                        </div>
                        <p
                          className="font-serif italic text-micro leading-tight capitalize"
                          style={{ color: "var(--primary)" }}
                        >
                          {perfil.personaje_favorito.nombre}
                        </p>
                      </>
                    ) : (
                      <p
                        className="font-serif italic text-micro"
                        style={{
                          color:
                            "color-mix(in srgb, var(--primary) 18%, transparent)",
                        }}
                      >
                        Ninguno…
                      </p>
                    )}
                  </div>
                </div>

                <div
                  className="text-left px-4 py-4"
                  style={{
                    borderLeft:
                      "1px solid color-mix(in srgb, var(--primary) 8%, transparent)",
                  }}
                >
                  <div className="flex items-center gap-1 mb-2.5">
                    <Star
                      size={7}
                      style={{
                        color:
                          "color-mix(in srgb, var(--primary) 25%, transparent)",
                      }}
                    />
                    <p
                      className="text-micro font-black uppercase tracking-[0.18em]"
                      style={{
                        color:
                          "color-mix(in srgb, var(--primary) 32%, transparent)",
                      }}
                    >
                      Mascota
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5">
                    {perfil?.mascota ? (
                      <>
                        <div
                          className="w-10 h-10 shrink-0 overflow-hidden"
                          style={{
                            borderRadius: "var(--radius-btn)",
                            background:
                              "color-mix(in srgb, var(--primary) 4%, transparent)",
                            border:
                              "1px solid color-mix(in srgb, var(--primary) 12%, transparent)",
                          }}
                        >
                          {perfil.mascota.imagen_url ? (
                            <Image
                              alt={perfil.mascota.nombre}
                              className="w-full h-full object-contain"
                              src={perfil.mascota.imagen_url}
                            />
                          ) : (
                            <Cat
                              className="m-auto mt-1.5"
                              size={16}
                              style={{
                                color:
                                  "color-mix(in srgb, var(--primary) 22%, transparent)",
                              }}
                            />
                          )}
                        </div>
                        <p
                          className="font-serif italic text-micro leading-tight capitalize"
                          style={{ color: "var(--primary)" }}
                        >
                          {perfil.mascota.nombre}
                        </p>
                      </>
                    ) : (
                      <p
                        className="font-serif italic text-micro"
                        style={{
                          color:
                            "color-mix(in srgb, var(--primary) 18%, transparent)",
                        }}
                      >
                        Ninguna…
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile explorers */}
            {otrosPerfiles.length > 0 && (
              <div className="lg:hidden">
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="flex-1 h-px"
                    style={{
                      background:
                        "color-mix(in srgb, var(--primary) 8%, transparent)",
                    }}
                  />
                  <p
                    className="text-micro font-black uppercase tracking-[0.25em] flex items-center gap-1.5"
                    style={{
                      color:
                        "color-mix(in srgb, var(--primary) 30%, transparent)",
                    }}
                  >
                    <Users size={8} /> Exploradores
                  </p>
                  <div
                    className="flex-1 h-px"
                    style={{
                      background:
                        "color-mix(in srgb, var(--primary) 8%, transparent)",
                    }}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {otrosPerfiles.map((p) => (
                    <Link
                      key={p.id}
                      href={`/garlia/personal/${p.username}`}
                      onClick={(e) => {
                        if (estaEnTauri()) {
                          e.preventDefault();
                          navegarRutaDinamica(`/garlia/personal/${p.username}`);
                        }
                      }}
                    >
                      <div
                        className="flex items-center gap-2 px-3 py-2 transition-all hover:opacity-80"
                        style={{
                          background:
                            "color-mix(in srgb, var(--primary) 4%, var(--white-custom))",
                          border:
                            "1px solid color-mix(in srgb, var(--primary) 12%, transparent)",
                          borderRadius: "2px",
                        }}
                      >
                        <div
                          className="w-5 h-5 shrink-0 overflow-hidden flex items-center justify-center"
                          style={{
                            borderRadius: "50%",
                            background:
                              "color-mix(in srgb, var(--primary) 8%, transparent)",
                          }}
                        >
                          {p.avatar_url ? (
                            <Image
                              alt={p.username}
                              className="w-full h-full object-contain"
                              src={p.avatar_url}
                            />
                          ) : (
                            <User
                              size={9}
                              style={{
                                color:
                                  "color-mix(in srgb, var(--primary) 22%, transparent)",
                              }}
                            />
                          )}
                        </div>
                        <span
                          className="text-micro font-black uppercase tracking-wide capitalize"
                          style={{ color: "var(--primary)" }}
                        >
                          {p.username}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── MAIN CONTENT ── */}
          <div className="flex flex-col md:flex-row gap-6 w-full min-w-0 items-start">
            {/* ── Colección: tabs + grid ── */}
            <div className="w-full md:flex-1 md:min-w-0 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
              {/* Mobile tabs */}
              <div
                className="flex md:hidden w-full"
                style={{
                  borderBottom:
                    "1px solid color-mix(in srgb, var(--primary) 12%, transparent)",
                }}
              >
                {tabs.map((t) => {
                  const isActive = tab === t.id;
                  return (
                    <button
                      key={t.id}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 transition-all duration-200"
                      style={{
                        background: isActive
                          ? "color-mix(in srgb, var(--primary) 2%, var(--bg-main))"
                          : "transparent",
                        color: isActive
                          ? "var(--primary)"
                          : "color-mix(in srgb, var(--primary) 35%, transparent)",
                        borderTop: isActive
                          ? "1px solid color-mix(in srgb, var(--primary) 14%, transparent)"
                          : "1px solid transparent",
                        borderLeft: isActive
                          ? "1px solid color-mix(in srgb, var(--primary) 14%, transparent)"
                          : "1px solid transparent",
                        borderRight: isActive
                          ? "1px solid color-mix(in srgb, var(--primary) 14%, transparent)"
                          : "1px solid transparent",
                        borderBottom: isActive
                          ? "1px solid color-mix(in srgb, var(--primary) 2%, var(--bg-main))"
                          : "1px solid transparent",
                        borderRadius: "4px 4px 0 0",
                        marginBottom: isActive ? "-1px" : "0",
                        zIndex: isActive ? 2 : 1,
                        position: "relative",
                      }}
                      onClick={() => setTab(t.id)}
                    >
                      <t.icon size={11} />
                      <span className="text-micro font-black uppercase tracking-widest">
                        {t.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Desktop tabs */}
              <div className="hidden md:flex items-center justify-between mb-0">
                <div
                  className="flex items-end gap-0 w-full"
                  style={{
                    borderBottom:
                      "1px solid color-mix(in srgb, var(--primary) 12%, transparent)",
                  }}
                >
                  {tabs.map((t) => {
                    const isActive = tab === t.id;
                    return (
                      <button
                        key={t.id}
                        className="relative flex flex-1 items-center justify-center gap-2 px-5 py-2.5 transition-all duration-200"
                        style={{
                          background: isActive
                            ? "var(--white-custom)"
                            : "transparent",
                          color: isActive
                            ? "var(--primary)"
                            : "color-mix(in srgb, var(--primary) 35%, transparent)",
                          borderTop: isActive
                            ? "1px solid color-mix(in srgb, var(--primary) 14%, transparent)"
                            : "1px solid transparent",
                          borderLeft: isActive
                            ? "1px solid color-mix(in srgb, var(--primary) 14%, transparent)"
                            : "1px solid transparent",
                          borderRight: isActive
                            ? "1px solid color-mix(in srgb, var(--primary) 14%, transparent)"
                            : "1px solid transparent",
                          borderBottom: isActive
                            ? "1px solid var(--white-custom)"
                            : "1px solid transparent",
                          borderRadius: "4px 4px 0 0",
                          marginBottom: isActive ? "-1px" : "0",
                        }}
                        onClick={() => setTab(t.id)}
                      >
                        <t.icon size={11} />
                        <span className="text-micro font-black uppercase tracking-widest">
                          {t.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div
                  className="flex items-center gap-1.5 px-3 py-1.5"
                  style={{
                    border:
                      "1px solid color-mix(in srgb, var(--primary) 10%, transparent)",
                    borderRadius: "2px",
                    background:
                      "color-mix(in srgb, var(--primary) 3%, transparent)",
                  }}
                >
                  <Star
                    size={8}
                    style={{
                      color:
                        "color-mix(in srgb, var(--primary) 30%, transparent)",
                    }}
                  />
                  <span
                    className="text-micro font-black uppercase tracking-[0.22em] tabular-nums"
                    style={{
                      color:
                        "color-mix(in srgb, var(--primary) 38%, transparent)",
                    }}
                  >
                    {tab === "items"
                      ? inventario.length + misItemsDesc.length
                      : tab === "criaturas"
                        ? misCriaturas.length
                        : tab === "reinos"
                          ? reinos.length
                          : misPersonajes.length}{" "}
                    entradas
                  </span>
                </div>
              </div>

              {/* Panel colección */}
              <div
                style={{
                  border:
                    "1px solid color-mix(in srgb, var(--primary) 10%, transparent)",
                  borderTop: "none",
                  borderRadius: "0 0 var(--radius-card) var(--radius-card)",
                  background:
                    tab === "items"
                      ? "color-mix(in srgb, var(--primary) 3%, var(--bg-main))"
                      : tab === "criaturas"
                        ? "color-mix(in srgb, var(--primary) 4%, var(--bg-main))"
                        : "color-mix(in srgb, var(--primary) 2%, var(--bg-main))",
                  transition: "background 0.25s ease",
                  padding: "16px",
                }}
              >
                <AnimatePresence mode="wait">
                  <MotionDiv
                    key={tab}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3"
                    exit={{ opacity: 0, y: -6 }}
                    initial={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.16 }}
                  >
                    {tab === "items" && (
                      <>
                        {inventario.map((item, i) => (
                          <EntidadCard
                            key={`inv-${i}`}
                            icono={<Sword size={20} />}
                            imagen={item.items.imagen_url}
                            nombre={item.items.nombre}
                            sub={item.items.categoria}
                            onClick={() =>
                              setModalD({ tipo: "item_inv", data: item })
                            }
                          />
                        ))}
                        {misItemsDesc.map((d, i) => (
                          <EntidadCard
                            key={`desc-${i}`}
                            icono={<Sword size={20} />}
                            imagen={d.imagen_url}
                            nombre={d.nombre ?? "Objeto"}
                            sub={d.categoria ?? "Item"}
                            onClick={() => setModalD({ tipo: "item", data: d })}
                          />
                        ))}
                        {inventario.length === 0 &&
                          misItemsDesc.length === 0 && (
                            <EmptyTab label="Sin items registrados aún" />
                          )}
                      </>
                    )}

                    {tab === "criaturas" &&
                      (misCriaturas.length > 0 ? (
                        misCriaturas.map((d, i) => (
                          <EntidadCard
                            key={i}
                            icono={<Cat size={20} />}
                            imagen={d.imagen_url}
                            nombre={d.nombre ?? "Criatura"}
                            sub={d.habitat}
                            onClick={() =>
                              setModalD({ tipo: "criatura", data: d })
                            }
                          />
                        ))
                      ) : (
                        <EmptyTab label="Sin criaturas descubiertas" />
                      ))}

                    {tab === "personajes" &&
                      (misPersonajes.length > 0 ? (
                        misPersonajes.map((d, i) => (
                          <button
                            key={i}
                            className="group relative flex flex-col overflow-hidden transition-all duration-200 hover:shadow-md"
                            style={{
                              background: "var(--white-custom)",
                              border:
                                "1px solid color-mix(in srgb, var(--primary) 10%, transparent)",
                              borderRadius: "var(--radius-btn)",
                              aspectRatio: "3/4",
                            }}
                            onClick={() => handleOpenPersonajeModal(d)}
                            onMouseEnter={(e) => {
                              (
                                e.currentTarget as HTMLElement
                              ).style.borderColor =
                                "color-mix(in srgb, var(--primary) 22%, transparent)";
                            }}
                            onMouseLeave={(e) => {
                              (
                                e.currentTarget as HTMLElement
                              ).style.borderColor =
                                "color-mix(in srgb, var(--primary) 10%, transparent)";
                            }}
                          >
                            <div className="flex-1 relative overflow-hidden flex items-center justify-center p-2">
                              {d.imagen_url ? (
                                <img
                                  alt={d.nombre}
                                  className="w-full h-full object-contain transition-transform duration-300"
                                  src={d.imagen_url}
                                  style={{
                                    objectPosition: "center",
                                    transform: "scale(3)",
                                  }}
                                  onMouseEnter={(e) => {
                                    (
                                      e.currentTarget as HTMLImageElement
                                    ).style.transform = "scale(3.3)";
                                  }}
                                  onMouseLeave={(e) => {
                                    (
                                      e.currentTarget as HTMLImageElement
                                    ).style.transform = "scale(3)";
                                  }}
                                />
                              ) : (
                                <User
                                  size={22}
                                  style={{
                                    color:
                                      "color-mix(in srgb, var(--primary) 14%, transparent)",
                                  }}
                                />
                              )}
                            </div>
                            <div
                              className="px-1.5 py-1.5"
                              style={{
                                borderTop:
                                  "1px solid color-mix(in srgb, var(--primary) 8%, transparent)",
                                background:
                                  "color-mix(in srgb, var(--primary) 4%, transparent)",
                              }}
                            >
                              <p
                                className="font-serif italic text-sm leading-tight capitalize truncate text-center"
                                style={{ color: "var(--primary)" }}
                              >
                                {d.nombre ?? "Contacto"}
                              </p>
                            </div>
                          </button>
                        ))
                      ) : (
                        <EmptyTab label="Sin registros en la agenda" />
                      ))}

                    {tab === "reinos" &&
                      (reinos.length > 0 ? (
                        reinos.map((r, i) => (
                          <button
                            key={i}
                            className="group relative overflow-hidden text-left transition-all duration-150"
                            style={{
                              background:
                                "color-mix(in srgb, var(--primary) 3%, var(--white-custom))",
                              border:
                                "1px solid color-mix(in srgb, var(--primary) 14%, transparent)",
                              borderRadius: "4px",
                              boxShadow:
                                "inset 0 1px 0 color-mix(in srgb, var(--primary) 6%, transparent), inset 0 -1px 0 color-mix(in srgb, var(--primary) 10%, transparent)",
                              aspectRatio: "1 / 1",
                              display: "flex",
                              flexDirection: "column",
                              minHeight: "80px",
                            }}
                            onClick={() => {
                              setCiudadesReino(
                                ciudades.filter((l) => l.reino_id === r.id),
                              );
                              setModalD({
                                tipo: "reino",
                                data: {
                                  tipo: "item",
                                  entidad_id: r.id,
                                  nombre: r.nombre,
                                  imagen_url: r.mapa_url ?? undefined,
                                  descripcion: r.descripcion ?? undefined,
                                  fecha_descubrimiento: "",
                                },
                              });
                            }}
                            onMouseEnter={(e) => {
                              (
                                e.currentTarget as HTMLElement
                              ).style.borderColor =
                                "color-mix(in srgb, var(--primary) 35%, transparent)";
                              (
                                e.currentTarget as HTMLElement
                              ).style.background =
                                "color-mix(in srgb, var(--primary) 7%, var(--white-custom))";
                              (e.currentTarget as HTMLElement).style.boxShadow =
                                "inset 0 1px 0 color-mix(in srgb, var(--primary) 12%, transparent), 0 0 0 1px color-mix(in srgb, var(--primary) 20%, transparent)";
                            }}
                            onMouseLeave={(e) => {
                              (
                                e.currentTarget as HTMLElement
                              ).style.borderColor =
                                "color-mix(in srgb, var(--primary) 14%, transparent)";
                              (
                                e.currentTarget as HTMLElement
                              ).style.background =
                                "color-mix(in srgb, var(--primary) 3%, var(--white-custom))";
                              (e.currentTarget as HTMLElement).style.boxShadow =
                                "inset 0 1px 0 color-mix(in srgb, var(--primary) 6%, transparent), inset 0 -1px 0 color-mix(in srgb, var(--primary) 10%, transparent)";
                            }}
                          >
                            <div
                              className="flex-1 relative overflow-hidden flex items-center justify-center p-2"
                              style={{ minHeight: "64px", width: "100%" }}
                            >
                              {r.mapa_url ? (
                                <img
                                  alt={r.nombre}
                                  className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-110"
                                  src={r.mapa_url}
                                />
                              ) : (
                                <MapPin
                                  size={22}
                                  style={{
                                    color:
                                      "color-mix(in srgb, var(--primary) 14%, transparent)",
                                  }}
                                />
                              )}
                            </div>
                            <div
                              className="px-1.5 py-1"
                              style={{
                                borderTop:
                                  "1px solid color-mix(in srgb, var(--primary) 8%, transparent)",
                                background:
                                  "color-mix(in srgb, var(--primary) 4%, transparent)",
                              }}
                            >
                              <p
                                className="font-serif italic text-micro leading-tight capitalize truncate text-center"
                                style={{ color: "var(--primary)" }}
                              >
                                {r.nombre}
                              </p>
                            </div>
                          </button>
                        ))
                      ) : (
                        <EmptyTab label="Ningún reino descubierto aún" />
                      ))}
                  </MotionDiv>
                </AnimatePresence>
              </div>
            </div>

            {/* Desktop sidebar - Exploradores */}
            {otrosPerfiles.length > 0 && (
              <aside className="hidden lg:flex flex-col gap-0 w-44 xl:w-52 shrink-0 sticky top-24 pt-0">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div
                    className="flex-1 h-px"
                    style={{
                      background:
                        "color-mix(in srgb, var(--primary) 8%, transparent)",
                    }}
                  />
                  <div className="flex items-center gap-1">
                    <Star
                      size={7}
                      style={{
                        color:
                          "color-mix(in srgb, var(--primary) 28%, transparent)",
                      }}
                    />
                    <p
                      className="text-micro font-black uppercase tracking-[0.3em]"
                      style={{
                        color:
                          "color-mix(in srgb, var(--primary) 30%, transparent)",
                      }}
                    >
                      Exploradores
                    </p>
                  </div>
                  <div
                    className="flex-1 h-px"
                    style={{
                      background:
                        "color-mix(in srgb, var(--primary) 8%, transparent)",
                    }}
                  />
                </div>
                <div
                  className="overflow-hidden"
                  style={{
                    border:
                      "1px solid color-mix(in srgb, var(--primary) 10%, transparent)",
                    borderRadius: "var(--radius-card)",
                    background: "var(--white-custom)",
                  }}
                >
                  {otrosPerfiles.map((p, idx) => (
                    <Link
                      key={p.id}
                      href={`/garlia/personal/${p.username}`}
                      onClick={(e) => {
                        if (estaEnTauri()) {
                          e.preventDefault();
                          navegarRutaDinamica(`/garlia/personal/${p.username}`);
                        }
                      }}
                    >
                      <MotionDiv
                        className="flex items-center gap-2.5 px-3 py-3 cursor-pointer transition-colors"
                        style={{
                          borderBottom:
                            idx < otrosPerfiles.length - 1
                              ? "1px solid color-mix(in srgb, var(--primary) 6%, transparent)"
                              : "none",
                        }}
                        whileHover={{ x: 2 }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.background =
                            "color-mix(in srgb, var(--primary) 3%, transparent)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.background =
                            "transparent";
                        }}
                      >
                        <div
                          className="w-7 h-7 shrink-0 overflow-hidden flex items-center justify-center"
                          style={{
                            borderRadius: "2px",
                            background:
                              "color-mix(in srgb, var(--primary) 7%, transparent)",
                            border:
                              "1px solid color-mix(in srgb, var(--primary) 12%, transparent)",
                          }}
                        >
                          {p.avatar_url ? (
                            <Image
                              alt={p.username}
                              className="w-full h-full object-contain"
                              src={p.avatar_url}
                            />
                          ) : (
                            <User
                              size={11}
                              style={{
                                color:
                                  "color-mix(in srgb, var(--primary) 25%, transparent)",
                              }}
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className="text-micro font-black uppercase tracking-tight truncate capitalize"
                            style={{ color: "var(--primary)" }}
                          >
                            {p.username}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {[
                              { icon: <Sword size={6} />, n: p.items_count },
                              { icon: <Cat size={6} />, n: p.criaturas_count },
                              {
                                icon: <User size={6} />,
                                n: p.personajes_count,
                              },
                            ].map(({ icon, n }, i) => (
                              <span
                                key={i}
                                className="flex items-center gap-0.5 text-micro font-black tabular-nums"
                                style={{
                                  color:
                                    "color-mix(in srgb, var(--primary) 28%, transparent)",
                                }}
                              >
                                {icon}
                                {n}
                              </span>
                            ))}
                          </div>
                        </div>
                        <span
                          className="text-micro shrink-0"
                          style={{
                            color:
                              "color-mix(in srgb, var(--primary) 20%, transparent)",
                          }}
                        >
                          ›
                        </span>
                      </MotionDiv>
                    </Link>
                  ))}
                </div>
              </aside>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
