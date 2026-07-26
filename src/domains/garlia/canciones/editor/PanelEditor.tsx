"use client";

import { motion } from "framer-motion";
import {
  Music,
  Film,
  Loader2,
  RefreshCw,
  FileText,
  Columns2,
  Plus,
  Check,
  X,
  Layers,
  Globe,
  Mic2,
  PanelRight,
} from "lucide-react";
import React, { useState, useCallback, useEffect } from "react";

import { BannerOffline } from "@/components/layout/EstudioTemplates";
import {
  IDIOMAS,
  ESTADO_COLOR,
} from "@/domains/garlia/canciones/constants";
import { useCancionEditor } from "@/domains/garlia/canciones/useCancionEditor";
import {
  secUpdate,
  secCreate,
  secDelete,
  secReorder,
} from "@/domains/garlia/canciones/seccionesDb";
import type {
  Seccion,
  IdiomaKey,
  EditorTab,
} from "@/domains/garlia/canciones/types";

import { IdiomaTab } from "./IdiomaTab";
import { SeccionEditor } from "./SeccionEditor";
import { ModalLectorLetras } from "../modals/ModalLectorLetras";
import { PanelGuionMV } from "../panels/PanelGuionMV";
import { PanelInfoSidebar } from "../panels/PanelInfoSidebar";
import { PanelLinks } from "../panels/PanelLinks";

export const PanelEditor = ({
  cancionId,
  onNavigatePersonaje,
  onNavigateReino,
  onNavigateCiudad,
}: {
  cancionId: string;
  // Navegación cruzada opcional (ver PanelInfoSidebar): se propagan tal
  // cual hacia el sidebar de metadatos, que es quien las conecta a los
  // ComboSelector de Personaje/Reino/Ciudad.
  onNavigatePersonaje?: (id: string) => void;
  onNavigateReino?: (id: string) => void;
  onNavigateCiudad?: (id: string) => void;
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
  const [addingOpen, setAddingOpen] = useState(false);
  const [addingName, setAddingName] = useState("");
  const [showLector, setShowLector] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

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

  const handleSaveNombre = useCallback(
    async (id: string, nombre: string) => {
      await secUpdate(id, { nombre_seccion: nombre });
      setCancion((prev) =>
        prev
          ? {
              ...prev,
              secciones: prev.secciones?.map((s) =>
                s.id === id ? { ...s, nombre_seccion: nombre } : s,
              ),
            }
          : prev,
      );
    },
    [setCancion],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await secDelete(id);
      setCancion((prev) =>
        prev
          ? { ...prev, secciones: prev.secciones?.filter((s) => s.id !== id) }
          : prev,
      );
    },
    [setCancion],
  );

  const handleAdd = async () => {
    if (!addingName.trim()) return;
    const secciones = cancion?.secciones || [];
    const nueva = await secCreate({
      cancion_id: cancionId,
      nombre_seccion: addingName.trim().toUpperCase(),
      letra_es: "",
      orden: secciones.length,
    });
    setCancion((prev) =>
      prev ? { ...prev, secciones: [...(prev.secciones || []), nueva] } : prev,
    );
    setAddingName("");
    setAddingOpen(false);
  };

  const handleDuplicate = useCallback(
    async (sec: Seccion) => {
      const secciones = cancion?.secciones || [];
      const idx = secciones.findIndex((s) => s.id === sec.id);
      const insertAt = idx + 1;
      const tmpSecs = [...secciones];
      const nueva = await secCreate({
        cancion_id: cancionId,
        nombre_seccion: sec.nombre_seccion + " (2)",
        letra_es: sec.letra_es || "",
        letra_en: sec.letra_en,
        letra_jp: sec.letra_jp,
        letra_romaji: sec.letra_romaji,
        orden: insertAt,
      });
      tmpSecs.splice(insertAt, 0, nueva);
      const reordenadas = tmpSecs.map((s, i) => ({ ...s, orden: i }));
      setCancion((prev) => (prev ? { ...prev, secciones: reordenadas } : prev));
      await secReorder(reordenadas.map((s) => ({ id: s.id, orden: s.orden })));
    },
    [cancion, cancionId, setCancion],
  );

  const handleMove = async (index: number, dir: "up" | "down") => {
    const secs = [...(cancion?.secciones || [])];
    const target = dir === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= secs.length) return;
    [secs[index], secs[target]] = [secs[target], secs[index]];
    const reordenadas = secs.map((s, i) => ({ ...s, orden: i }));
    setCancion((prev) => (prev ? { ...prev, secciones: reordenadas } : prev));
    await secReorder(reordenadas.map((s) => ({ id: s.id, orden: s.orden })));
  };

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
  const secciones = cancion?.secciones || [];
  const campoA = IDIOMAS.find((i) => i.id === idiomaA)!.campo;
  const conLetra = secciones.filter(
    (s) => !!(s[campoA] as string)?.trim(),
  ).length;
  const pct = secciones.length
    ? Math.round((conLetra / secciones.length) * 100)
    : 0;

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
                  Secciones: {conLetra}/{secciones.length}
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
              {secciones.length > 0 ? (
                <div className="bg-bg-main/50 divide-y divide-primary/8">
                  {secciones.map((sec, i) => (
                    <SeccionEditor
                      key={sec.id}
                      countMode={countMode}
                      idiomaA={idiomaA}
                      idiomaB={idiomaB}
                      isFirst={i === 0}
                      isLast={i === secciones.length - 1}
                      sec={sec}
                      splitMode={splitMode}
                      onDelete={handleDelete}
                      onDuplicate={handleDuplicate}
                      onMoveDown={() => handleMove(i, "down")}
                      onMoveUp={() => handleMove(i, "up")}
                      onSaveField={handleSaveField}
                      onSaveNombre={handleSaveNombre}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-20 text-primary/20">
                  <Layers size={48} strokeWidth={1} />
                  <p className="text-micro font-black uppercase tracking-[0.2em]">
                    Sin secciones aún
                  </p>
                </div>
              )}

              {addingOpen ? (
                <motion.div
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-2"
                  initial={{ opacity: 0, y: 10 }}
                >
                  <input
                    autoFocus
                    className="flex-1 bg-bg-main border border-primary/20 rounded-xl px-4 py-3 text-xs font-black uppercase text-primary outline-none focus:border-primary/50 tracking-widest"
                    placeholder="NOMBRE DE LA SECCIÓN..."
                    value={addingName}
                    onChange={(e) => setAddingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleAdd();
                      if (e.key === "Escape") setAddingOpen(false);
                    }}
                  />
                  <button
                    className="bg-primary text-bg-main px-6 rounded-xl font-black transition-transform active:scale-95"
                    onClick={handleAdd}
                  >
                    <Check size={18} />
                  </button>
                  <button
                    className="p-4 rounded-xl border border-primary/10 text-primary/30 hover:text-primary transition-all"
                    onClick={() => setAddingOpen(false)}
                  >
                    <X size={18} />
                  </button>
                </motion.div>
              ) : (
                <button
                  className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl border border-dashed border-primary/10 text-micro font-black uppercase text-primary/30 hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-all tracking-[0.3em]"
                  onClick={() => setAddingOpen(true)}
                >
                  <Plus size={14} /> Añadir Sección
                </button>
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
      />
    </div>
  );
};
