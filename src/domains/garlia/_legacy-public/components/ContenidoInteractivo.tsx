"use client";
import { motion } from "framer-motion";
import React, { useState, useEffect, useRef, useCallback } from "react";

import type {
  Segment} from "@/domains/garlia/libros/capitulos/types";
import {
  parseContenido,
  parseSections,
} from "@/domains/garlia/libros/capitulos/types";

import {
  CitaVisual,
  EpigrafeVisual,
  ImgInline,
  FloatWord,
  SoundInline,
  DropWord,
  ChoiceButton,
  UseWord,
  UseWordPortal,
} from "./SegmentRenderers";

/* ─────────────────────────────────────────────
   Markdown inline — bold, italic, code, etc.
   ───────────────────────────────────────────── */
function applyInlineMarkdown(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/~~(.+?)~~/g, "<del>$1</del>")
    .replace(/==(.+?)==/g, '<mark class="md-mark">$1</mark>');
}

/* Renderiza texto respetando saltos de línea: una línea en blanco separa
 * párrafos reales; un solo "\n" dentro de un bloque es un salto de línea
 * suave (<br/>), no un párrafo nuevo — mismo criterio que usa el editor
 * (RichEditor/Lexical) y el renderer de markdown estándar, para que lo
 * que el usuario ve al escribir coincida con lo que ve el lector. */
function TextoMarkdown({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const bloques = value.split(/\n{2,}/);
  return (
    <>
      {bloques.map((bloque, bi) => {
        if (bloque.trim() === "") {
          return (
            <p key={bi} aria-hidden style={{ margin: 0, minHeight: "1em" }} />
          );
        }
        const lineas = bloque.split("\n");
        return (
          <p key={bi} className={className} style={{ margin: "0 0 0.6em 0" }}>
            {lineas.map((linea, li) => (
              <React.Fragment key={li}>
                {li > 0 && <br />}
                <span
                  dangerouslySetInnerHTML={{
                    __html: applyInlineMarkdown(linea),
                  }}
                />
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </>
  );
}

/* ─────────────────────────────────────────────
   Drop cap animado
   ───────────────────────────────────────────── */
function AnimatedDropCap({ char, rest }: { char: string; rest: string }) {
  return (
    <>
      <motion.span
        animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
        className="float-left font-black text-primary leading-none mr-3"
        initial={{ opacity: 0, filter: "blur(8px)", scale: 1.15 }}
        style={{
          fontFamily: "var(--font-literata), Georgia, serif",
          fontSize: "clamp(2.8rem, 7vw, 3.6rem)",
          marginTop: "0.12em",
          lineHeight: 0.85,
        }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
      >
        {char}
      </motion.span>
      <motion.span
        animate={{ opacity: 1 }}
        initial={{ opacity: 0 }}
        transition={{ duration: 0.8, delay: 0.4 }}
      >
        <TextoMarkdown value={rest} />
      </motion.span>
    </>
  );
}

/* ─────────────────────────────────────────────
   CondicionBlock — fusión de GateBlock + FlagIfBlock.
   Evalúa una condición automática del sistema (¿tiene este ítem? / ¿el
   flag guardado === valorEsperado?) y ramifica en dos, con target
   opcional por rama, igual mecanismo en ambos casos, solo cambia la
   fuente de verdad que consulta.
   ───────────────────────────────────────────── */
function CondicionBlock({
  tipo,
  clave,
  valorEsperado,
  siSegs,
  noSegs,
  siTarget,
  noTarget,
  onNavigate,
}: {
  tipo: "item" | "flag";
  clave: string;
  valorEsperado?: string;
  siSegs: Segment[];
  noSegs: Segment[];
  siTarget?: string;
  noTarget?: string;
  onNavigate: (id: string) => void;
}) {
  const [cumple, setCumple] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { supabase } = await import("@/lib/api/client/supabase");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      if (tipo === "item") {
        const { data } = await supabase
          .from("descubrimientos_items")
          .select("id")
          .eq("item_id", clave)
          .eq("perfil_id", user.id)
          .maybeSingle();
        if (!cancelled) setCumple(!!data);
      } else {
        const { data } = await supabase
          .from("flags_narrativos")
          .select("valor")
          .eq("flag_id", clave)
          .eq("perfil_id", user.id)
          .maybeSingle();
        // Un flag que nunca se seteó cuenta como no-match, no como error.
        if (!cancelled) setCumple((data?.valor ?? null) === valorEsperado);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tipo, clave, valorEsperado]);

  const target = cumple === null ? undefined : cumple ? siTarget : noTarget;

  // Si la rama activa tiene un target -> salta de sección, igual que un
  // [[choice]]. Se hace en un efecto (no durante el render) porque
  // onNavigate normalmente actualiza estado del padre.
  useEffect(() => {
    if (target) onNavigate(target);
  }, [target, onNavigate]);

  if (cumple === null || target) return null;

  // Sin target: se comporta como antes, renderiza el texto de la rama
  // inline, sin salto de sección.
  const segs = cumple ? siSegs : noSegs;
  return <RenderSegmentos segs={segs} onNavigate={onNavigate} />;
}

/* ─────────────────────────────────────────────
   FlagSetBlock — escribe flagId=valor al pasar por acá.
   No navega, no renderiza nada visible.
   ───────────────────────────────────────────── */
function FlagSetBlock({ flagId, valor }: { flagId: string; valor: string }) {
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!flagId) return;
      const { supabase } = await import("@/lib/api/client/supabase");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      // upsert por (perfil_id, flag_id) — pisa el valor anterior si ya
      // existía. Ver nota de migración SQL en lib/types/supabase.ts: la
      // tabla necesita un unique constraint (perfil_id, flag_id) para que
      // este onConflict funcione.
      await supabase
        .from("flags_narrativos")
        .upsert(
          { perfil_id: user.id, flag_id: flagId, valor },
          { onConflict: "perfil_id,flag_id" },
        );
    })();
    return () => {
      cancelled = true;
    };
  }, [flagId, valor]);

  return null;
}


function SectionDivider({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 my-8">
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      {label && (
        <span className="text-micro font-black uppercase tracking-widest text-primary/20 italic">
          {label}
        </span>
      )}
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
    </div>
  );
}

/* ─────────────────────────────────────────────
   RenderSegmentos
   ───────────────────────────────────────────── */
export function RenderSegmentos({
  segs,
  onNavigate,
  isFirst = false,
  esExtra = false,
}: {
  segs: Segment[];
  onNavigate: (id: string) => void;
  isFirst?: boolean;
  esExtra?: boolean;
}) {
  return (
    <>
      {segs.map((seg, i) => {
        const isFirstText =
          isFirst && !esExtra && i === 0 && seg.type === "text";

        if (seg.type === "text") {
          if (isFirstText && seg.value.length > 0) {
            const firstChar = seg.value.charAt(0);
            // Si el siguiente char es \n, lo saltamos para no romper el primer párrafo
            const afterFirst = seg.value.slice(1);
            const restText = afterFirst.startsWith("\n")
              ? afterFirst.slice(1)
              : afterFirst;
            return (
              <span key={i}>
                <AnimatedDropCap char={firstChar} rest={restText} />
              </span>
            );
          }
          return <TextoMarkdown key={i} value={seg.value} />;
        }

        if (seg.type === "cita")
          return <CitaVisual key={i} content={seg.content} />;
        if (seg.type === "epigrafe")
          return (
            <EpigrafeVisual
              key={i}
              atribucion={seg.atribucion}
              texto={seg.texto}
            />
          );
        if (seg.type === "img")
          return <ImgInline key={i} caption={seg.caption} url={seg.url} />;
        if (seg.type === "float")
          return (
            <FloatWord
              key={i}
              caption={seg.caption}
              url={seg.url}
              word={seg.word}
            />
          );
        if (seg.type === "sound")
          return <SoundInline key={i} url={seg.url} volume={seg.volume} />;
        if (seg.type === "drop")
          return (
            <DropWord
              key={i}
              entidadId={seg.entidadId}
              entidadNombre={seg.entidadNombre}
              tipo={seg.entidadTipo}
              word={seg.word}
            />
          );
        if (seg.type === "choice")
          return (
            <ChoiceButton
              key={i}
              label={seg.label}
              onSelect={() => onNavigate(seg.target)}
            />
          );
        if (seg.type === "use")
          return (
            <UseWord
              key={i}
              itemId={seg.itemId}
              targetFail={seg.targetFail}
              targetSuccess={seg.targetSuccess}
              word={seg.word}
              onNavigate={onNavigate}
            />
          );
        if (seg.type === "condicion")
          return (
            <CondicionBlock
              key={i}
              clave={seg.clave}
              noSegs={seg.noSegs}
              noTarget={seg.noTarget}
              siSegs={seg.siSegs}
              siTarget={seg.siTarget}
              tipo={seg.tipo}
              valorEsperado={seg.valorEsperado}
              onNavigate={onNavigate}
            />
          );
        if (seg.type === "flag-set")
          return (
            <FlagSetBlock key={i} flagId={seg.flagId} valor={seg.valor} />
          );

        return null;
      })}
    </>
  );
}

/* ─────────────────────────────────────────────
   Sección revelada con animación
   ───────────────────────────────────────────── */
function RevealedSection({
  id,
  segs,
  onNavigate,
}: {
  id: string;
  segs: Segment[];
  onNavigate: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTimeout(
      () => ref.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      50,
    );
  }, []);

  return (
    <motion.div
      key={id}
      ref={ref}
      animate={{ opacity: 1, y: 0 }}
      initial={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <SectionDivider label={id} />
      <RenderSegmentos segs={segs} onNavigate={onNavigate} />
    </motion.div>
  );
}

/* ─────────────────────────────────────────────
   Componente principal
   ───────────────────────────────────────────── */
export function ContenidoInteractivo({
  texto,
  onNavigate,
  esExtra = false,
}: {
  texto: string;
  onNavigate: (capId: string) => void;
  esExtra?: boolean;
}) {
  const allSegs = parseContenido(texto);
  const sectionMap = parseSections(allSegs);

  const [revealed, setRevealed] = useState<string[]>([]);

  useEffect(() => {
    setRevealed([]);
  }, [texto]);

  const handleNavigate = useCallback(
    (target: string) => {
      const isUUID =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          target,
        );
      const isLocalSection = !isUUID && sectionMap[target] !== undefined;

      if (isLocalSection) {
        setRevealed((prev) =>
          prev.includes(target) ? prev : [...prev, target],
        );
      } else {
        onNavigate(target);
      }
    },
    [sectionMap, onNavigate],
  );

  return (
    <div
      className="text-primary-dark/90 lector-texto"
      style={{
        fontSize: "clamp(1rem, 2.5vw, 1.125rem)",
        lineHeight: 1.85,
        letterSpacing: "0.01em",
        fontFeatureSettings: '"kern" 1, "liga" 1, "onum" 1',
      }}
    >
      <UseWordPortal />

      <RenderSegmentos
        isFirst
        esExtra={esExtra}
        segs={sectionMap[""]}
        onNavigate={handleNavigate}
      />

      {revealed.map((id) => (
        <RevealedSection
          key={id}
          id={id}
          segs={sectionMap[id] ?? []}
          onNavigate={handleNavigate}
        />
      ))}
    </div>
  );
}
