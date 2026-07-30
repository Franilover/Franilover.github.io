"use client";

import { Loader2, CheckCircle2, AlertCircle, WifiOff, Circle } from "lucide-react";
import React, { useState, useEffect, useCallback, useRef } from "react";

import { RichEditor } from "@/editor/lexical";
import { IDIOMAS, IDLE_STATE } from "@/domains/garlia/canciones/constants";
import { dexieSecGet } from "@/domains/garlia/canciones/seccionesDb";
import type { Seccion, IdiomaKey, ColState } from "@/domains/garlia/canciones/types";
import { DraftRestoreBanner, useDraftRestore } from "@/hooks/useEditorShared";

// ── Conteo ───────────────────────────────────────────────────────────────────

type CountMode = "silabas" | "vocales";

const VOCAL_RE = /[aeiouáéíóúàèìòùäëïöüâêîôûãõAEIOUÁÉÍÓÚÀÈÌÒÙÄËÏÖÜÂÊÎÔÛÃÕ]/g;

function contarVocales(s: string) {
  return (s.match(VOCAL_RE) ?? []).length;
}

function contarSilabas(s: string): number {
  const kana = s.match(/[\u3040-\u30FF]/g);
  if (kana && kana.length >= s.replace(/[\u3040-\u30FF\s]/g, "").length) {
    return kana.length;
  }
  const palabras = s.toLowerCase().match(/[a-záéíóúàèìòùäëïöüâêîôûãõñ]+/g) ?? [];
  let total = 0;
  for (const p of palabras) {
    const v = (p.match(VOCAL_RE) ?? []).length;
    if (!v) continue;
    const dipt = (p.match(/(?:[aeoáéó][iu]|[iu][aeoáéó]|[iu][iu])/g) ?? []).length;
    total += Math.max(1, v - dipt);
  }
  return total;
}

function contar(linea: string, modo: CountMode) {
  return modo === "vocales" ? contarVocales(linea) : contarSilabas(linea);
}

// ── Constantes de layout ─────────────────────────────────────────────────────
const FONT_SIZE_PX = 11;

// ── Columna de contadores ────────────────────────────────────────────────────

/**
 * Muestra el conteo de sílabas/vocales por línea en una columna lateral,
 * una fila por línea de texto. A diferencia del overlay anterior (que
 * posicionaba cada número en píxeles exactos sobre un <textarea>), esto
 * es una lista simple — RichEditor (Lexical/contentEditable) no tiene el
 * concepto de "línea de altura fija" que un textarea sí tiene, así que ya
 * no se puede alinear pixel-perfect con el texto real.
 */
export function SyllableColumn({
  texto,
  refLineas,
  countMode,
  align = "end",
}: {
  texto:     string;
  refLineas: string[] | null;
  countMode: CountMode;
  align?: "start" | "end";
}) {
  const lineas = texto.split("\n");
  const justify = align === "start" ? "justify-start" : "justify-end";

  return (
    <div
      aria-hidden
      className="flex flex-col shrink-0 select-none"
      // El padding-top y el line-height deben calzar exactamente con el
      // RichEditor (fontSize 11px, lineHeight 1.7, padding "4px 8px 8px")
      // para que cada número quede alineado con su línea real de texto.
      style={{ paddingTop: 4 }}
    >
      {lineas.map((linea, idx) => {
        const miN  = contar(linea, countMode);
        const refN = refLineas ? contar(refLineas[idx] ?? "", countMode) : null;
        const vacia = linea.trim() === "";

        let color = "";
        if (!vacia) {
          if (refN === null) {
            color =
              miN <= 6  ? "text-primary/30"
            : miN <= 10 ? "text-amber-400/50"
            :             "text-rose-400/50";
          } else {
            color = miN === refN ? "text-emerald-400/90" : "text-rose-400/90";
          }
        }

        return (
          <div
            key={idx}
            className={`flex items-center ${justify} gap-0.5 ${color}`}
            style={{ fontSize: FONT_SIZE_PX, lineHeight: 1.7, height: `${FONT_SIZE_PX * 1.7}px` }}
          >
            {!vacia && (
              <>
                <span className="text-micro font-black tabular-nums leading-none">
                  {miN}
                </span>
                {refN !== null && (
                  <>
                    <span className="text-micro opacity-40 mx-px">/</span>
                    <span className="text-micro font-black tabular-nums leading-none opacity-55">
                      {refN}
                    </span>
                  </>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────

export const SeccionTextarea = ({
  sec, idioma, refIdioma, onSave, nombreSeccion: _nombreSeccion, countMode,
  showSyllableColumn = true, onTextoChange,
}: {
  sec:           Seccion;
  idioma:        IdiomaKey;
  refIdioma?:    IdiomaKey;
  onSave:        (id: string, updates: Partial<Seccion>) => Promise<void>;
  nombreSeccion?: string;
  countMode:     "silabas" | "vocales";
  showSyllableColumn?: boolean;
  onTextoChange?: (texto: string) => void;
}) => {
  const campo     = IDIOMAS.find(i => i.id === idioma)!.campo;
  const serverVal = (sec[campo] as string) || "";

  const [texto, setTexto] = useState(serverVal);
  const [st,    setSt]    = useState<ColState>(IDLE_STATE);

  const timer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftKey = `sec-draft-${sec.id}-${idioma}`;
  const draft    = useDraftRestore({ key: draftKey, serverValue: serverVal, enabled: !!sec.id });

  // ── Sincronizar con servidor / Dexie ────────────────────────────────────
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const loadLocal = async () => {
      try {
        const local    = await dexieSecGet(sec.id);
        const localVal = local?.[campo] as string | undefined;
        if (local?.status === "pending" && localVal !== undefined && localVal !== serverVal) {
          setTexto(localVal);
          onTextoChange?.(localVal);
          setSt({ ...IDLE_STATE, dirty: true, mode: "pending", msg: "Pendiente de sincronizar" });
        } else {
          setTexto(serverVal);
          onTextoChange?.(serverVal);
          setSt(IDLE_STATE);
        }
      } catch {
        setTexto(serverVal);
        onTextoChange?.(serverVal);
        setSt(IDLE_STATE);
      }
    };
    void loadLocal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idioma, sec.id]);

  const doSave = useCallback(async (val: string) => {
    if (timer.current) clearTimeout(timer.current);
    setSt(s => ({ ...s, saving: true, msg: null }));
    draft.save(val);
    try {
      await onSave(sec.id, { [campo]: val });
      draft.clear();
      if (navigator.onLine) {
        setSt({ dirty: false, saving: false, saved: true, mode: "idle", msg: null });
        setTimeout(() => setSt(s => ({ ...s, saved: false })), 2000);
      } else {
        setSt({ dirty: false, saving: false, saved: false, mode: "pending", msg: "Guardado sin conexión" });
      }
    } catch {
      setSt(s => ({ ...s, saving: false, mode: "pending", msg: "Sin conexión — guardado localmente" }));
    }
  }, [sec.id, campo, onSave, draft]);

  const onChange = useCallback((val: string) => {
    setTexto(val);
    onTextoChange?.(val);
    draft.save(val);
    setSt(s => ({ ...s, dirty: true, saved: false, mode: s.mode === "error" ? "idle" : s.mode, msg: null }));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => doSave(val), 1500);
  }, [doSave, draft, onTextoChange]);

  // ── Texto de referencia (columna opuesta en split mode) ─────────────────
  const refCampo  = refIdioma ? IDIOMAS.find(i => i.id === refIdioma)?.campo : null;
  const refLineas = refCampo ? ((sec[refCampo] as string) || "").split("\n") : null;


  // ── Border según estado ──────────────────────────────────────────────────
  // RichEditor usa su propio borde; lo sobreescribimos vía className
  // en el div contenedor para indicar estado de guardado. El estado
  // "dirty" (cambios sin guardar aún) ya no se muestra como anillo
  // amarillo — en su lugar hay un ícono sutil junto al tick de guardado.
  const statusRingClass =
    st.mode === "pending" ? "ring-1 ring-blue-500/40"  :
    st.mode === "error"   ? "ring-1 ring-red-500/40"   :
                            "";

  return (
    <div className="flex-1 min-w-0">
      {/* ── Banner de borrador local ── */}
      <DraftRestoreBanner
        draft={draft}
        label="Borrador local disponible"
        onRestore={(v) => { setTexto(v); draft.dismiss(); }}
      />

      {/* ── Banner sin conexión ── */}
      {st.mode === "pending" && !st.saving && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 mb-1 bg-blue-500/10 border border-blue-500/20 rounded-xl text-micro font-black uppercase tracking-widest text-blue-400">
          <WifiOff size={10} />
          Guardado sin conexión — se sincronizará al reconectar
        </div>
      )}

      {/* ── Indicadores de estado — solo si hay algo que mostrar ── */}
      {(st.saving || st.saved || st.dirty || st.mode === "pending" || st.mode === "error") && (
        <div className="flex justify-end mb-0.5">
          <span className="flex items-center gap-1.5 pr-1">
            {st.saving                           && <Loader2      className="animate-spin text-primary/30" size={11} />}
            {st.saved                            && <CheckCircle2 className="text-emerald-400" size={11} />}
            {st.dirty && !st.saving              && <Circle       className="text-amber-400 fill-amber-400" size={7} />}
            {st.mode === "pending" && !st.saving && <span className="w-2 h-2 rounded-full bg-blue-400" />}
            {st.mode === "error"                 && <AlertCircle  className="text-red-400" size={11} />}
          </span>
        </div>
      )}

      {/* ── Editor con columna de contadores al costado ── */}
      <div className={`flex items-start gap-1 ${statusRingClass}`}>
        <div className="flex-1 min-w-0">
          <RichEditor
            editable
            minHeight="4rem"
            mode="edit"
            placeholder={`Letra en ${IDIOMAS.find(i => i.id === idioma)?.nombre}…`}
            showSplitMode={false}
            value={texto}
            onChange={onChange}
          />
        </div>
        {showSyllableColumn && (
          <SyllableColumn
            countMode={countMode}
            refLineas={refLineas}
            texto={texto}
          />
        )}
      </div>

      {/* ── Mensaje de error ── */}
      {st.mode === "error" && st.msg && (
        <p className="text-micro font-black uppercase text-red-400/80 tracking-widest px-1">⚠ {st.msg}</p>
      )}
    </div>
  );
};