"use client";

/**
 * PlainMarkdownPreview
 * ───────────────────────────────────────────────────────────────────────────
 * Renderer de solo-lectura para texto markdown plano: [[wikilinks]],
 * **bold**, *italic*, `code`, ~~strike~~, ==mark==, headings #-###### (con
 * sufijo de variante "{linea|barra|portada|dropcap|primeramayuscula}"),
 * citas ">", listas "-"/"1.", tablas "| a | b |", código ```, y "---".
 *
 * DISEÑO: calca 1:1 el theme real de RichEditor.tsx (ver `theme.heading`,
 * `theme.quote`, `theme.list`, `theme.code`, `theme.table*`, `theme.hr` y
 * el bloque <style> con las reglas [data-variant=...] dentro de ese
 * archivo) — mismas clases Tailwind, mismos colores, mismo ornamento de
 * variante. Antes este componente tenía su propio lenguaje visual inventado
 * (portada centrada con líneas, drop-cap invertido en H4, etc.) que NO
 * coincidía con lo que el autor ve al escribir en el editor — un heading
 * con variante "portada" se veía distinto en modo edición que en la página
 * pública. Ahora ambos comparten el mismo sistema: nivel (tamaño/peso/color,
 * vía theme.heading) + variante (ornamento, vía [data-variant]) como ejes
 * independientes, igual que documenta VariantHeadingNode.tsx.
 *
 * Extraído de RichEditor.tsx (que antes exponía esto como su `mode="preview"`
 * / `mode="split"` interno) — RichEditor ahora solo edita, sin modo preview.
 * Este componente cubre los consumidores que necesitaban mostrar texto ya
 * escrito sin editor debajo (ej. la página pública de ensayos, RunasDibujo).
 *
 * No importa nada de Lexical (evita arrastrar todo el editor al bundle de
 * una página pública que no lo necesita) — el sufijo de variante se parsea
 * con stripVariantSuffix desde nodes/headingVariant.ts, que es un módulo
 * liviano sin dependencias de Lexical (ver ese archivo para el porqué).
 */
import React from "react";
import {
  renderInlineMarkdownSafe,
  splitMarkdownBlocks,
  type MarkdownBlock,
  type MarkdownListItem,
} from "@/ui/Markdown/inlineMarkdown";
import type { HeadingVariant } from "@/editor/lexical/nodes/headingVariant";

// Mismo criterio que el resto del sistema (editor Lexical y
// ContenidoInteractivo/TextoMarkdown): una línea en blanco separa párrafos
// reales; un solo "\n" dentro de un bloque es un salto de línea suave (<br/>),
// no un párrafo nuevo.
//
// El parser en sí vive en ui/Markdown/inlineMarkdown.ts (única fuente de
// verdad, compartida con ContenidoInteractivo/TextoMarkdown) y ya sanitiza
// con DOMPurify antes de devolver el HTML.
function applyInlinePlainMarkdown(text: string): string {
  return renderInlineMarkdownSafe(text, { withWikilinks: true });
}

// ─────────────────────────────────────────────────────────────────────────
// Theme de headings — copiado literal de theme.heading en RichEditor.tsx.
// El nivel (h1-h6) controla SOLO tamaño/peso/color; h5/h6 no tienen clase
// propia en el editor (@lexical/rich-text los soporta pero el theme del
// editor solo define h1-h4) — acá se los trata igual que h4, mismo límite
// que ya tenía este componente.
// ─────────────────────────────────────────────────────────────────────────
const HEADING_LEVEL_CLASS: Record<1 | 2 | 3 | 4, string> = {
  1: "mt-8 mb-3 text-2xl font-bold tracking-tight leading-tight text-foreground",
  2: "mt-6 mb-2.5 text-xl font-semibold leading-snug text-foreground",
  3: "mt-5 mb-2 text-base font-semibold leading-snug text-foreground",
  4: "mt-4 mb-1.5 text-sm font-semibold uppercase tracking-wide leading-snug text-foreground/70",
};

const HEADING_TAGS: Record<1 | 2 | 3 | 4, "h1" | "h2" | "h3" | "h4"> = {
  1: "h1",
  2: "h2",
  3: "h3",
  4: "h4",
};

// Reglas [data-variant=...] — copiadas literal del <style> inline que
// RichEditor.tsx inyecta dentro de <LexicalComposer>. Se inyectan una sola
// vez acá también (mismo mecanismo: <style> plano, sin CSS-in-JS) para que
// cualquier heading con "{variante}" en la página pública tenga exactamente
// el mismo ornamento que en modo edición.
const VARIANT_STYLE = `
  [data-md-variant="linea"] {
    padding-bottom: 0.5rem;
    border-bottom: 1px solid color-mix(in srgb, var(--color-primary, #7c6af7) 25%, transparent);
  }
  [data-md-variant="barra"] {
    position: relative;
    padding-left: 0.75rem;
    border-left: 2px solid color-mix(in srgb, var(--color-primary, #7c6af7) 50%, transparent);
  }
  [data-md-variant="portada"] {
    position: relative;
    margin-left: auto;
    margin-right: auto;
    max-width: 500px;
    text-align: center;
    padding-left: 1.25rem;
    padding-right: 1.25rem;
  }
  [data-md-variant="portada"]::before,
  [data-md-variant="portada"]::after {
    content: "";
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 0.75rem;
    height: 1px;
    background: color-mix(in srgb, var(--color-primary, #7c6af7) 40%, transparent);
    box-shadow: 0 4px 0 -0.5px color-mix(in srgb, var(--color-primary, #7c6af7) 25%, transparent);
  }
  [data-md-variant="portada"]::before { left: 0; }
  [data-md-variant="portada"]::after { right: 0; }
  [data-md-variant="dropcap"] {
    position: relative;
    padding-left: 1rem;
  }
  [data-md-variant="dropcap"]::before {
    content: "-";
    position: absolute;
    left: 0;
    top: 0;
    font-weight: 400;
    color: color-mix(in srgb, var(--color-primary, #7c6af7) 60%, transparent);
  }
  [data-md-variant="dropcap"]::first-letter {
    font-size: 1.3em;
    font-weight: 700;
    color: color-mix(in srgb, var(--color-primary, #7c6af7) 70%, transparent);
    margin-right: 1px;
  }
  [data-md-variant="primeramayuscula"]::first-letter {
    color: color-mix(in srgb, var(--color-primary, #7c6af7) 75%, transparent);
  }
`;

function renderHeadingBlock(
  level: 1 | 2 | 3 | 4,
  text: string,
  variant: HeadingVariant,
  key: number,
) {
  const Tag = HEADING_TAGS[level];
  const html = applyInlinePlainMarkdown(text);
  return (
    <Tag
      key={key}
      className={HEADING_LEVEL_CLASS[level]}
      data-md-variant={variant !== "none" ? variant : undefined}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// Renderiza recursivamente los items de una lista (con anidado), en la
// misma jerarquía que produce parseListItems a partir de la indentación.
// Clases: theme.list.{ul,ol,listitem} de RichEditor.tsx.
function renderListItems(items: MarkdownListItem[], ordered: boolean) {
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag className={ordered ? "list-decimal pl-6 my-2" : "list-disc pl-6 my-2"}>
      {items.map((item, i) => (
        <li key={i} className="my-1">
          <span
            dangerouslySetInnerHTML={{
              __html: applyInlinePlainMarkdown(item.text),
            }}
          />
          {item.children.length > 0 &&
            renderListItems(item.children, ordered)}
        </li>
      ))}
    </Tag>
  );
}

function renderBlock(block: MarkdownBlock, key: number) {
  // hr — theme.hr de RichEditor.tsx.
  if (block.type === "hr") {
    return (
      <hr
        key={key}
        className="border-0 border-t border-[color-mix(in_srgb,var(--foreground)_15%,transparent)] my-6"
      />
    );
  }

  // code (bloque ```) — theme.code de RichEditor.tsx.
  if (block.type === "code") {
    return (
      <pre
        key={key}
        className="block font-mono text-[0.875em] leading-relaxed whitespace-pre overflow-x-auto bg-surface-1 border border-[color-mix(in_srgb,var(--foreground)_8%,transparent)] rounded-lg px-4 py-3 my-4"
      >
        <code>{block.code}</code>
      </pre>
    );
  }

  // quote — theme.quote de RichEditor.tsx.
  if (block.type === "quote") {
    return (
      <blockquote
        key={key}
        className="border-l-2 border-primary/30 pl-4 italic opacity-75 my-4"
      >
        {block.raw.split("\n").map((linea, li) => (
          <React.Fragment key={li}>
            {li > 0 && <br />}
            <span
              dangerouslySetInnerHTML={{
                __html: applyInlinePlainMarkdown(linea),
              }}
            />
          </React.Fragment>
        ))}
      </blockquote>
    );
  }

  // list — theme.list de RichEditor.tsx.
  if (block.type === "list") {
    return (
      <React.Fragment key={key}>
        {renderListItems(block.items, block.ordered)}
      </React.Fragment>
    );
  }

  // table — theme.table/tableRow/tableCell/tableCellHeader de RichEditor.tsx.
  if (block.type === "table") {
    return (
      <div key={key} className="overflow-x-auto">
        <table className="border-collapse my-3 w-full">
          <thead>
            <tr>
              {block.header.map((cell, ci) => (
                <th
                  key={ci}
                  className="border border-[color-mix(in_srgb,var(--foreground)_12%,transparent)] px-2 py-1 align-top font-bold bg-[color-mix(in_srgb,var(--foreground)_4%,transparent)]"
                  dangerouslySetInnerHTML={{ __html: applyInlinePlainMarkdown(cell) }}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className="border border-[color-mix(in_srgb,var(--foreground)_12%,transparent)] px-2 py-1 align-top"
                    dangerouslySetInnerHTML={{ __html: applyInlinePlainMarkdown(cell) }}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // heading — theme.heading + data-variant de RichEditor.tsx.
  if (block.type === "heading") {
    // h5/h6 (nivel 5-6) caen al mismo tratamiento que h4 — el theme del
    // editor tampoco define clases propias para esos niveles.
    const level = Math.min(4, block.level) as 1 | 2 | 3 | 4;
    return renderHeadingBlock(level, block.text, block.variant, key);
  }

  // block.type === "text": párrafo normal.
  const bloque = block.raw;
  if (bloque.trim() === "") {
    return <p key={key} aria-hidden style={{ margin: 0, minHeight: "1em" }} />;
  }

  const lineas = bloque.split("\n");
  return (
    <p key={key} className="my-2">
      {lineas.map((linea, li) => (
        <React.Fragment key={li}>
          {li > 0 && <br />}
          <span
            dangerouslySetInnerHTML={{
              __html: applyInlinePlainMarkdown(linea),
            }}
          />
        </React.Fragment>
      ))}
    </p>
  );
}

export interface PlainMarkdownPreviewProps {
  value: string;
  className?: string;
  style?: React.CSSProperties;
  onWikilinkNavigate?: (target: string) => void;
}

export function PlainMarkdownPreview({
  value,
  className = "prose-mundo",
  style,
  onWikilinkNavigate,
}: PlainMarkdownPreviewProps) {
  const blocks = splitMarkdownBlocks(value);

  return (
    <div
      className={className}
      style={{
        padding: "8px 12px",
        overflowY: "auto",
        fontSize: "clamp(0.9rem, 2vw, 1rem)",
        lineHeight: 1.8,
        ...style,
      }}
      onClick={(e) => {
        // Los wikilinks se marcan con data-wikilink; conectamos el click a
        // onWikilinkNavigate igual que hacía RichEditor en modo preview.
        const a = (e.target as HTMLElement).closest("a[data-wikilink]");
        if (!a) return;
        e.preventDefault();
        const target = a.getAttribute("data-wikilink");
        if (target) onWikilinkNavigate?.(target);
      }}
    >
      {/* Mismas reglas [data-variant] que RichEditor.tsx inyecta dentro de
          <LexicalComposer> — ver VARIANT_STYLE arriba. Se usa el atributo
          "data-md-variant" (en vez de "data-variant" a secas) para no
          colisionar si esta página y el editor llegaran a convivir en el
          mismo árbol DOM alguna vez; el selector CSS es idéntico salvo
          por ese nombre. */}
      <style>{VARIANT_STYLE}</style>
      {blocks.map((block, bi) => renderBlock(block, bi))}
    </div>
  );
}

export default PlainMarkdownPreview;
