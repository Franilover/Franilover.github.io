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
  DialogoBlock,
  NotasProvider,
  MarcadorNota,
} from "./SegmentRenderers";
import { renderInlineMarkdownSafe, splitMarkdownBlocks } from "@/ui/Markdown/inlineMarkdown";

// Nota al pie inline: [[nota|Texto de la nota]]. Se extrae ANTES de pasar
// la línea por renderInlineMarkdownSafe (que no sabe nada de notas) y se
// renderiza aparte como <MarcadorNota>, intercalado entre los tramos de
// HTML ya sanitizado. El texto de la nota en sí puede llevar markdown
// inline propio (se resuelve en NotasAlPie, no acá).
const NOTA_RE = /\[\[nota\|([\s\S]+?)\]\]/g;

function renderLineaConNotas(linea: string, keyBase: string): React.ReactNode {
  const partes: React.ReactNode[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  NOTA_RE.lastIndex = 0;
  while ((m = NOTA_RE.exec(linea)) !== null) {
    const antes = linea.slice(lastIndex, m.index);
    if (antes) {
      partes.push(
        <span
          key={`${keyBase}-t${i}`}
          dangerouslySetInnerHTML={{ __html: renderInlineMarkdownSafe(antes) }}
        />,
      );
    }
    partes.push(<MarcadorNota key={`${keyBase}-n${i}`} texto={m[1].trim()} />);
    lastIndex = m.index + m[0].length;
    i++;
  }
  const resto = linea.slice(lastIndex);
  if (resto || partes.length === 0) {
    partes.push(
      <span
        key={`${keyBase}-t${i}`}
        dangerouslySetInnerHTML={{ __html: renderInlineMarkdownSafe(resto) }}
      />,
    );
  }
  return partes;
}

/* Renderiza texto respetando saltos de línea: una línea en blanco separa
 * párrafos reales; un solo "\n" dentro de un bloque es un salto de línea
 * suave (<br/>), no un párrafo nuevo — mismo criterio que usa el editor
 * (RichEditor/Lexical) y el renderer de markdown estándar, para que lo
 * que el usuario ve al escribir coincida con lo que ve el lector.
 *
 * También reconoce dos bloques de nivel superior (ver splitMarkdownBlocks
 * en ui/Markdown/inlineMarkdown.ts, compartido con PlainMarkdownPreview):
 *   - ```código``` → bloque monoespaciado
 *   - --- (o ***, ___) en su propia línea → separador horizontal
 */
function TextoMarkdown({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const blocks = splitMarkdownBlocks(value);
  return (
    <>
      {blocks.map((block, bi) => {
        if (block.type === "hr") {
          return (
            <hr
              key={bi}
              className="my-6 border-0 border-t border-primary/15"
            />
          );
        }

        if (block.type === "code") {
          return (
            <pre
              key={bi}
              className="my-4 overflow-x-auto rounded-lg border border-primary/8 bg-primary/[0.03] px-4 py-3 font-mono text-[0.875em] leading-relaxed whitespace-pre"
            >
              <code>{block.code}</code>
            </pre>
          );
        }

        if (block.type === "heading") {
          // Antes de agregar "heading" como su propio tipo de bloque, un
          // "# Título" en un capítulo nunca se reconocía acá (splitMarkdownBlocks
          // solo separaba code/hr) — se veía como texto plano con el "#"
          // literal. Estilos discretos, sin el tratamiento elaborado de
          // PlainMarkdownPreview/RichEditor, para no cambiar el look ya
          // establecido de los capítulos de Garlia — el sufijo "{variante}"
          // (block.variant) ya viene separado de block.text por
          // splitMarkdownBlocks, así que simplemente se ignora acá en vez
          // de mostrarse como texto literal.
          const HeadingTag = (`h${block.level}` as const);
          const sizeClass =
            block.level === 1
              ? "text-2xl font-black mt-8 mb-3"
              : block.level === 2
                ? "text-xl font-bold mt-6 mb-2.5"
                : block.level === 3
                  ? "text-lg font-bold mt-5 mb-2"
                  : "text-base font-bold mt-4 mb-1.5";
          return (
            <HeadingTag key={bi} className={`${sizeClass} text-primary`}>
              {renderLineaConNotas(block.text, `${bi}-h`)}
            </HeadingTag>
          );
        }

        if (block.type === "quote") {
          return (
            <blockquote
              key={bi}
              className="my-3 border-l-[3px] border-primary/45 pl-4 italic opacity-85"
            >
              {block.raw.split("\n").map((linea, li) => (
                <React.Fragment key={li}>
                  {li > 0 && <br />}
                  {renderLineaConNotas(linea, `${bi}-${li}`)}
                </React.Fragment>
              ))}
            </blockquote>
          );
        }

        if (block.type === "list") {
          const renderItems = (
            items: typeof block.items,
            ordered: boolean,
          ): React.ReactNode => {
            const Tag = ordered ? "ol" : "ul";
            return (
              <Tag className="my-2 ml-6 list-outside space-y-1">
                {items.map((item, ii) => (
                  <li key={ii}>
                    {renderLineaConNotas(item.text, `${bi}-li-${ii}`)}
                    {item.children.length > 0 &&
                      renderItems(item.children, ordered)}
                  </li>
                ))}
              </Tag>
            );
          };
          return (
            <React.Fragment key={bi}>
              {renderItems(block.items, block.ordered)}
            </React.Fragment>
          );
        }

        if (block.type === "table") {
          return (
            <div key={bi} className="my-4 overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {block.header.map((cell, ci) => (
                      <th
                        key={ci}
                        className="border-b-2 border-primary/40 px-2.5 py-1.5 text-left"
                      >
                        {renderLineaConNotas(cell, `${bi}-th-${ci}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, ri) => (
                    <tr key={ri}>
                      {row.map((cell, ci) => (
                        <td
                          key={ci}
                          className="border-b border-primary/15 px-2.5 py-1.5"
                        >
                          {renderLineaConNotas(cell, `${bi}-td-${ri}-${ci}`)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        const bloque = block.raw;
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
                {renderLineaConNotas(linea, `${bi}-${li}`)}
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
      const { supabase } = await import("@/infra/supabase/supabase");
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
      const { supabase } = await import("@/infra/supabase/supabase");
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
        if (seg.type === "dialogo")
          return (
            <DialogoBlock
              key={i}
              acotacion={seg.acotacion}
              mostrarImg={seg.mostrarImg}
              personajeId={seg.personajeId}
              texto={seg.texto}
            />
          );
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
        letterSpacing: "0.01em",
        fontFeatureSettings: '"kern" 1, "liga" 1, "onum" 1',
      }}
    >
      <UseWordPortal />

      <NotasProvider>
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
      </NotasProvider>
    </div>
  );
}
