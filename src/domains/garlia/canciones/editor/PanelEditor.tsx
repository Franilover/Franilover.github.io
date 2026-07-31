"use client";

import {
  Music,
  Film,
  Loader2,
  FileText,
  PanelRight,
  Globe,
} from "lucide-react";
import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";

import { BannerOffline } from "@/layout/EstudioTemplates";
import { IDIOMAS } from "@/domains/garlia/canciones/constants";
import { useCancionEditor } from "@/domains/garlia/canciones/useCancionEditor";
import { secUpdate, secCreate } from "@/domains/garlia/canciones/seccionesDb";
import { supabase } from "@/infra/supabase/supabase";
import type {
  Seccion,
  IdiomaKey,
  EditorTab,
} from "@/domains/garlia/canciones/types";

import { SeccionTextarea } from "./SeccionTextarea";
import { ModalLectorLetras } from "../modals/ModalLectorLetras";
import { PanelGuionMV } from "../panels/PanelGuionMV";
import { PanelInfoSidebar } from "../panels/PanelInfoSidebar";
import { PanelLinks } from "../panels/PanelLinks";

export const PanelEditor = ({
  cancionId,
  onNavigatePersonaje,
  onNavigateReino,
  onNavigateCiudad,
  onNavigateGrupo,
}: {
  cancionId: string;
  // Navegación cruzada opcional (ver PanelInfoSidebar): se propagan tal
  // cual hacia el sidebar de metadatos, que es quien las conecta a los
  // ComboSelector de Personaje/Reino/Ciudad.
  onNavigatePersonaje?: (id: string) => void;
  onNavigateReino?: (id: string) => void;
  onNavigateCiudad?: (id: string) => void;
  onNavigateGrupo?: (id: string) => void;
}) => {
  const {
    cancion,
    setCancion,
    loading,
    isOffline: editorOffline,
  } = useCancionEditor(cancionId);

  // Estados de UI
  const [modoJapones, setModoJapones] = useState<"romaji" | "jp">("romaji");
  const [activeTab, setActiveTab] = useState<EditorTab>("letras");
  const [countMode, setCountMode] = useState<"silabas" | "vocales">("silabas");
  const [tituloInput, setTituloInput] = useState(cancion?.titulo || "");

  // Mantener el input de título sincronizado si cambia desde afuera
  // (ej. recarga de datos, edición concurrente).
  useEffect(() => {
    setTituloInput(cancion?.titulo || "");
  }, [cancion?.titulo]);

  // Estados de Modales/Edición
  const [showLector, setShowLector] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [creandoBloque, setCreandoBloque] = useState(false);

  // Texto en vivo de cada columna (para el indicador lateral de
  // sílabas/vocales, que se actualiza mientras se tipea). `texto` es
  // siempre la columna izquierda (Español); `textoDerecha` es la columna
  // del idioma de la canción, cuando existe (no-Español).
  const [texto, setTexto] = useState("");
  const [textoDerecha, setTextoDerecha] = useState("");

  // ── Idioma a mostrar: se define en la barra lateral (cancion.idioma),
  // no acá. Único caso con selector propio: Japonés tiene dos formas de
  // escritura (romaji/kanji) que no son "idiomas" distintos en la sidebar,
  // así que ese matiz sí necesita un botón chico en el editor.
  const idiomaSidebar = cancion?.idioma?.trim() || "";
  const idioma: IdiomaKey | null =
    idiomaSidebar === "Español" ? "es" :
    idiomaSidebar === "Inglés"  ? "en" :
    idiomaSidebar === "Japonés" ? modoJapones :
    null;

  // --- Handlers de Datos (Mantenidos del original) ---
  const handleSaveField = useCallback(
    async (id: string, updates: Partial<Seccion>) => {
      await secUpdate(id, updates);
      setCancion((prev) =>
        prev
          ? {
              ...prev,
              secciones: prev.secciones?.map((s) =>
                s.id === id ? { ...s, ...updates } : s,
              ),
            }
          : prev,
      );
    },
    [setCancion],
  );

  const handleSaveTitulo = useCallback(
    async (titulo: string) => {
      setCancion((prev) => (prev ? { ...prev, titulo } : prev));
      try {
        await supabase
          .from("canciones")
          .update({ titulo: titulo || null })
          .eq("id", cancionId);
      } catch (e) {
        console.error("Error al guardar título:", e);
      }
    },
    [cancionId, setCancion],
  );

  // El bloque único de letra de la canción (a lo sumo 1 elemento esperado).
  // Defensivo: si por algún motivo hubiera más de una fila, preferimos la
  // que tenga contenido antes que la primera por orden arbitrario.
  const bloque: Seccion | undefined =
    cancion?.secciones?.find((s) =>
      IDIOMAS.some((i) => !!(s[i.campo] as string)?.trim()),
    ) ?? cancion?.secciones?.[0];

  // Al cambiar de canción/bloque, limpiar el texto en vivo para que el
  // indicador lateral no arrastre valores de otra canción.
  useEffect(() => {
    setTexto("");
    setTextoDerecha("");
  }, [bloque?.id]);

  // Si la canción todavía no tiene su bloque único, lo creamos automáticamente
  // apenas el editor carga (canciones nuevas, o migradas sin fila previa).
  // Usamos un ref (no un state) como guard: el state se actualiza de forma
  // asíncrona, así que si el efecto se disparaba dos veces seguidas (doble
  // render de React, cambios rápidos de cancionId) ambas ejecuciones podían
  // pasar el chequeo antes de que el primer setCreandoBloque(true) surtiera
  // efecto, generando dos filas de bloque único para la misma canción.
  const creandoBloqueParaRef = useRef<string | null>(null);
  useEffect(() => {
    if (!cancion || loading || bloque) return;
    if (creandoBloqueParaRef.current === cancionId) return;
    creandoBloqueParaRef.current = cancionId;
    setCreandoBloque(true);
    secCreate({
      cancion_id: cancionId,
      nombre_seccion: "",
      letra_es: "",
      orden: 0,
    })
      .then((nueva) => {
        setCancion((prev) =>
          prev && !prev.secciones?.length
            ? { ...prev, secciones: [nueva] }
            : prev,
        );
      })
      .finally(() => {
        setCreandoBloque(false);
        creandoBloqueParaRef.current = null;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cancion, loading, bloque, cancionId]);

  // --- Helpers de Cálculo ---
  const secciones = useMemo(() => (bloque ? [bloque] : []), [bloque]);

  const TABS = [
    { id: "letras", label: "Letras", icon: <Music size={12} /> },
    { id: "guion", label: "Guion", icon: <Film size={12} /> },
  ] as { id: EditorTab; label: string; icon: React.ReactNode }[];

  if (loading)
    return (
      <div className="flex-1 flex items-center justify-center text-primary/30">
        <Loader2 className="animate-spin" size={28} />
      </div>
    );
  if (!cancion) return null;

  return (
    <div className="flex-1 flex min-h-0 overflow-hidden bg-bg-main">
      {/* Modal lector / karaoke */}
      {showLector && (
        <ModalLectorLetras
          cancionId={cancionId}
          cancionTitulo={cancion.titulo}
          duracion={cancion.duracion_segundos}
          isOpen={showLector}
          secciones={secciones}
          onClose={() => setShowLector(false)}
          onSeccionTimingsChange={(seccionId, col, timings) => {
            const idiomaKey = col.replace("timings_", "") as IdiomaKey;
            const timingField = `timings_${idiomaKey}` as keyof Seccion;
            setCancion((prev) =>
              prev
                ? {
                    ...prev,
                    secciones: prev.secciones?.map((s) =>
                      s.id === seccionId ? { ...s, [timingField]: timings } : s,
                    ),
                  }
                : prev,
            );
          }}
        />
      )}

      {/* ── Columna principal: header + contenido scrollable ── */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {editorOffline && (
          <BannerOffline
            color="amber"
            mensaje="Sin conexión — los cambios se sincronizan al reconectar"
          />
        )}

        {/* ── HEADER ── */}
        <header className="shrink-0 border-b border-primary/10 bg-bg-main">
          <div className="px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-4">
            {/* Identidad de Canción */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <input
                className="flex-1 min-w-0 bg-transparent text-sm sm:text-base font-black uppercase italic tracking-tight text-primary truncate outline-none hover:bg-primary/5 focus:bg-primary/8 rounded-lg px-1.5 py-0.5 -mx-1.5 transition-colors placeholder:text-primary/20"
                placeholder="Nombre de la canción…"
                value={tituloInput}
                onBlur={() => {
                  if (tituloInput !== cancion.titulo) handleSaveTitulo(tituloInput);
                }}
                onChange={(e) => setTituloInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
              />
            </div>

            {/* Navegación (Tabs) */}
            <nav className="hidden md:flex items-center bg-primary/5 p-1 rounded-xl border border-primary/10">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-micro font-black uppercase tracking-[0.15em] transition-all ${
                    activeTab === tab.id
                      ? "bg-primary text-bg-main"
                      : "text-primary/40 hover:text-primary"
                  }`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </nav>

            {/* Acciones e Indicadores */}
            <div className="flex items-center gap-2">
              <button
                className="p-2 rounded-lg transition-all"
                style={{
                  background:
                    "color-mix(in srgb, var(--callout-success-border) 10%, transparent)",
                  color: "var(--callout-success-border)",
                }}
                title="Karaoke"
                onClick={() => setShowLector(true)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background =
                    "var(--callout-success-border)";
                  e.currentTarget.style.color = "var(--bg-main)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background =
                    "color-mix(in srgb, var(--callout-success-border) 10%, transparent)";
                  e.currentTarget.style.color = "var(--callout-success-border)";
                }}
              >
                <FileText size={16} />
              </button>
              <button
                className="lg:hidden p-2 rounded-lg hover:bg-primary/5 text-primary/30"
                title="Ficha técnica"
                onClick={() => setMobileSidebarOpen(true)}
              >
                <PanelRight size={14} />
              </button>
            </div>
          </div>

          {/* Toolbar Contextual para Letras */}
          {activeTab === "letras" && (
            <div className="px-4 sm:px-6 py-2 bg-primary/[0.01] flex items-center justify-between overflow-x-auto no-scrollbar">
              <div className="flex items-center gap-3">
                {idioma === "romaji" || idioma === "jp" ? (
                  <div className="flex items-center gap-1 bg-bg-main border border-primary/10 p-0.5 rounded-lg shrink-0">
                    {(["romaji", "jp"] as const).map((m) => (
                      <button
                        key={m}
                        className={`px-3 py-1.5 rounded-lg text-micro font-black uppercase tracking-widest transition-all ${
                          modoJapones === m
                            ? "bg-primary text-bg-main"
                            : "text-primary/40 hover:text-primary"
                        }`}
                        onClick={() => setModoJapones(m)}
                      >
                        {m === "romaji" ? "Romaji" : "Kanji"}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="flex items-center gap-4 shrink-0">
                <div className="flex bg-primary/5 rounded-lg p-0.5 border border-primary/10">
                  {(["silabas", "vocales"] as const).map((m) => (
                    <button
                      key={m}
                      className={`px-2 py-1 rounded-md text-micro font-black uppercase transition-all ${
                        countMode === m
                          ? "bg-primary text-bg-main"
                          : "text-primary/30 hover:text-primary/60"
                      }`}
                      onClick={() => setCountMode(m)}
                    >
                      {m === "silabas" ? "Síl" : "Voc"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tabs Mobile (Solo se ven en pantallas pequeñas) */}
          <div className="md:hidden flex p-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                className={`flex-1 flex flex-col items-center py-2 gap-1 rounded-lg transition-all ${
                  activeTab === tab.id
                    ? "text-primary bg-primary/5"
                    : "text-primary/30"
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.icon}
                <span className="text-micro font-black uppercase tracking-widest">
                  {tab.label}
                </span>
              </button>
            ))}
          </div>
        </header>

        {/* ── CONTENIDO SCROLLABLE ── */}
        <main className="flex-1 overflow-y-auto">
          {activeTab === "letras" && (
            <div className="px-2 sm:px-3 py-6 space-y-4 w-full">
              {!idioma ? (
                <div className="flex flex-col items-center gap-2 py-20 text-primary/25">
                  <Globe size={24} strokeWidth={1.5} />
                  <p className="text-micro font-black uppercase tracking-[0.15em] text-center max-w-[220px]">
                    Elegí un idioma en la barra lateral para empezar a escribir
                  </p>
                </div>
              ) : bloque ? (
                <div className="px-2 pb-2 flex gap-4">
                  {/* Columna izquierda: Español, siempre fija (para la traducción) */}
                  <SeccionTextarea
                    countMode={countMode}
                    idioma="es"
                    refIdioma={idioma !== "es" ? idioma : undefined}
                    sec={bloque}
                    showSyllableColumn
                    onSave={handleSaveField}
                    onTextoChange={setTexto}
                  />

                  {/* Columna derecha: idioma de la canción (sidebar), solo si
                      no es Español — evita duplicar la misma columna. */}
                  {idioma !== "es" && (
                    <SeccionTextarea
                      countMode={countMode}
                      idioma={idioma}
                      refIdioma="es"
                      sec={bloque}
                      showSyllableColumn
                      onSave={handleSaveField}
                      onTextoChange={setTextoDerecha}
                    />
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-20 text-primary/20">
                  <Loader2 className="animate-spin" size={28} strokeWidth={1} />
                  <p className="text-micro font-black uppercase tracking-[0.2em]">
                    Preparando editor…
                  </p>
                </div>
              )}

              <PanelLinks
                cancionId={cancionId}
                links={cancion.links || []}
                onLinksChange={(newLinks) =>
                  setCancion((prev) =>
                    prev ? { ...prev, links: newLinks } : prev,
                  )
                }
              />
            </div>
          )}

          {activeTab === "guion" && (
            <div className="max-w-6xl mx-auto py-6 px-4">
              <PanelGuionMV
                cancionId={cancionId}
                guionInicial={cancion.guion_mv}
                idiomaActivo={idioma ?? "es"}
                secciones={secciones}
                onGuionChange={(g) =>
                  setCancion((prev) => (prev ? { ...prev, guion_mv: g } : prev))
                }
              />
            </div>
          )}
        </main>
      </div>

      {/* ── Barra lateral: Ficha técnica / metadatos de la canción ── */}
      <PanelInfoSidebar
        cancion={cancion}
        cancionId={cancionId}
        mobileOpen={mobileSidebarOpen}
        onCancionUpdate={(updates) =>
          setCancion((prev) => (prev ? { ...prev, ...updates } : prev))
        }
        onMobileClose={() => setMobileSidebarOpen(false)}
        onNavigateCiudad={onNavigateCiudad}
        onNavigatePersonaje={onNavigatePersonaje}
        onNavigateReino={onNavigateReino}
        onNavigateGrupo={onNavigateGrupo}
      />
    </div>
  );
};
