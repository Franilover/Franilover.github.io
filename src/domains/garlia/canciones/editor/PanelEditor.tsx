"use client";

import {
  Music,
  Film,
  Loader2,
  RefreshCw,
  FileText,
  Columns2,
  Globe,
  Mic2,
  PanelRight,
} from "lucide-react";
import React, { useState, useCallback, useEffect, useMemo } from "react";

import { BannerOffline } from "@/layout/EstudioTemplates";
import {
  IDIOMAS,
  ESTADO_COLOR,
} from "@/domains/garlia/canciones/constants";
import { useCancionEditor } from "@/domains/garlia/canciones/useCancionEditor";
import { secUpdate, secCreate } from "@/domains/garlia/canciones/seccionesDb";
import type {
  Seccion,
  IdiomaKey,
  EditorTab,
} from "@/domains/garlia/canciones/types";

import { IdiomaTab } from "./IdiomaTab";
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
    reload,
  } = useCancionEditor(cancionId);

  // Estados de UI
  const [idiomaA, setIdiomaA] = useState<IdiomaKey>("es");
  const [idiomaB, setIdiomaB] = useState<IdiomaKey>("en");
  const [splitMode, setSplitMode] = useState(false);
  const [activeTab, setActiveTab] = useState<EditorTab>("letras");
  const [countMode, setCountMode] = useState<"silabas" | "vocales">("silabas");

  // Estados de Modales/Edición
  const [showLector, setShowLector] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [creandoBloque, setCreandoBloque] = useState(false);

  // Responsive Split Mode
  useEffect(() => {
    const wide = window.innerWidth >= 768;
    setSplitMode(wide);
  }, []);

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

  // El bloque único de letra de la canción (a lo sumo 1 elemento).
  const bloque: Seccion | undefined = cancion?.secciones?.[0];

  // Si la canción todavía no tiene su bloque único, lo creamos automáticamente
  // apenas el editor carga (canciones nuevas, o migradas sin fila previa).
  useEffect(() => {
    if (!cancion || loading || bloque || creandoBloque) return;
    setCreandoBloque(true);
    secCreate({
      cancion_id: cancionId,
      nombre_seccion: "",
      letra_es: "",
      orden: 0,
    })
      .then((nueva) => {
        setCancion((prev) =>
          prev ? { ...prev, secciones: [nueva] } : prev,
        );
      })
      .finally(() => setCreandoBloque(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cancion, loading, bloque, cancionId]);

  const changeIdiomaA = (v: IdiomaKey) => {
    setIdiomaA(v);
    if (splitMode && v === idiomaB)
      setIdiomaB(IDIOMAS.find((i) => i.id !== v)!.id);
  };
  const changeIdiomaB = (v: IdiomaKey) => {
    setIdiomaB(v);
    if (v === idiomaA) setIdiomaA(IDIOMAS.find((i) => i.id !== v)!.id);
  };

  // --- Helpers de Cálculo ---
  const secciones = useMemo(() => (bloque ? [bloque] : []), [bloque]);
  const campoA = IDIOMAS.find((i) => i.id === idiomaA)!.campo;
  const tieneLetra = !!(bloque?.[campoA] as string)?.trim();
  const pct = bloque ? (tieneLetra ? 100 : 0) : 0;

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
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-sm sm:text-base font-black uppercase italic tracking-tight text-primary truncate">
                    {cancion.titulo}
                  </h1>
                  <span
                    className="text-micro font-bold px-1.5 py-0.5 rounded border leading-none shrink-0"
                    style={ESTADO_COLOR[cancion.estado]}
                  >
                    {cancion.estado}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-micro font-medium text-primary/30 uppercase tracking-wider truncate">
                  <span className="flex items-center gap-1">
                    <Mic2 size={10} /> {cancion.cantante || "Artista"}
                  </span>
                  <span className="opacity-20">•</span>
                  <span className="flex items-center gap-1">
                    <Globe size={10} /> {cancion.idioma}
                  </span>
                </div>
              </div>
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
              <div className="hidden sm:flex flex-col items-end mr-2">
                <span className="text-micro font-black text-primary/40 leading-none">
                  {pct}%
                </span>
                <span className="text-micro font-bold text-primary/20 uppercase tracking-tighter">
                  Completado
                </span>
              </div>
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
                className="p-2 rounded-lg hover:bg-primary/5 text-primary/30"
                onClick={reload as any}
              >
                <RefreshCw size={14} />
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
            <div className="px-4 sm:px-6 py-2 border-t border-primary/5 bg-primary/[0.01] flex items-center justify-between overflow-x-auto no-scrollbar">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 bg-bg-main border border-primary/10 p-0.5 rounded-lg shrink-0">
                  <IdiomaTab
                    exclude={splitMode ? idiomaB : undefined}
                    value={idiomaA}
                    onChange={changeIdiomaA}
                  />
                  {splitMode && (
                    <>
                      <div className="w-[1px] h-3 bg-primary/10 mx-1" />
                      <IdiomaTab
                        exclude={idiomaA}
                        value={idiomaB}
                        onChange={changeIdiomaB}
                      />
                    </>
                  )}
                </div>
                <button
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-micro font-black uppercase border transition-all shrink-0 ${
                    splitMode
                      ? "bg-primary text-bg-main border-primary"
                      : "border-primary/10 text-primary/40 hover:border-primary/30"
                  }`}
                  onClick={() => setSplitMode((m) => !m)}
                >
                  <Columns2 size={12} />
                  <span className="hidden sm:inline">
                    {splitMode ? "Simple" : "Split View"}
                  </span>
                </button>
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
                <span className="text-micro font-black text-primary/20 uppercase tracking-widest hidden sm:block">
                  {tieneLetra ? "Con letra" : "Sin letra"}
                </span>
              </div>
            </div>
          )}

          {/* Tabs Mobile (Solo se ven en pantallas pequeñas) */}
          <div className="md:hidden flex border-t border-primary/5 p-1">
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
              {bloque ? (
                <div
                  className={`px-2 pb-2 ${splitMode ? "flex gap-3" : ""}`}
                >
                  <SeccionTextarea
                    countMode={countMode}
                    idioma={idiomaA}
                    refIdioma={splitMode ? idiomaB : undefined}
                    sec={bloque}
                    onSave={handleSaveField}
                  />
                  {splitMode && (
                    <>
                      <div className="w-px bg-primary/10 shrink-0 self-stretch" />
                      <SeccionTextarea
                        countMode={countMode}
                        idioma={idiomaB}
                        refIdioma={idiomaA}
                        sec={bloque}
                        onSave={handleSaveField}
                      />
                    </>
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
                idiomaActivo={idiomaA}
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
