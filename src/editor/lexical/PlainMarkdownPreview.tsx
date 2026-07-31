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

const ACCENT = "var(--color-primary, #7c6af7)";

// Mismo criterio que el resto del sistema (editor Lexical y
// ContenidoInteractivo/TextoMarkdown): una línea en blanco separa párrafos
// reales; un solo "\n" dentro de un bloque es un salto de línea suave (<br/>),
// no un párrafo nuevo.
function applyInlinePlainMarkdown(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(
      /\[\[([^\]|#]+?)(?:\|([^\]]+))?\]\]/g,
      (_, target: string, alias?: string) => {
        const label = (alias?.trim() || target.trim()).replace(/"/g, "&quot;");
        const safeTarget = target.trim().replace(/"/g, "&quot;");
        return `<a class="wikilink" data-wikilink="${safeTarget}" href="javascript:void(0)" title="Ir a: ${safeTarget}">${label}</a>`;
      },
    )
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/~~(.+?)~~/g, "<del>$1</del>")
    .replace(/==(.+?)==/g, '<mark class="md-mark">$1</mark>');
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
  const bloques = value.split(/\n{2,}/);
  // Rastrea el nivel del ÚLTIMO heading renderizado (bloques vacíos o de
  // texto normal no lo tocan) para que renderHeadingBlock pueda achicar el
  // margen cuando dos headings de niveles específicos quedan adyacentes.
  let prevHeadingLevel: 1 | 2 | 3 | 4 | null = null;

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
      {bloques.map((bloque, bi) => {
        if (bloque.trim() === "") {
          return (
            <p key={bi} aria-hidden style={{ margin: 0, minHeight: "1em" }} />
          );
        }

        const headingMatch = HEADING_LINE_RE.exec(bloque);
        if (headingMatch) {
          const level = Math.min(4, headingMatch[1].length) as 1 | 2 | 3 | 4;
          const block = renderHeadingBlock(
            level,
            headingMatch[2],
            bi,
            prevHeadingLevel,
          );
          prevHeadingLevel = level;
          return block;
        }
        prevHeadingLevel = null;

        const lineas = bloque.split("\n");
        return (
          <p key={bi} style={{ margin: "0 0 0.6em 0" }}>
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
      })}
    </div>
  );
}

export default PlainMarkdownPreview;
