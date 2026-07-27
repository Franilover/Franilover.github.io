"use client";

import {
  X,
  Copy,
  Timer,
  FileText,
  Play,
  Pause,
  SkipBack,
  Clock,
  Trash2,
  Upload,
  Dot,
} from "lucide-react";
import React, { useState, useEffect, useRef, useMemo } from "react";

import { IDIOMAS } from "@/domains/garlia/canciones/constants";
import { useKaraoke } from "@/domains/garlia/canciones/useKaraoke";
import {
  buildLineas,
  parseLrc,
  fmtTime,
} from "@/domains/garlia/canciones/karaokeUtils";
import type {
  Seccion,
  IdiomaKey,
} from "@/domains/garlia/canciones/types";
import { supabase } from "@/infra/supabase/supabase";

export const ModalLectorLetras = ({
  isOpen,
  onClose,
  secciones,
  cancionTitulo,
  cancionId,
  duracion,
  onSeccionTimingsChange,
}: {
  isOpen: boolean;
  onClose: () => void;
  secciones: Seccion[];
  cancionTitulo: string;
  cancionId: string;
  duracion?: number | null;
  onSeccionTimingsChange?: (
    seccionId: string,
    col: string,
    timings: Record<string, number>,
  ) => void;
}) => {
  const [idioma, setIdioma] = useState<IdiomaKey>("es");
  const [modoKaraoke, setModoKaraoke] = useState(true);
  const [zoom, setZoom] = useState(0.7);
  const [editandoTiempo, setEditandoTiempo] = useState<{
    seccionId: string;
    lineaIdx: number;
  } | null>(null);
  const [tiempoEditStr, setTiempoEditStr] = useState("");
  const activaRef = useRef<HTMLDivElement>(null);
  const lrcInputRef = useRef<HTMLInputElement>(null);

  const karaoke = useKaraoke(
    cancionId,
    idioma,
    secciones,
    duracion,
    onSeccionTimingsChange,
  );
  const sliderMax = duracion ?? 600;

  const getLetra = (sec: Seccion, lang: IdiomaKey): string =>
    (lang === "es"
      ? sec.letra_es
      : lang === "en"
        ? sec.letra_en
        : lang === "jp"
          ? sec.letra_jp
          : sec.letra_romaji) || "";

  const handleCopy = () => {
    const texto = secciones
      .map((s) => {
        const l = getLetra(s, idioma);
        return l ? `${s.nombre_seccion}\n\n${l}` : "";
      })
      .filter(Boolean)
      .join("\n\n---\n\n");
    void navigator.clipboard.writeText(texto);
  };

  const lineas = useMemo(
    () => buildLineas(secciones, idioma),
    [secciones, idioma],
  );
  const lineaActiva = karaoke.getLineaActiva(lineas);

  useEffect(() => {
    if (modoKaraoke && activaRef.current) {
      activaRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [lineaActiva, modoKaraoke]);

  const handleLrcImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const texto = await file.text();
    const parsed = parseLrc(texto, secciones, idioma);
    const col = `timings_${idioma}`;
    for (const [secId, timings] of Object.entries(parsed)) {
      const data = Object.fromEntries(
        Object.entries(timings).map(([k, v]) => [String(k), v]),
      );
      await supabase
        .from("secciones_cancion")
        .update({ [col]: data })
        .eq("id", secId);
      onSeccionTimingsChange?.(secId, col, data);
    }
    // force re-render of timings
    setIdioma((prev) => {
      setTimeout(() => setIdioma(prev), 50);
      return prev === "es" ? "en" : "es";
    });
    if (lrcInputRef.current) lrcInputRef.current.value = "";
  };

  const iniciarEdicion = (seccionId: string, lineaIdx: number) => {
    const t = karaoke.getTiempo(seccionId, lineaIdx);
    setEditandoTiempo({ seccionId, lineaIdx });
    setTiempoEditStr(t !== null ? fmtTime(t) : "");
  };

  const confirmarEdicion = () => {
    if (!editandoTiempo) return;
    const { seccionId, lineaIdx } = editandoTiempo;
    const str = tiempoEditStr.trim();
    let seg: number | null = null;
    const mmss = str.match(/^(\d+):(\d+\.?\d*)$/);
    if (mmss) {
      seg = parseInt(mmss[1]) * 60 + parseFloat(mmss[2]);
    } else {
      const plain = parseFloat(str);
      if (!isNaN(plain)) seg = plain;
    }

    if (seg !== null) {
      karaoke.setTiempo(seccionId, lineaIdx, Math.round(seg * 10) / 10);
    }
    setEditandoTiempo(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center">
      <div
        className="absolute inset-0 bg-primary/40 backdrop-blur-md"
        onClick={onClose}
      />

      <div className="bg-bg-main w-full max-w-4xl h-[100dvh] md:h-[92vh] md:rounded-[var(--radius-card)] shadow-2xl relative z-10 border border-primary/10 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-2.5 bg-white-custom border-b border-primary/10 flex-shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-primary font-black uppercase text-micro tracking-[0.2em] italic truncate flex-1 min-w-0">
              {cancionTitulo}
            </span>

            {/* Selector de idioma */}
            <div className="flex gap-0.5 p-0.5 bg-primary/5 rounded-lg border border-primary/10">
              {IDIOMAS.map(({ id, label }) => (
                <button
                  key={id}
                  className={`px-2 py-1 rounded-md text-micro font-black uppercase tracking-widest transition-all ${
                    idioma === id
                      ? "bg-primary text-bg-main shadow"
                      : "text-primary/40 hover:text-primary"
                  }`}
                  onClick={() => {
                    setIdioma(id);
                    karaoke.reset();
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Modo karaoke / letra */}
            <div className="flex gap-0.5 p-0.5 bg-primary/5 rounded-lg border border-primary/10">
              <button
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-micro font-black uppercase tracking-widest transition-all ${
                  modoKaraoke
                    ? "bg-primary text-bg-main shadow"
                    : "text-primary/40 hover:text-primary"
                }`}
                onClick={() => setModoKaraoke(true)}
              >
                <Timer size={10} /> Karaoke
              </button>
              <button
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-micro font-black uppercase tracking-widest transition-all ${
                  !modoKaraoke
                    ? "bg-primary text-bg-main shadow"
                    : "text-primary/40 hover:text-primary"
                }`}
                onClick={() => setModoKaraoke(false)}
              >
                <FileText size={10} /> Letra
              </button>
            </div>

            {!modoKaraoke && (
              <div className="flex items-center gap-0.5">
                <button
                  className="w-6 h-6 flex items-center justify-center bg-primary/5 rounded text-primary hover:bg-primary/10 font-bold text-sm"
                  onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))}
                >
                  -
                </button>
                <span className="text-micro font-black text-primary/50 w-8 text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  className="w-6 h-6 flex items-center justify-center bg-primary/5 rounded text-primary hover:bg-primary/10 font-bold text-sm"
                  onClick={() => setZoom((z) => Math.min(1.6, z + 0.1))}
                >
                  +
                </button>
              </div>
            )}

            <button
              className="p-1.5 rounded-lg hover:bg-primary/10 text-primary/30 hover:text-primary transition-all"
              title="Copiar letra"
              onClick={handleCopy}
            >
              <Copy size={14} />
            </button>
            <button
              className="p-1.5 rounded-lg hover:bg-primary/10 text-primary/30 hover:text-primary transition-all"
              onClick={onClose}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Controles karaoke */}
        {modoKaraoke && (
          <div className="flex-shrink-0 border-b border-primary/10 bg-white-custom/80 backdrop-blur-sm">
            <div className="px-4 py-2 flex items-center gap-2">
              <button
                className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary text-bg-main hover:opacity-90 active:scale-95 transition-all shrink-0"
                onClick={karaoke.toggle}
              >
                {karaoke.playing ? <Pause size={15} /> : <Play size={15} />}
              </button>

              <button
                className="p-2 rounded-xl border border-primary/15 text-primary/40 hover:text-primary hover:border-primary/30 transition-all shrink-0"
                title="Reiniciar"
                onClick={karaoke.reset}
              >
                <SkipBack size={13} />
              </button>

              <span className="font-mono text-xs font-black text-primary tracking-widest shrink-0 min-w-[60px]">
                {fmtTime(karaoke.elapsed)}
              </span>

              <div className="flex-1 min-w-0">
                <input
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                  max={sliderMax}
                  min={0}
                  step={0.1}
                  style={{ accentColor: "var(--primary)" }}
                  type="range"
                  value={Math.min(karaoke.elapsed, sliderMax)}
                  onChange={(e) => karaoke.seekTo(parseFloat(e.target.value))}
                />
              </div>

              <button
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-micro font-black uppercase tracking-widest border transition-all shrink-0 ${
                  karaoke.modoEdit
                    ? "bg-accent/20 border-accent text-accent"
                    : "border-primary/15 text-primary/40 hover:text-primary hover:border-primary/30"
                }`}
                onClick={() => karaoke.setModoEdit((m) => !m)}
              >
                <Clock size={10} />{" "}
                {karaoke.modoEdit ? "Vinculando" : "Vincular"}
              </button>

              <button
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-micro font-black uppercase tracking-widest border border-primary/15 text-primary/40 hover:text-primary hover:border-primary/30 transition-all shrink-0"
                title="Importar archivo .lrc"
                onClick={() => lrcInputRef.current?.click()}
              >
                <Upload size={10} /> .lrc
              </button>
              <input
                ref={lrcInputRef}
                accept=".lrc"
                className="hidden"
                type="file"
                onChange={handleLrcImport}
              />

              <button
                className="p-2 rounded-xl border border-primary/15 text-primary/30 hover:text-[var(--callout-danger-border)] hover:border-[color-mix(in_srgb,var(--callout-danger-border)_30%,transparent)] transition-all shrink-0"
                title="Borrar todos los tiempos"
                onClick={karaoke.borrarTodo}
              >
                <Trash2 size={12} />
              </button>
            </div>

            {karaoke.modoEdit && (
              <div className="px-4 pb-2">
                <p className="text-micro font-black uppercase tracking-widest text-accent flex items-center gap-1.5">
                  <Dot className="animate-pulse" size={12} />
                  Clic = marcar tiempo · Clic der = borrar · Clic en tiempo =
                  editar número
                </p>
              </div>
            )}
          </div>
        )}

        {/* Contenido */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-bg-main">
          {modoKaraoke ? (
            <div className="max-w-2xl mx-auto py-8 px-4 md:px-8">
              {secciones.map((sec) => {
                const texto = getLetra(sec, idioma);
                if (!texto.trim()) return null;
                const lineasSec = texto.split("\n");
                return (
                  <div key={sec.id} className="mb-8">
                    <div className="flex items-center gap-3 mb-3 opacity-25">
                      <div className="h-px flex-1 bg-primary" />
                      <span className="text-micro font-black uppercase tracking-[0.4em] text-primary">
                        {sec.nombre_seccion}
                      </span>
                      <div className="h-px flex-1 bg-primary" />
                    </div>

                    {lineasSec.map((linea, lineaIdx) => {
                      const tiempo = karaoke.getTiempo(sec.id, lineaIdx);
                      const globalIdx = lineas.findIndex(
                        (l) =>
                          l.seccionId === sec.id && l.lineaIdx === lineaIdx,
                      );
                      const isActiva = globalIdx === lineaActiva;
                      const isPasada = globalIdx < lineaActiva;
                      const esEditable =
                        editandoTiempo?.seccionId === sec.id &&
                        editandoTiempo?.lineaIdx === lineaIdx;

                      if (!linea.trim())
                        return <div key={lineaIdx} className="h-2" />;

                      return (
                        <div
                          key={lineaIdx}
                          ref={isActiva ? activaRef : undefined}
                          className={`group relative flex items-center gap-2 py-1 px-2 rounded-lg transition-all duration-200 ${
                            isActiva
                              ? "bg-primary/8"
                              : karaoke.modoEdit || tiempo !== null
                                ? "cursor-pointer hover:bg-primary/5 active:bg-primary/10"
                                : ""
                          }`}
                          onClick={() => {
                            if (karaoke.modoEdit)
                              karaoke.marcarLinea(sec.id, lineaIdx);
                            else if (tiempo !== null) karaoke.seekTo(tiempo);
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            if (karaoke.modoEdit)
                              karaoke.borrarLinea(sec.id, lineaIdx);
                          }}
                        >
                          {isActiva && (
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-primary rounded-r-full" />
                          )}

                          <span className="shrink-0 min-w-[52px]">
                            {esEditable ? (
                              <input
                                autoFocus
                                className="w-[52px] font-mono text-micro font-black text-primary bg-primary/10 border border-primary/30 rounded px-1 py-0.5 outline-none"
                                placeholder="0:00"
                                value={tiempoEditStr}
                                onBlur={confirmarEdicion}
                                onChange={(e) =>
                                  setTiempoEditStr(e.target.value)
                                }
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") confirmarEdicion();
                                  if (e.key === "Escape")
                                    setEditandoTiempo(null);
                                }}
                              />
                            ) : (
                              <button
                                className={`font-mono text-micro font-black tracking-widest transition-all rounded px-1 py-0.5 ${
                                  tiempo !== null
                                    ? isActiva
                                      ? "text-primary bg-primary/10"
                                      : isPasada
                                        ? "text-primary/20 hover:text-primary/50 hover:bg-primary/5"
                                        : "text-primary/35 hover:text-primary/60 hover:bg-primary/5"
                                    : karaoke.modoEdit
                                      ? "text-primary/15 group-hover:text-primary/35 group-hover:bg-primary/5"
                                      : "text-transparent"
                                }`}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  iniciarEdicion(sec.id, lineaIdx);
                                }}
                              >
                                {tiempo !== null ? fmtTime(tiempo) : "──:──"}
                              </button>
                            )}
                          </span>

                          <span
                            className={`text-lg md:text-xl font-serif leading-relaxed transition-all duration-200 flex-1 min-w-0 ${
                              isActiva
                                ? "text-primary font-bold scale-[1.02] origin-left"
                                : isPasada
                                  ? "text-primary/25"
                                  : "text-primary/55"
                            }`}
                          >
                            {linea}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              <div className="h-32" />
            </div>
          ) : (
            <div className="w-full overflow-x-hidden">
              <div
                className="origin-top transition-all duration-300 pb-16"
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: "top center",
                  paddingTop: "2rem",
                  paddingLeft: "1.5rem",
                  paddingRight: "1.5rem",
                  minHeight: `${100 / zoom}%`,
                }}
              >
                {secciones.map((sec) => {
                  const texto = getLetra(sec, idioma);
                  return texto ? (
                    <div
                      key={sec.id}
                      className="mb-16 last:mb-0 max-w-2xl mx-auto text-center"
                    >
                      <div className="mb-8 flex items-center justify-center gap-6 opacity-20">
                        <div className="h-px w-12 bg-primary" />
                        <span className="text-micro font-black uppercase tracking-[0.5em] italic text-primary">
                          {sec.nombre_seccion}
                        </span>
                        <div className="h-px w-12 bg-primary" />
                      </div>
                      <p className="text-foreground text-2xl md:text-4xl font-medium italic font-serif leading-[1.7] whitespace-pre-wrap break-words">
                        {texto}
                      </p>
                    </div>
                  ) : null;
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
