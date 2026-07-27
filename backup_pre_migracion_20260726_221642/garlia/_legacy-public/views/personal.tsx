"use client";

import { AnimatePresence } from "framer-motion";
import {
  Cat,
  ChevronRight,
  Crown,
  Loader2,
  MapPin,
  Music2,
  Star,
  Sword,
  User,
  Users,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { estaEnTauri, navegarRutaDinamica } from "@/lib/utils/navegacionTauri";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";

import { MotionDiv } from "@/components/ui/Motion";
import { supabase } from "@/lib/api/client/supabase";
import {
  invalidateSessionCache,
  loadCancionesPersonaje,
  loadDescubrimientos,
  loadInventarioUsuario,
  loadPerfilesResumen,
  loadPerfilUsuario,
  loadReinosCiudadesUsuario,
  type CiudadDesbloqueada,
  type PerfilResumen,
  type ReinoDesbloqueado,
} from "@/lib/api/client/syncEngine";

import {
  EmptyTab,
  ModalDetalle,
  type Descubrimiento,
  type EntidadModal,
  type ItemInventario,
} from "./PersonalComponents";

interface Perfil {
  username: string;
  status?: string;
  avatar_url?: string;
  descripcion?: string;
  titulo?: string;
  personaje_favorito_id?: string;
  mascota_id?: string;
  personaje_favorito?: { id: string; nombre: string; img_url?: string } | null;
  mascota?: { id: string; nombre: string; imagen_url?: string } | null;
}

interface PersonalProps {
  datos?: {
    username?: string;
    status?: string;
    avatar_url?: string;
    descubrimientos?: Descubrimiento[];
    inventario_usuario?: ItemInventario[];
  };
}

export default function Personal({ datos: datosProp }: PersonalProps) {
  const router = useRouter();
  const [tab, setTab] = useState<
    "items" | "criaturas" | "personajes" | "reinos"
  >("personajes");
  const [modalEntidad, setModalEntidad] = useState<EntidadModal | null>(null);

  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [inventario, setInventario] = useState<ItemInventario[]>(
    datosProp?.inventario_usuario ?? [],
  );
  const [descubrimientos, setDescubrimientos] = useState<Descubrimiento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState("");
  const [savingDesc, setSavingDesc] = useState(false);
  const [showPersonajePicker, setShowPersonajePicker] = useState(false);
  const [showMascotaPicker, setShowMascotaPicker] = useState(false);
  const [savingFav, setSavingFav] = useState<"personaje" | "mascota" | null>(
    null,
  );
  const [otrosPerfiles, setOtrosPerfiles] = useState<PerfilResumen[]>([]);
  const [cancionesPersonaje, setCancionesPersonaje] = useState<any[]>([]);
  const [cargandoCanciones, setCargandoCanciones] = useState(false);
  const [ciudadesReino, setCiudadesReino] = useState<CiudadDesbloqueada[]>([]);
  const [reinos, setReinos] = useState<ReinoDesbloqueado[]>([]);
  const [ciudades, setCiudades] = useState<CiudadDesbloqueada[]>([]);
  const userIdRef = React.useRef<string | null>(null);

  useEffect(() => {
    async function cargarTodo() {
      setCargando(true);
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError || !user) {
          console.warn("[Personal] Sin sesión activa:", userError?.message);
          setCargando(false);
          return;
        }
        userIdRef.current = user.id;

        // ── Todo en paralelo, cada función usa caché Dexie primero ──────────
        const [perfilData, descData, reinosCiudadesData, invData] =
          await Promise.all([
            loadPerfilUsuario(user.id, (fresh) =>
              setPerfil(mapPerfil(fresh, datosProp, user)),
            ),
            loadDescubrimientos(user.id, (fresh) =>
              setDescubrimientos(fresh as Descubrimiento[]),
            ),
            loadReinosCiudadesUsuario(user.id, (r, c) => {
              setReinos(r);
              setCiudades(c);
            }),
            datosProp?.inventario_usuario?.length
              ? Promise.resolve(null)
              : loadInventarioUsuario(user.id, (fresh) =>
                  setInventario(fresh as ItemInventario[]),
                ),
          ]);

        if (perfilData) setPerfil(mapPerfil(perfilData, datosProp, user));
        if (descData.length) setDescubrimientos(descData as Descubrimiento[]);
        if (reinosCiudadesData.reinos.length)
          setReinos(reinosCiudadesData.reinos);
        if (reinosCiudadesData.ciudades.length)
          setCiudades(reinosCiudadesData.ciudades);
        if (invData) setInventario(invData as ItemInventario[]);

        // ── Sidebar de exploradores: baja prioridad, no bloquea la UI ───────
        loadPerfilesResumen(user.id, setOtrosPerfiles)
          .then(setOtrosPerfiles)
          .catch(() => {});
      } catch (err) {
        console.error("[Personal] Error inesperado:", err);
      } finally {
        setCargando(false);
      }
    }

    void cargarTodo();
  }, []);

  // Refrescar cuando el usuario vuelve a la pestaña (puede haber desbloqueado algo nuevo).
  useEffect(() => {
    const refrescarDescubrimientos = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const uid = user.id;

      await invalidateSessionCache(`descubrimientos:${uid}`);
      await invalidateSessionCache(`reinos_ciudades_usuario:${uid}`);

      const [descData, reinosCiudadesData] = await Promise.all([
        loadDescubrimientos(uid),
        loadReinosCiudadesUsuario(uid),
      ]);

      if (descData.length) setDescubrimientos(descData as Descubrimiento[]);
      setReinos(reinosCiudadesData.reinos);
      setCiudades(reinosCiudadesData.ciudades);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void refrescarDescubrimientos();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // Abrir el modal de detalle cuando el GlobalCommandPalette pide mostrar
  // un personaje/criatura/item ya desbloqueado (evento "personal-open-entity"
  // o buzón en sessionStorage si la navegación llegó recién).
  useEffect(() => {
    const abrirDesdeDescubrimientos = (
      tipo: "personaje" | "criatura" | "item",
      entidadId: string,
    ) => {
      const encontrado = descubrimientos.find(
        (d) => d.tipo === tipo && d.entidad_id === entidadId,
      ) as Descubrimiento | undefined;
      if (!encontrado) return false;
      if (tipo === "personaje") {
        void handleOpenPersonajeModal(encontrado);
      } else {
        setModalEntidad({ tipo, data: encontrado });
      }
      return true;
    };

    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | { tipo: "personaje" | "criatura" | "item"; entidad_id: string }
        | undefined;
      if (!detail) return;
      abrirDesdeDescubrimientos(detail.tipo, detail.entidad_id);
    };
    window.addEventListener("personal-open-entity", handler);

    // Buzón: por si la navegación llegó antes de que descubrimientos cargara
    try {
      const raw = sessionStorage.getItem("personal-pending-open-entity");
      if (raw) {
        const pending = JSON.parse(raw) as {
          tipo: "personaje" | "criatura" | "item";
          entidad_id: string;
          ts: number;
        };
        // Ignorar solicitudes viejas (>10s) para no reabrir modales obsoletos
        if (Date.now() - pending.ts < 10000) {
          const ok = abrirDesdeDescubrimientos(
            pending.tipo,
            pending.entidad_id,
          );
          if (ok) sessionStorage.removeItem("personal-pending-open-entity");
        } else {
          sessionStorage.removeItem("personal-pending-open-entity");
        }
      }
    } catch {}

    return () => window.removeEventListener("personal-open-entity", handler);
     
  }, [descubrimientos]);

  const misPersonajes = descubrimientos.filter((d) => d.tipo === "personaje");
  const misCriaturas = descubrimientos.filter((d) => d.tipo === "criatura");
  const misItemsDesc = descubrimientos.filter((d) => d.tipo === "item");
  const personajesConImagen = misPersonajes.filter((d) => d.imagen_url);

  const handleSelectAvatar = async (imgUrl: string) => {
    const userId = userIdRef.current;
    if (!userId) return;
    setSavingAvatar(true);
    const { error } = await supabase
      .from("perfiles")
      .update({ avatar_url: imgUrl })
      .eq("id", userId);
    if (!error) {
      setPerfil((prev) => (prev ? { ...prev, avatar_url: imgUrl } : prev));
      setShowAvatarPicker(false);
      await invalidateSessionCache(`perfil_usuario:${userId}`);
    } else {
      console.warn("[Personal] Error guardando avatar:", error.message);
    }
    setSavingAvatar(false);
  };

  const handleSaveDesc = async () => {
    const userId = userIdRef.current;
    if (!userId) return;
    setSavingDesc(true);
    const { error } = await supabase
      .from("perfiles")
      .update({ descripcion: descDraft })
      .eq("id", userId);
    if (!error) {
      setPerfil((prev) => (prev ? { ...prev, descripcion: descDraft } : prev));
      setEditingDesc(false);
      await invalidateSessionCache(`perfil_usuario:${userId}`);
    }
    setSavingDesc(false);
  };

  const handleSaveFavorito = async (
    tipo: "personaje" | "mascota",
    id: string,
    data: any,
  ) => {
    const userId = userIdRef.current;
    if (!userId) return;
    setSavingFav(tipo);
    const col = tipo === "personaje" ? "personaje_favorito_id" : "mascota_id";
    const { error } = await supabase
      .from("perfiles")
      .update({ [col]: id })
      .eq("id", userId);
    if (!error) {
      setPerfil((prev) =>
        prev
          ? {
              ...prev,
              [col]: id,
              [tipo === "personaje" ? "personaje_favorito" : "mascota"]: data,
            }
          : prev,
      );
      if (tipo === "personaje") {
        setShowPersonajePicker(false);
      } else {
        setShowMascotaPicker(false);
      }
      await invalidateSessionCache(`perfil_usuario:${userId}`);
    }
    setSavingFav(null);
  };

  const handleOpenPersonajeModal = async (d: Descubrimiento) => {
    setCancionesPersonaje([]);
    setModalEntidad({ tipo: "personaje", data: d });
    if (!d.entidad_id) return;
    setCargandoCanciones(true);
    try {
      const data = await loadCancionesPersonaje(d.entidad_id);
      setCancionesPersonaje(data);
    } catch (err) {
      console.warn("[Personal] Error cargando canciones:", err);
    } finally {
      setCargandoCanciones(false);
    }
  };

  const tabs = [
    {
      id: "personajes",
      label: "Agenda",
      icon: User,
      count: misPersonajes.length,
    },
    {
      id: "criaturas",
      label: "Bestiario",
      icon: Cat,
      count: misCriaturas.length,
    },
    {
      id: "items",
      label: "Inventario",
      icon: Sword,
      count: inventario.length + misItemsDesc.length,
    },
    { id: "reinos", label: "Mapa", icon: MapPin, count: reinos.length },
  ] as const;

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

  return (
    <>
      {modalEntidad &&
        modalEntidad.tipo !== "personaje" &&
        modalEntidad.tipo !== "reino" && (
          <ModalDetalle
            entidad={modalEntidad}
            onClose={() => setModalEntidad(null)}
          />
        )}

      {/* Modal custom para personajes con canciones */}
      <AnimatePresence>
        {modalEntidad && modalEntidad.tipo === "personaje" && (
          <>
            <MotionDiv
              animate={{ opacity: 1 }}
              className="fixed inset-0 z-40 backdrop-blur-sm"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              style={{ background: "rgba(0,0,0,0.45)" }}
              onClick={() => {
                setModalEntidad(null);
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
                  "0 24px 64px color-mix(in srgb, var(--primary) 18%, transparent), 0 4px 16px color-mix(in srgb, var(--primary) 10%, transparent)",
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
                  height: modalEntidad.data.imagen_url ? "220px" : "80px",
                  background:
                    "color-mix(in srgb, var(--primary) 6%, var(--bg-main))",
                }}
              >
                {modalEntidad.data.imagen_url && (
                  <img
                    alt={modalEntidad.data.nombre}
                    className="w-full h-full object-cover transition-transform duration-700"
                    src={modalEntidad.data.imagen_url}
                    style={{
                      objectPosition: "center center",
                      transform: "scale(1.8)",
                      transformOrigin: "center center",
                    }}
                  />
                )}
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(to top, var(--white-custom) 0%, color-mix(in srgb, var(--white-custom) 30%, transparent) 45%, transparent 100%)",
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
                    setModalEntidad(null);
                    setCancionesPersonaje([]);
                  }}
                >
                  <X size={13} />
                </button>
                {modalEntidad.data.imagen_url && (
                  <div className="absolute bottom-0 left-0 right-0 px-6 pb-4">
                    <h2
                      className="font-serif italic capitalize leading-tight"
                      style={{
                        fontSize: "1.75rem",
                        color: "var(--primary)",
                        lineHeight: 1.15,
                      }}
                    >
                      {modalEntidad.data.nombre ?? "Personaje"}
                    </h2>
                    {(modalEntidad.data.reino || modalEntidad.data.especie) && (
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        {modalEntidad.data.reino && (
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
                            {modalEntidad.data.reino}
                          </span>
                        )}
                        {modalEntidad.data.especie && (
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
                            {modalEntidad.data.especie}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div
                className="overflow-y-auto flex-1 px-6 pb-6"
                style={{ paddingTop: "1.25rem" }}
              >
                {!modalEntidad.data.imagen_url && (
                  <div className="mb-4">
                    <h2
                      className="font-serif italic capitalize leading-tight mb-2"
                      style={{ fontSize: "1.75rem", color: "var(--primary)" }}
                    >
                      {modalEntidad.data.nombre ?? "Personaje"}
                    </h2>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {modalEntidad.data.reino && (
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
                          {modalEntidad.data.reino}
                        </span>
                      )}
                      {modalEntidad.data.especie && (
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
                          {modalEntidad.data.especie}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {modalEntidad.data.descripcion && (
                  <p
                    className="font-serif italic leading-relaxed mb-5"
                    style={{
                      fontSize: "0.88rem",
                      color:
                        "color-mix(in srgb, var(--foreground) 68%, transparent)",
                      lineHeight: 1.7,
                    }}
                  >
                    {modalEntidad.data.descripcion}
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
                            <img
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
                            <span
                              className="text-micro font-black uppercase tracking-wider truncate block mt-0.5"
                              style={{
                                color:
                                  "color-mix(in srgb, var(--primary) 35%, transparent)",
                              }}
                            >
                              {cancion.info_cancion}
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
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </MotionDiv>
          </>
        )}
      </AnimatePresence>

      {/* Modal custom para reinos con ciudades */}
      <AnimatePresence>
        {modalEntidad && modalEntidad.tipo === "reino" && (
          <>
            <MotionDiv
              animate={{ opacity: 1 }}
              className="fixed inset-0 z-40 backdrop-blur-sm"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              style={{ background: "rgba(0,0,0,0.45)" }}
              onClick={() => {
                setModalEntidad(null);
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
              {/* Hero imagen */}
              <div
                className="w-full shrink-0 overflow-hidden relative"
                style={{
                  height:
                    modalEntidad.data.imagen_url || modalEntidad.data.img_url
                      ? "220px"
                      : "80px",
                  background:
                    "color-mix(in srgb, var(--primary) 6%, var(--bg-main))",
                }}
              >
                {modalEntidad.data.imagen_url && (
                  <img
                    alt={modalEntidad.data.nombre}
                    className="w-full h-full object-cover"
                    src={modalEntidad.data.imagen_url}
                    style={{ opacity: 0.35 }}
                  />
                )}
                {modalEntidad.data.img_url && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <img
                      alt={`Logo ${modalEntidad.data.nombre}`}
                      className="object-contain drop-shadow-lg transition-transform duration-700 hover:scale-105"
                      src={modalEntidad.data.img_url}
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
                    setModalEntidad(null);
                    setCiudadesReino([]);
                  }}
                >
                  <X size={13} />
                </button>
                {(modalEntidad.data.imagen_url ||
                  modalEntidad.data.img_url) && (
                  <div className="absolute bottom-0 left-0 right-0 px-6 pb-4">
                    <h2
                      className="font-serif italic capitalize leading-tight"
                      style={{
                        fontSize: "1.75rem",
                        color: "var(--primary)",
                        lineHeight: 1.15,
                      }}
                    >
                      {modalEntidad.data.nombre ?? "Reino"}
                    </h2>
                  </div>
                )}
              </div>

              <div
                className="overflow-y-auto flex-1 px-6 pb-6"
                style={{ paddingTop: "1.25rem" }}
              >
                {!modalEntidad.data.imagen_url &&
                  !modalEntidad.data.img_url && (
                    <h2
                      className="font-serif italic capitalize leading-tight mb-4"
                      style={{ fontSize: "1.75rem", color: "var(--primary)" }}
                    >
                      {modalEntidad.data.nombre ?? "Reino"}
                    </h2>
                  )}
                {modalEntidad.data.descripcion && (
                  <p
                    className="font-serif italic leading-relaxed mb-5"
                    style={{
                      fontSize: "0.88rem",
                      color:
                        "color-mix(in srgb, var(--foreground) 68%, transparent)",
                      lineHeight: 1.7,
                    }}
                  >
                    {modalEntidad.data.descripcion}
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
                            setModalEntidad(null);
                            setCiudadesReino([]);
                            setTimeout(
                              () =>
                                setModalEntidad({
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

      {/* Avatar picker */}
      <AnimatePresence>
        {showAvatarPicker && (
          <>
            <MotionDiv
              animate={{ opacity: 1 }}
              className="fixed inset-0 z-40 backdrop-blur-sm"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              style={{ background: "rgba(0,0,0,0.4)" }}
              onClick={() => setShowAvatarPicker(false)}
            />
            <MotionDiv
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 md:inset-auto md:left-1/2 md:-translate-x-1/2 md:w-96"
              exit={{ opacity: 0, scale: 0.94, y: 16 }}
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              style={{
                background: "var(--white-custom)",
                borderRadius: "var(--radius-card)",
                border:
                  "1px solid color-mix(in srgb, var(--primary) 12%, transparent)",
                boxShadow: "var(--shadow-card)",
                maxHeight: "80dvh",
                display: "flex",
                flexDirection: "column",
              }}
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
            >
              <div
                className="flex items-center justify-between px-5 py-4 shrink-0"
                style={{
                  borderBottom:
                    "1px solid color-mix(in srgb, var(--primary) 8%, transparent)",
                }}
              >
                <div>
                  <p
                    className="text-micro font-black uppercase tracking-widest"
                    style={{ color: "var(--primary)" }}
                  >
                    Elegir foto de perfil
                  </p>
                  <p
                    className="text-micro font-bold uppercase tracking-widest mt-0.5"
                    style={{
                      color:
                        "color-mix(in srgb, var(--primary) 35%, transparent)",
                    }}
                  >
                    Personajes desbloqueados
                  </p>
                </div>
                <button
                  className="p-1.5 transition-opacity hover:opacity-100"
                  style={{
                    color: "var(--primary)",
                    opacity: 0.4,
                    borderRadius: "var(--radius-btn)",
                  }}
                  onClick={() => setShowAvatarPicker(false)}
                >
                  <X size={14} />
                </button>
              </div>
              <div className="overflow-y-auto flex-1 p-4">
                {personajesConImagen.length === 0 ? (
                  <div className="py-12 text-center">
                    <p
                      className="text-micro font-black uppercase tracking-widest italic"
                      style={{
                        color:
                          "color-mix(in srgb, var(--primary) 25%, transparent)",
                      }}
                    >
                      &quot;Desbloquea personajes leyendo para usar sus imágenes&quot;
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      className="flex flex-col items-center gap-1.5 p-2 transition-all"
                      style={{
                        borderRadius: "var(--radius-btn)",
                        border: !perfil?.avatar_url
                          ? "2px solid var(--accent)"
                          : "1px solid color-mix(in srgb, var(--primary) 10%, transparent)",
                        background:
                          "color-mix(in srgb, var(--primary) 4%, transparent)",
                      }}
                      onClick={() => handleSelectAvatar("")}
                    >
                      <div
                        className="w-16 h-16 flex items-center justify-center"
                        style={{
                          borderRadius: "50%",
                          background:
                            "color-mix(in srgb, var(--primary) 8%, transparent)",
                        }}
                      >
                        <User
                          size={24}
                          style={{
                            color:
                              "color-mix(in srgb, var(--primary) 30%, transparent)",
                          }}
                        />
                      </div>
                      <span
                        className="text-micro font-black uppercase tracking-widest"
                        style={{
                          color:
                            "color-mix(in srgb, var(--primary) 40%, transparent)",
                        }}
                      >
                        Ninguna
                      </span>
                    </button>
                    {personajesConImagen.map((p, i) => {
                      const isSelected = perfil?.avatar_url === p.imagen_url;
                      return (
                        <button
                          key={i}
                          className="flex flex-col items-center gap-1.5 p-2 transition-all"
                          disabled={savingAvatar}
                          style={{
                            borderRadius: "var(--radius-btn)",
                            border: isSelected
                              ? "2px solid var(--accent)"
                              : "1px solid color-mix(in srgb, var(--primary) 10%, transparent)",
                            background: isSelected
                              ? "color-mix(in srgb, var(--accent) 6%, transparent)"
                              : "transparent",
                          }}
                          onClick={() => handleSelectAvatar(p.imagen_url!)}
                          onMouseEnter={(e) => {
                            if (!isSelected)
                              (
                                e.currentTarget as HTMLElement
                              ).style.background =
                                "color-mix(in srgb, var(--primary) 5%, transparent)";
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected)
                              (
                                e.currentTarget as HTMLElement
                              ).style.background = "transparent";
                          }}
                        >
                          <div
                            className="w-16 h-16 overflow-hidden"
                            style={{
                              borderRadius: "50%",
                              border: isSelected
                                ? "2px solid var(--accent)"
                                : "none",
                            }}
                          >
                            <img
                              alt={p.nombre ?? ""}
                              className="w-full h-full object-contain"
                              src={p.imagen_url}
                            />
                          </div>
                          <span
                            className="text-micro font-black uppercase tracking-widest truncate w-full text-center"
                            style={{
                              color: isSelected
                                ? "var(--accent)"
                                : "color-mix(in srgb, var(--primary) 50%, transparent)",
                            }}
                          >
                            {p.nombre}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              {savingAvatar && (
                <div
                  className="flex items-center justify-center gap-2 py-3 shrink-0"
                  style={{
                    borderTop:
                      "1px solid color-mix(in srgb, var(--primary) 8%, transparent)",
                  }}
                >
                  <Loader2
                    className="animate-spin"
                    size={13}
                    style={{
                      color:
                        "color-mix(in srgb, var(--primary) 40%, transparent)",
                    }}
                  />
                  <span
                    className="text-micro font-black uppercase tracking-widest"
                    style={{
                      color:
                        "color-mix(in srgb, var(--primary) 40%, transparent)",
                    }}
                  >
                    Guardando…
                  </span>
                </div>
              )}
            </MotionDiv>
          </>
        )}
      </AnimatePresence>

      {/* Personaje favorito picker */}
      <AnimatePresence>
        {showPersonajePicker && (
          <>
            <MotionDiv
              animate={{ opacity: 1 }}
              className="fixed inset-0 z-40 backdrop-blur-sm"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              style={{ background: "rgba(0,0,0,0.4)" }}
              onClick={() => setShowPersonajePicker(false)}
            />
            <MotionDiv
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 md:inset-auto md:left-1/2 md:-translate-x-1/2 md:w-96"
              exit={{ opacity: 0, scale: 0.94, y: 16 }}
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              style={{
                background: "var(--white-custom)",
                borderRadius: "var(--radius-card)",
                border:
                  "1px solid color-mix(in srgb, var(--primary) 12%, transparent)",
                boxShadow: "var(--shadow-card)",
                maxHeight: "80dvh",
                display: "flex",
                flexDirection: "column",
              }}
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
            >
              <div
                className="flex items-center justify-between px-5 py-4 shrink-0"
                style={{
                  borderBottom:
                    "1px solid color-mix(in srgb, var(--primary) 8%, transparent)",
                }}
              >
                <p
                  className="font-serif italic text-micro"
                  style={{ color: "var(--primary)" }}
                >
                  Elegir personaje favorito
                </p>
                <button
                  className="p-1 transition-opacity hover:opacity-100"
                  style={{
                    color: "var(--primary)",
                    opacity: 0.4,
                    borderRadius: "var(--radius-btn)",
                  }}
                  onClick={() => setShowPersonajePicker(false)}
                >
                  <X size={14} />
                </button>
              </div>
              <div className="overflow-y-auto flex-1 p-3">
                <p
                  className="font-serif italic text-micro px-2 mb-2"
                  style={{
                    color:
                      "color-mix(in srgb, var(--primary) 30%, transparent)",
                  }}
                >
                  Solo puedes elegir personajes que hayas desbloqueado
                </p>
                {misPersonajes.length === 0 ? (
                  <p
                    className="font-serif italic text-micro text-center py-8"
                    style={{
                      color:
                        "color-mix(in srgb, var(--primary) 25%, transparent)",
                    }}
                  >
                    &quot;Aún no conoces ningún personaje…&quot;
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {misPersonajes.map((p, i) => {
                      const isSelected =
                        perfil?.personaje_favorito_id === p.entidad_id;
                      return (
                        <button
                          key={i}
                          className="flex flex-col items-center gap-1.5 p-2 transition-all"
                          disabled={savingFav === "personaje"}
                          style={{
                            borderRadius: "var(--radius-btn)",
                            border: isSelected
                              ? "2px solid var(--accent)"
                              : "1px solid color-mix(in srgb, var(--primary) 10%, transparent)",
                            background: isSelected
                              ? "color-mix(in srgb, var(--accent) 6%, transparent)"
                              : "transparent",
                          }}
                          onClick={() =>
                            handleSaveFavorito("personaje", p.entidad_id, {
                              id: p.entidad_id,
                              nombre: p.nombre,
                              img_url: p.imagen_url,
                            })
                          }
                        >
                          <div
                            className="w-14 h-14 overflow-hidden"
                            style={{
                              borderRadius: "var(--radius-btn)",
                              background:
                                "color-mix(in srgb, var(--primary) 5%, transparent)",
                            }}
                          >
                            {p.imagen_url ? (
                              <Image
                                alt={p.nombre ?? ""}
                                className="w-full h-full object-contain"
                                src={p.imagen_url}
                              />
                            ) : (
                              <User
                                className="m-auto mt-2.5"
                                size={20}
                                style={{
                                  color:
                                    "color-mix(in srgb, var(--primary) 20%, transparent)",
                                }}
                              />
                            )}
                          </div>
                          <span
                            className="font-serif italic text-micro truncate w-full text-center"
                            style={{
                              color: isSelected
                                ? "var(--accent)"
                                : "color-mix(in srgb, var(--primary) 55%, transparent)",
                            }}
                          >
                            {p.nombre}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </MotionDiv>
          </>
        )}
      </AnimatePresence>

      {/* Mascota picker */}
      <AnimatePresence>
        {showMascotaPicker && (
          <>
            <MotionDiv
              animate={{ opacity: 1 }}
              className="fixed inset-0 z-40 backdrop-blur-sm"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              style={{ background: "rgba(0,0,0,0.4)" }}
              onClick={() => setShowMascotaPicker(false)}
            />
            <MotionDiv
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 md:inset-auto md:left-1/2 md:-translate-x-1/2 md:w-96"
              exit={{ opacity: 0, scale: 0.94, y: 16 }}
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              style={{
                background: "var(--white-custom)",
                borderRadius: "var(--radius-card)",
                border:
                  "1px solid color-mix(in srgb, var(--primary) 12%, transparent)",
                boxShadow: "var(--shadow-card)",
                maxHeight: "80dvh",
                display: "flex",
                flexDirection: "column",
              }}
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
            >
              <div
                className="flex items-center justify-between px-5 py-4 shrink-0"
                style={{
                  borderBottom:
                    "1px solid color-mix(in srgb, var(--primary) 8%, transparent)",
                }}
              >
                <p
                  className="font-serif italic text-micro"
                  style={{ color: "var(--primary)" }}
                >
                  Elegir mascota
                </p>
                <button
                  className="p-1 transition-opacity hover:opacity-100"
                  style={{
                    color: "var(--primary)",
                    opacity: 0.4,
                    borderRadius: "var(--radius-btn)",
                  }}
                  onClick={() => setShowMascotaPicker(false)}
                >
                  <X size={14} />
                </button>
              </div>
              <div className="overflow-y-auto flex-1 p-3">
                <p
                  className="font-serif italic text-micro px-2 mb-2"
                  style={{
                    color:
                      "color-mix(in srgb, var(--primary) 30%, transparent)",
                  }}
                >
                  Solo puedes elegir criaturas que hayas descubierto
                </p>
                {misCriaturas.length === 0 ? (
                  <p
                    className="font-serif italic text-micro text-center py-8"
                    style={{
                      color:
                        "color-mix(in srgb, var(--primary) 25%, transparent)",
                    }}
                  >
                    &quot;Aún no has descubierto ninguna criatura…&quot;
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {misCriaturas.map((c, i) => {
                      const isSelected = perfil?.mascota_id === c.entidad_id;
                      return (
                        <button
                          key={i}
                          className="flex flex-col items-center gap-1.5 p-2 transition-all"
                          disabled={savingFav === "mascota"}
                          style={{
                            borderRadius: "var(--radius-btn)",
                            border: isSelected
                              ? "2px solid var(--accent)"
                              : "1px solid color-mix(in srgb, var(--primary) 10%, transparent)",
                            background: isSelected
                              ? "color-mix(in srgb, var(--accent) 6%, transparent)"
                              : "transparent",
                          }}
                          onClick={() =>
                            handleSaveFavorito("mascota", c.entidad_id, {
                              id: c.entidad_id,
                              nombre: c.nombre,
                              imagen_url: c.imagen_url,
                            })
                          }
                        >
                          <div
                            className="w-14 h-14 overflow-hidden"
                            style={{
                              borderRadius: "var(--radius-btn)",
                              background:
                                "color-mix(in srgb, var(--primary) 5%, transparent)",
                            }}
                          >
                            {c.imagen_url ? (
                              <Image
                                alt={c.nombre ?? ""}
                                className="w-full h-full object-contain"
                                src={c.imagen_url}
                              />
                            ) : (
                              <Cat
                                className="m-auto mt-2.5"
                                size={20}
                                style={{
                                  color:
                                    "color-mix(in srgb, var(--primary) 20%, transparent)",
                                }}
                              />
                            )}
                          </div>
                          <span
                            className="font-serif italic text-micro truncate w-full text-center"
                            style={{
                              color: isSelected
                                ? "var(--accent)"
                                : "color-mix(in srgb, var(--primary) 55%, transparent)",
                            }}
                          >
                            {c.nombre}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </MotionDiv>
          </>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════
          MAIN LAYOUT
      ══════════════════════════════════════ */}
      <div className="w-full max-w-7xl mx-auto pb-20">
        {/* ── HERO HEADER ── */}
        <div className="animate-in fade-in duration-700">
          <div
            className="relative w-full overflow-hidden"
            style={{
              height: "96px",
              background: `color-mix(in srgb, var(--primary) 7%, var(--bg-main))`,
              borderBottom:
                "1px solid color-mix(in srgb, var(--primary) 10%, transparent)",
            }}
          >
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `repeating-linear-gradient(
                  45deg,
                  color-mix(in srgb, var(--primary) 4%, transparent) 0px,
                  color-mix(in srgb, var(--primary) 4%, transparent) 1px,
                  transparent 1px,
                  transparent 24px
                )`,
              }}
            />
            <div className="absolute top-4 right-4 md:right-10 flex items-center gap-2">
              <div
                className="flex items-center gap-1.5 px-3 py-1.5"
                style={{
                  border:
                    "1px solid color-mix(in srgb, var(--primary) 14%, transparent)",
                  borderRadius: "2px",
                  background:
                    "color-mix(in srgb, var(--white-custom) 75%, transparent)",
                  backdropFilter: "blur(6px)",
                }}
              >
                <Star
                  size={8}
                  style={{
                    color:
                      "color-mix(in srgb, var(--primary) 38%, transparent)",
                  }}
                />
                <span
                  className="text-micro font-black uppercase tracking-[0.22em] tabular-nums"
                  style={{
                    color:
                      "color-mix(in srgb, var(--primary) 55%, transparent)",
                  }}
                >
                  {inventario.length +
                    misItemsDesc.length +
                    misCriaturas.length +
                    misPersonajes.length}
                </span>
                <span
                  className="text-micro font-black uppercase tracking-[0.2em] hidden sm:inline"
                  style={{
                    color:
                      "color-mix(in srgb, var(--primary) 36%, transparent)",
                  }}
                >
                  descubrimientos
                </span>
              </div>
            </div>
          </div>

          <div
            className="px-6 md:px-10 flex items-end gap-5 md:gap-7"
            style={{ marginTop: "-52px", paddingBottom: "20px" }}
          >
            <button
              className="group relative shrink-0 transition-opacity hover:opacity-90"
              style={{
                width: 104,
                height: 104,
                borderRadius: "50%",
                overflow: "hidden",
                background:
                  "color-mix(in srgb, var(--primary) 8%, var(--bg-main))",
                flexShrink: 0,
              }}
              title="Cambiar imagen"
              onClick={() => setShowAvatarPicker(true)}
            >
              {perfil?.avatar_url ? (
                <img
                  alt={perfil?.username}
                  className="w-full h-full object-contain"
                  src={perfil.avatar_url}
                />
              ) : (
                <User
                  className="absolute inset-0 m-auto"
                  size={38}
                  style={{
                    color:
                      "color-mix(in srgb, var(--primary) 22%, transparent)",
                  }}
                />
              )}
              <div
                className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                style={{
                  background:
                    "color-mix(in srgb, var(--primary) 35%, transparent)",
                }}
              >
                <span
                  className="text-micro font-black uppercase tracking-widest"
                  style={{ color: "var(--btn-text)" }}
                >
                  Cambiar
                </span>
              </div>
            </button>

            <div
              className="flex flex-col gap-1 pb-1"
              style={{ paddingTop: "56px" }}
            >
              {perfil?.titulo && (
                <div
                  className="inline-flex w-fit items-center gap-1.5 px-2 py-0.5"
                  style={{
                    border:
                      "1px solid color-mix(in srgb, var(--primary) 14%, transparent)",
                    borderRadius: "2px",
                    background:
                      "color-mix(in srgb, var(--primary) 4%, transparent)",
                  }}
                >
                  <Star
                    size={7}
                    style={{
                      color:
                        "color-mix(in srgb, var(--primary) 38%, transparent)",
                    }}
                  />
                  <span
                    className="text-micro font-black uppercase tracking-[0.22em]"
                    style={{
                      color:
                        "color-mix(in srgb, var(--primary) 48%, transparent)",
                    }}
                  >
                    {perfil.titulo}
                  </span>
                </div>
              )}
              <h1
                className="font-serif italic leading-none capitalize"
                style={{
                  fontSize: "clamp(1.7rem, 4vw, 2.6rem)",
                  color: "var(--primary)",
                  letterSpacing: "0.01em",
                }}
              >
                {perfil?.username ?? "…"}
              </h1>
              <p
                className="font-serif italic"
                style={{
                  fontSize: "0.83rem",
                  color: "color-mix(in srgb, var(--primary) 45%, transparent)",
                }}
              >
                {perfil?.status ?? "Enciclopedia"}
              </p>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════
            BODY — sidebar + content
        ══════════════════════════════════════ */}
        <div className="flex flex-col md:flex-row gap-6 items-start mt-6 px-4 md:px-8">
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
              {/* Stats HUD */}
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

              {/* Bio */}
              <div>
                <div className="flex items-center justify-between px-5 pt-4 pb-2">
                  <div className="flex items-center gap-2">
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
                  {!editingDesc ? (
                    <button
                      className="text-micro font-black uppercase tracking-wider px-2.5 py-1 transition-all hover:opacity-80"
                      style={{
                        color:
                          "color-mix(in srgb, var(--primary) 45%, transparent)",
                        borderRadius: "2px",
                        border:
                          "1px solid color-mix(in srgb, var(--primary) 14%, transparent)",
                        background:
                          "color-mix(in srgb, var(--primary) 3%, transparent)",
                      }}
                      onClick={() => {
                        setDescDraft(perfil?.descripcion ?? "");
                        setEditingDesc(true);
                      }}
                    >
                      Editar
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <button
                        className="text-micro font-black uppercase tracking-wider px-2 py-1"
                        style={{
                          color:
                            "color-mix(in srgb, var(--primary) 35%, transparent)",
                        }}
                        onClick={() => setEditingDesc(false)}
                      >
                        Cancelar
                      </button>
                      <button
                        className="text-micro font-black uppercase tracking-wider px-2.5 py-1 disabled:opacity-50 transition-opacity"
                        disabled={savingDesc}
                        style={{
                          background: "var(--primary)",
                          color: "var(--btn-text)",
                          borderRadius: "2px",
                        }}
                        onClick={handleSaveDesc}
                      >
                        {savingDesc ? "…" : "Guardar"}
                      </button>
                    </div>
                  )}
                </div>

                <div className="px-5 pb-5">
                  {editingDesc ? (
                    <textarea
                      autoFocus
                      className="w-full bg-transparent outline-none resize-none font-serif italic leading-relaxed"
                      placeholder="Escribe algo sobre ti…"
                      rows={4}
                      style={{
                        fontSize: "0.85rem",
                        color: "var(--foreground)",
                        caretColor: "var(--primary)",
                      }}
                      value={descDraft}
                      onChange={(e) => setDescDraft(e.target.value)}
                    />
                  ) : perfil?.descripcion ? (
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
                      &quot;Sin descripción aún… pulsa Editar.&quot;
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
                <button
                  className="text-left px-4 py-4 transition-colors group"
                  style={{ borderRadius: 0 }}
                  onClick={() => setShowPersonajePicker(true)}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background =
                      "color-mix(in srgb, var(--primary) 3%, transparent)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background =
                      "transparent";
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
                </button>

                <button
                  className="text-left px-4 py-4 transition-colors group"
                  style={{
                    borderLeft:
                      "1px solid color-mix(in srgb, var(--primary) 8%, transparent)",
                    borderRadius: 0,
                  }}
                  onClick={() => setShowMascotaPicker(true)}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background =
                      "color-mix(in srgb, var(--primary) 3%, transparent)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background =
                      "transparent";
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
                </button>
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
            <div className="w-full md:flex-1 md:min-w-0 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
              {/* Tabs Mobile */}
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

              {/* Tabs Desktop */}
              <div
                className="hidden md:flex items-end gap-0 w-full"
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
                      className="relative flex flex-1 items-center justify-center gap-1.5 py-2.5 transition-all duration-200"
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

              {/* Grid panel */}
              <div
                style={{
                  borderLeft:
                    "1px solid color-mix(in srgb, var(--primary) 10%, transparent)",
                  borderRight:
                    "1px solid color-mix(in srgb, var(--primary) 10%, transparent)",
                  borderBottom:
                    "1px solid color-mix(in srgb, var(--primary) 10%, transparent)",
                  borderTop: "0px solid transparent",
                  borderRadius: "0 0 var(--radius-card) var(--radius-card)",
                  background:
                    "color-mix(in srgb, var(--primary) 2%, var(--bg-main))",
                  padding: "16px",
                  position: "relative",
                  zIndex: 1,
                  minHeight: "240px",
                  width: "100%",
                }}
              >
                <AnimatePresence mode="wait">
                  <MotionDiv
                    key={tab}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-3"
                    exit={{ opacity: 0, y: -6 }}
                    initial={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.16 }}
                  >
                    {tab === "items" && (
                      <>
                        {inventario.map((item, i) => (
                          <button
                            key={`inv-${i}`}
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
                            onClick={() =>
                              setModalEntidad({ tipo: "item_inv", data: item })
                            }
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
                              {item.items.imagen_url ? (
                                <img
                                  alt={item.items.nombre}
                                  className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-125"
                                  src={item.items.imagen_url}
                                  style={{ objectPosition: "center" }}
                                />
                              ) : (
                                <Sword
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
                                {item.items.nombre}
                              </p>
                            </div>
                          </button>
                        ))}
                        {misItemsDesc.map((d, i) => (
                          <button
                            key={`desc-${i}`}
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
                            onClick={() =>
                              setModalEntidad({ tipo: "item", data: d })
                            }
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
                              {d.imagen_url ? (
                                <img
                                  alt={d.nombre}
                                  className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-125"
                                  src={d.imagen_url}
                                  style={{ objectPosition: "center" }}
                                />
                              ) : (
                                <Sword
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
                                {d.nombre ?? "Objeto"}
                              </p>
                            </div>
                          </button>
                        ))}
                        {inventario.length === 0 &&
                          misItemsDesc.length === 0 && (
                            <div className="col-span-full">
                              <EmptyTab label="Sin items registrados aún" />
                            </div>
                          )}
                      </>
                    )}

                    {tab === "criaturas" &&
                      (misCriaturas.length > 0 ? (
                        misCriaturas.map((d, i) => (
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
                            onClick={() =>
                              setModalEntidad({ tipo: "criatura", data: d })
                            }
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
                              {d.imagen_url ? (
                                <img
                                  alt={d.nombre}
                                  className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-125"
                                  src={d.imagen_url}
                                  style={{ objectPosition: "center" }}
                                />
                              ) : (
                                <Cat
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
                                {d.nombre ?? "Criatura"}
                              </p>
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="col-span-full">
                          <EmptyTab label="Sin registros en el bestiario" />
                        </div>
                      ))}

                    {tab === "personajes" &&
                      (misPersonajes.length > 0 ? (
                        misPersonajes.map((d, i) => (
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
                            onClick={() => handleOpenPersonajeModal(d)}
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
                              className="px-1.5 py-1"
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
                        <div className="col-span-full">
                          <EmptyTab label="Sin registros en la agenda" />
                        </div>
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
                              try {
                                sessionStorage.setItem(
                                  "mapa-pending-open-entity",
                                  JSON.stringify({
                                    tipo: "reino",
                                    entidad_id: r.id,
                                    ts: Date.now(),
                                  }),
                                );
                              } catch {}
                              router.push(`/garlia/mapa`);
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
                              <Crown
                                className="transition-transform duration-300 group-hover:scale-110"
                                size={28}
                                style={{
                                  color:
                                    "color-mix(in srgb, var(--primary) 55%, transparent)",
                                }}
                              />
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
                        <div className="col-span-full">
                          <EmptyTab label="Ningún reino descubierto aún" />
                        </div>
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
                          className="w-7 h-7 shrink-0 overflow-hidden flex items-center justify-center relative"
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

// ─── Helper ───────────────────────────────────────────────────────────────────

function mapPerfil(
  data: any,
  datosProp: PersonalProps["datos"],
  user: any,
): Perfil {
  return {
    username:
      data?.username ??
      datosProp?.username ??
      user.email?.split("@")[0] ??
      "Aventurero",
    status: data?.status ?? datosProp?.status,
    avatar_url: data?.avatar_url ?? datosProp?.avatar_url,
    descripcion: data?.descripcion,
    titulo: data?.titulo,
    personaje_favorito_id: data?.personaje_favorito_id,
    mascota_id: data?.mascota_id,
    personaje_favorito: data?.personajes ?? null,
    mascota: data?.mascota ?? null,
  };
}
