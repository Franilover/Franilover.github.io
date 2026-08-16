"use client";

/**
 * PlainMarkdownPreview
 * ───────────────────────────────────────────────────────────────────────────
 * Renderer de solo-lectura para texto markdown plano ([[wikilinks]], **bold**,
 * *italic*, `code`, ~~strike~~, ==mark==, y headings # a ####).
 *
 * Extraído de RichEditor.tsx (que antes exponía esto como su `mode="preview"`
 * / `mode="split"` interno) — RichEditor ahora solo edita, sin modo preview.
 * Este componente cubre los consumidores que necesitaban mostrar texto ya
 * escrito sin editor debajo (ej. RunasDibujo, resultado de reconocimiento).
 *
 * No depende de features/ ni de ningún dominio — sigue siendo UI genérica
 * de editor/lexical/, igual que el fallback que reemplaza.
 */
import React from "react";
import {
  renderInlineMarkdownSafe,
  splitMarkdownBlocks,
  type MarkdownBlock,
  type MarkdownListItem,
} from "@/ui/Markdown/inlineMarkdown";

const ACCENT = "var(--color-primary, #7c6af7)";

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

// Detecta "# ".."#### " al inicio de un bloque (1 a 4 "#", con espacio) —
// mismo límite de niveles que expone MarkdownCommandPalette (H1-H4).
// "#####"/"######" (h5/h6) caen al párrafo normal, igual que antes.
const HEADING_LINE_RE = /^(#{1,4})\s+(.*)$/;

// Cada nivel de heading tiene su propio lenguaje visual — no un único
// patrón escalado por tamaño — para que la jerarquía se lea de un
// vistazo. Replica en HTML/inline-styles lo que hace theme.heading en
// RichEditor para que un heading se vea igual en edición y en este preview.
function renderHeadingBlock(
  level: 1 | 2 | 3 | 4,
  text: string,
  key: number,
  prevLevel: 1 | 2 | 3 | 4 | null,
) {
  const html = applyInlinePlainMarkdown(text);

  // H1 — "portada de sección": centrado, ancho acotado a 500px (mx-auto)
  // para que títulos largos hagan wrap sin desalinear las líneas
  // laterales; las líneas van a los costados vía posicionamiento
  // absoluto dentro de un wrapper relative.
  if (level === 1) {
    return (
      <div
        key={key}
        style={{
          position: "relative",
          maxWidth: 500,
          margin: "32px auto 24px",
          padding: "0 20px",
          textAlign: "center",
        }}
      >
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: "50%",
            left: 0,
            width: 12,
            height: 1,
            transform: "translateY(-50%)",
            background: "color-mix(in srgb, " + ACCENT + " 40%, transparent)",
            boxShadow:
              "0 4px 0 -0.5px color-mix(in srgb, " +
              ACCENT +
              " 25%, transparent)",
          }}
        />
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: "50%",
            right: 0,
            width: 12,
            height: 1,
            transform: "translateY(-50%)",
            background: "color-mix(in srgb, " + ACCENT + " 40%, transparent)",
            boxShadow:
              "0 4px 0 -0.5px color-mix(in srgb, " +
              ACCENT +
              " 25%, transparent)",
          }}
        />
        <span
          style={{
            fontSize: "1.75rem",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            lineHeight: 1.25,
            display: "inline",
          }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    );
  }

  // H2 — línea horizontal completa debajo del título.
  if (level === 2) {
    return (
      <div
        key={key}
        style={{
          margin: "24px 0 16px",
          paddingBottom: 8,
          borderBottom:
            "1px solid color-mix(in srgb, " + ACCENT + " 25%, transparent)",
        }}
      >
        <span
          style={{
            fontSize: "1.25rem",
            fontWeight: 600,
            lineHeight: 1.3,
            display: "block",
          }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    );
  }

  // H3 — barra vertical de acento corta al costado del texto.
  if (level === 3) {
    return (
      <div
        key={key}
        style={{
          position: "relative",
          paddingLeft: 12,
          margin: prevLevel === 2 ? "0 0 8px" : "20px 0 8px",
          borderLeft:
            "2px solid color-mix(in srgb, " + ACCENT + " 50%, transparent)",
        }}
      >
        <span
          style={{
            fontSize: "1.1rem",
            fontWeight: 600,
            lineHeight: 1.3,
            display: "block",
          }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    );
  }

  // H4 — "drop-cap invertido": primera letra grande y de color, resto
  // del texto en tamaño normal.
  const firstChar = text.charAt(0);
  const rest = text.slice(1);
  return (
    <div
      key={key}
      style={{ margin: prevLevel === 4 ? "6px 0 6px" : "16px 0 6px" }}
    >
      <span
        style={{
          fontSize: "1.1rem",
          fontWeight: 700,
          color: "color-mix(in srgb, " + ACCENT + " 70%, transparent)",
          lineHeight: 0.8,
          marginRight: 1,
        }}
      >
        {firstChar}
      </span>
      <span
        style={{ fontSize: "0.95rem", fontWeight: 600 }}
        dangerouslySetInnerHTML={{ __html: applyInlinePlainMarkdown(rest) }}
      />
    </div>
  );
}

// Renderiza recursivamente los items de una lista (con anidado), en la
// misma jerarquía que produce parseListItems a partir de la indentación.
function renderListItems(items: MarkdownListItem[], ordered: boolean) {
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag style={{ margin: "0 0 0.6em 1.4em", padding: 0 }}>
      {items.map((item, i) => (
        <li key={i} style={{ margin: "0.15em 0" }}>
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

function renderBlock(block: MarkdownBlock, key: number, prevHeadingLevel: { current: 1 | 2 | 3 | 4 | null }) {
  if (block.type === "hr") {
    return (
      <hr
        key={key}
        style={{
          margin: "20px 0",
          border: "none",
          borderTop:
            "1px solid color-mix(in srgb, " + ACCENT + " 25%, transparent)",
        }}
      />
    );
  }

  if (block.type === "code") {
    return (
      <pre
        key={key}
        style={{
          margin: "0 0 0.8em 0",
          padding: "12px 14px",
          borderRadius: 8,
          overflowX: "auto",
          fontSize: "0.85em",
          lineHeight: 1.5,
          background: "color-mix(in srgb, " + ACCENT + " 8%, transparent)",
        }}
      >
        <code>{block.code}</code>
      </pre>
    );
  }

  if (block.type === "quote") {
    return (
      <blockquote
        key={key}
        style={{
          margin: "0 0 0.8em 0",
          padding: "2px 16px",
          borderLeft:
            "3px solid color-mix(in srgb, " + ACCENT + " 45%, transparent)",
          opacity: 0.85,
          fontStyle: "italic",
        }}
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

  if (block.type === "list") {
    return (
      <React.Fragment key={key}>
        {renderListItems(block.items, block.ordered)}
      </React.Fragment>
    );
  }

  if (block.type === "table") {
    return (
      <div key={key} style={{ overflowX: "auto", margin: "0 0 0.8em 0" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              {block.header.map((cell, ci) => (
                <th
                  key={ci}
                  style={{
                    textAlign: "left",
                    padding: "6px 10px",
                    borderBottom: "2px solid color-mix(in srgb, " + ACCENT + " 40%, transparent)",
                  }}
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
                    style={{
                      padding: "6px 10px",
                      borderBottom: "1px solid color-mix(in srgb, " + ACCENT + " 15%, transparent)",
                    }}
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

  // block.type === "text": mismo camino que antes (heading o párrafo).
  const bloque = block.raw;
  if (bloque.trim() === "") {
    prevHeadingLevel.current = null;
    return (
      <p key={key} aria-hidden style={{ margin: 0, minHeight: "1em" }} />
    );
  }

  const headingMatch = HEADING_LINE_RE.exec(bloque);
  if (headingMatch) {
    const level = Math.min(4, headingMatch[1].length) as 1 | 2 | 3 | 4;
    const rendered = renderHeadingBlock(
      level,
      headingMatch[2],
      key,
      prevHeadingLevel.current,
    );
    prevHeadingLevel.current = level;
    return rendered;
  }
  prevHeadingLevel.current = null;

  const lineas = bloque.split("\n");
  return (
    <p key={key} style={{ margin: "0 0 0.6em 0" }}>
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
  // Rastrea el nivel del ÚLTIMO heading renderizado (bloques vacíos o de
  // texto normal no lo tocan) para que renderHeadingBlock pueda achicar el
  // margen cuando dos headings de niveles específicos quedan adyacentes.
  // Usa un ref-like mutable object porque renderBlock se llama desde un
  // .map() y necesita mutar el valor entre iteraciones.
  const prevHeadingLevel = { current: null as 1 | 2 | 3 | 4 | null };

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
      {blocks.map((block, bi) => renderBlock(block, bi, prevHeadingLevel))}
    </div>
  );
}

export default PlainMarkdownPreview;
