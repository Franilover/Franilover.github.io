/**
 * proseStyles.ts
 * ──────────────
 * Bloque CSS puro para la clase .prose-mundo (paneles de preview/split).
 * Extraído de markdownRenderer.ts para que ese archivo (parseo string→HTML)
 * quede libre de consumidores reales y se pueda borrar por completo — este
 * export es solo estilos, no lógica de parseo.
 */

export const PROSE_STYLES = `
  .prose-mundo h1 { font-size:1.35rem;font-weight:800;margin:1rem 0 .35rem;letter-spacing:-.01em;color:color-mix(in srgb,var(--color-primary,#7c6af7) 92%,white);padding-bottom:.3rem;border-bottom:1px solid color-mix(in srgb,var(--color-primary,#7c6af7) 22%,transparent) }
  .prose-mundo h2 { font-size:1.08rem;font-weight:800;margin:.85rem 0 .3rem;letter-spacing:-.003em;color:color-mix(in srgb,var(--color-primary,#7c6af7) 82%,white);padding-bottom:.22rem;border-bottom:1px solid color-mix(in srgb,var(--color-primary,#7c6af7) 10%,transparent) }
  .prose-mundo h3 { font-size:.94rem;font-weight:700;margin:.7rem 0 .25rem;letter-spacing:0;color:color-mix(in srgb,var(--color-primary,#7c6af7) 70%,white) }
  .prose-mundo h4 { font-size:.85rem;font-weight:700;margin:.6rem 0 .2rem;letter-spacing:.005em;color:color-mix(in srgb,var(--color-primary,#7c6af7) 60%,white) }
  .prose-mundo h5 { font-size:.72rem;font-weight:800;margin:.55rem 0 .15rem;letter-spacing:.08em;text-transform:uppercase;color:color-mix(in srgb,var(--color-primary,#7c6af7) 55%,white) }
  .prose-mundo h6 { font-size:.68rem;font-weight:700;margin:.5rem 0 .12rem;letter-spacing:.1em;text-transform:uppercase;color:color-mix(in srgb,var(--color-primary,#7c6af7) 45%,white) }
  .prose-mundo p  { font-size:.82rem;margin:.3rem 0;line-height:1.65;color:color-mix(in srgb,var(--color-input-text,#d1c9ff) 85%,transparent) }
  .prose-mundo p.placeholder { color:color-mix(in srgb,var(--foreground) 20%,transparent);font-style:italic }
  .prose-mundo ul,
  .prose-mundo ol { padding-left:1.2rem;margin:.3rem 0;font-size:.82rem;color:color-mix(in srgb,var(--color-input-text,#d1c9ff) 80%,transparent) }
  .prose-mundo li { margin:.12rem 0;line-height:1.55 }
  .prose-mundo ul li::marker { color:color-mix(in srgb,var(--color-primary,#7c6af7) 50%,transparent) }
  .prose-mundo ol { list-style:decimal }
  .prose-mundo ol li::marker { color:color-mix(in srgb,var(--color-primary,#7c6af7) 50%,transparent);font-variant-numeric:tabular-nums }
  .prose-mundo .task-list-item { list-style:none;padding-left:0;margin-left:-1.2rem;display:flex;align-items:flex-start;gap:.4rem }
  .prose-mundo .task-list-checkbox { margin-top:.25rem;accent-color:var(--color-primary,#7c6af7);flex-shrink:0 }
  .prose-mundo a { color:var(--color-primary,#7c6af7);text-decoration:underline;text-underline-offset:2px }
  .prose-mundo a:hover { opacity:.8 }
  .prose-mundo strong { font-weight:800;color:color-mix(in srgb,var(--foreground) 90%,transparent) }
  .prose-mundo em { font-style:italic;color:color-mix(in srgb,var(--color-input-text,#d1c9ff) 90%,transparent) }
  .prose-mundo code { font-family:var(--font-mono);font-size:.78rem;background:color-mix(in srgb,var(--color-primary,#7c6af7) 10%,transparent);padding:.1em .35em;border-radius:3px;color:color-mix(in srgb,var(--color-primary,#7c6af7) 85%,white) }
  .prose-mundo pre { background:color-mix(in srgb,var(--foreground) 4%,transparent);border:1px solid color-mix(in srgb,var(--foreground) 8%,transparent);border-radius:.5rem;padding:.7rem 1rem;overflow-x:auto;margin:.45rem 0 }
  .prose-mundo pre code { background:none;padding:0;font-size:.78rem;color:color-mix(in srgb,var(--foreground) 80%,transparent) }
  .prose-mundo blockquote { border-left:2px solid color-mix(in srgb,var(--color-primary,#7c6af7) 40%,transparent);margin:.4rem 0;padding:.3rem .8rem;color:color-mix(in srgb,var(--foreground) 55%,transparent);font-style:italic;font-size:.8rem }
  .prose-mundo hr { border:none;border-top:1px solid color-mix(in srgb,var(--foreground) 10%,transparent);margin:.6rem 0 }
  .prose-mundo del { text-decoration:line-through;opacity:.55 }
  .prose-mundo mark.md-mark { background:color-mix(in srgb,#f6c90e 25%,transparent);color:inherit;border-radius:2px;padding:0 .2em }
  .prose-mundo sup,
  .prose-mundo sub { font-size:.7em;line-height:1 }
  .prose-mundo img { max-width:100%;border-radius:4px;margin:.3rem 0 }
  .prose-mundo table { width:100%;border-collapse:collapse;font-size:.78rem;margin:.45rem 0 }
  .prose-mundo th { padding:.3rem .6rem;background:color-mix(in srgb,var(--color-primary,#7c6af7) 10%,transparent);color:color-mix(in srgb,var(--color-primary,#7c6af7) 80%,white);font-weight:700;text-align:left;border-bottom:1px solid color-mix(in srgb,var(--color-primary,#7c6af7) 20%,transparent) }
  .prose-mundo td { padding:.3rem .6rem;border-bottom:1px solid color-mix(in srgb,var(--foreground) 6%,transparent);color:color-mix(in srgb,var(--foreground) 70%,transparent) }
  .prose-mundo tr:last-child td { border-bottom:none }
  .prose-mundo .callout { border-left:3px solid;border-radius:.4rem;padding:.5rem .8rem;margin:.45rem 0;font-size:.8rem }
  .prose-mundo .callout-title { display:flex;align-items:center;gap:.35rem;font-weight:800;font-size:.75rem;letter-spacing:.04em;text-transform:uppercase;margin-bottom:.25rem }
  .prose-mundo .callout-title-icon { font-size:.9rem;line-height:1 }
  .prose-mundo .callout-body { font-size:.78rem;line-height:1.55 }
  /* ── Callout theme vars ── */
  :root {
    --callout-note-bg:color-mix(in srgb,#3b82f6 8%,transparent);--callout-note-border:#3b82f6;--callout-note-text:color-mix(in srgb,#93c5fd 80%,transparent);--callout-note-title:#60a5fa;
    --callout-tip-bg:color-mix(in srgb,#22c55e 8%,transparent);--callout-tip-border:#22c55e;--callout-tip-text:color-mix(in srgb,#86efac 80%,transparent);--callout-tip-title:#4ade80;
    --callout-warning-bg:color-mix(in srgb,#f59e0b 8%,transparent);--callout-warning-border:#f59e0b;--callout-warning-text:color-mix(in srgb,#fcd34d 80%,transparent);--callout-warning-title:#fbbf24;
    --callout-danger-bg:color-mix(in srgb,#ef4444 8%,transparent);--callout-danger-border:#ef4444;--callout-danger-text:color-mix(in srgb,#fca5a5 80%,transparent);--callout-danger-title:#f87171;
    --callout-success-bg:color-mix(in srgb,#10b981 8%,transparent);--callout-success-border:#10b981;--callout-success-text:color-mix(in srgb,#6ee7b7 80%,transparent);--callout-success-title:#34d399;
    --callout-info-bg:color-mix(in srgb,#8b5cf6 8%,transparent);--callout-info-border:#8b5cf6;--callout-info-text:color-mix(in srgb,#c4b5fd 80%,transparent);--callout-info-title:#a78bfa;
  }
  .prose-mundo .callout-note    { background:var(--callout-note-bg);    border-color:var(--callout-note-border);    color:var(--callout-note-text) }
  .prose-mundo .callout-note    .callout-title { color:var(--callout-note-title) }
  .prose-mundo .callout-tip     { background:var(--callout-tip-bg);     border-color:var(--callout-tip-border);     color:var(--callout-tip-text) }
  .prose-mundo .callout-tip     .callout-title { color:var(--callout-tip-title) }
  .prose-mundo .callout-warning { background:var(--callout-warning-bg); border-color:var(--callout-warning-border); color:var(--callout-warning-text) }
  .prose-mundo .callout-warning .callout-title { color:var(--callout-warning-title) }
  .prose-mundo .callout-danger  { background:var(--callout-danger-bg);  border-color:var(--callout-danger-border);  color:var(--callout-danger-text) }
  .prose-mundo .callout-danger  .callout-title { color:var(--callout-danger-title) }
  .prose-mundo .callout-success { background:var(--callout-success-bg); border-color:var(--callout-success-border); color:var(--callout-success-text) }
  .prose-mundo .callout-success .callout-title { color:var(--callout-success-title) }
  .prose-mundo .callout-info    { background:var(--callout-info-bg);    border-color:var(--callout-info-border);    color:var(--callout-info-text) }
  .prose-mundo .callout-info    .callout-title { color:var(--callout-info-title) }
  /* ── TOC ─────────────────────────────────────────────────────────────────── */
  .prose-mundo .toc { background:color-mix(in srgb,var(--color-primary,#7c6af7) 6%,transparent);border:1px solid color-mix(in srgb,var(--color-primary,#7c6af7) 18%,transparent);border-radius:.5rem;padding:.6rem 1rem;margin:.6rem 0;font-size:.78rem }
  .prose-mundo .toc-title { font-weight:800;font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:var(--color-primary,#7c6af7);margin-bottom:.35rem }
  .prose-mundo .toc ol { padding-left:1rem;margin:.15rem 0;counter-reset:none;list-style:decimal }
  .prose-mundo .toc ol li { padding-left:0;font-size:.76rem;margin:.12rem 0;color:color-mix(in srgb,var(--color-input-text,#d1c9ff) 80%,transparent) }
  .prose-mundo .toc ol li::before { display:none }
  .prose-mundo .toc ol ol { padding-left:1.2rem;list-style:lower-alpha }
  .prose-mundo .toc a { color:color-mix(in srgb,var(--color-primary,#7c6af7) 75%,white);text-decoration:none;transition:color .15s }
  .prose-mundo .toc a:hover { color:var(--color-primary,#7c6af7) }
  .prose-mundo h1[id], .prose-mundo h2[id], .prose-mundo h3[id],
  .prose-mundo h4[id], .prose-mundo h5[id], .prose-mundo h6[id] { scroll-margin-top:1rem }
  /* ── Heading anchors ────────────────────────────────────────────────────── */
  .prose-mundo h1,.prose-mundo h2,.prose-mundo h3,
  .prose-mundo h4,.prose-mundo h5,.prose-mundo h6 { position:relative }
  .prose-mundo .heading-anchor { opacity:0;margin-left:.4rem;font-size:.7em;font-weight:400;color:color-mix(in srgb,var(--color-primary,#7c6af7) 50%,transparent);text-decoration:none;vertical-align:middle;transition:opacity 0.15s;user-select:none }
  .prose-mundo h1:hover .heading-anchor,
  .prose-mundo h2:hover .heading-anchor,
  .prose-mundo h3:hover .heading-anchor,
  .prose-mundo h4:hover .heading-anchor,
  .prose-mundo h5:hover .heading-anchor,
  .prose-mundo h6:hover .heading-anchor { opacity:1 }
  .prose-mundo .heading-anchor:hover { color:var(--color-primary,#7c6af7) }
  /* ── Table editor hint ──────────────────────────────────────────────────── */
  .prose-mundo table { cursor:pointer;transition:outline 0.12s }
  .prose-mundo table:hover { outline:2px solid color-mix(in srgb,var(--color-primary,#7c6af7) 40%,transparent);border-radius:4px }
  /* ── Wikilinks ──────────────────────────────────────────────────────────── */
  .prose-mundo a.wikilink { color:var(--accent,#7c6af7);text-decoration:none;border-bottom:1px dashed color-mix(in srgb,var(--accent,#7c6af7) 50%,transparent);padding-bottom:1px;cursor:pointer;transition:all 0.15s }
  .prose-mundo a.wikilink:hover { border-bottom-style:solid;background:color-mix(in srgb,var(--accent,#7c6af7) 8%,transparent);border-radius:2px }
  /* ── Links block ────────────────────────────────────────────────────────── */
  .prose-mundo .link-list-block { background:color-mix(in srgb,var(--color-primary,#7c6af7) 8%,transparent);border-color:color-mix(in srgb,var(--color-primary,#7c6af7) 30%,transparent) }
  .prose-mundo .link-list-block ul { list-style:none;padding:0;margin:.3rem 0 0 0 }
  .prose-mundo .link-list-block li { margin:.3rem 0;padding-left:1.2rem;position:relative }
  .prose-mundo .link-list-block li::before { content:"›";position:absolute;left:.2rem;font-size:1.2rem;line-height:0.8;color:var(--color-primary,#7c6af7);font-weight:bold }
  .prose-mundo .link-list-block a { font-weight:600;word-break:break-all;text-decoration:none;color:color-mix(in srgb,var(--color-input-text,#d1c9ff) 90%,white) }
  .prose-mundo .link-list-block a:hover { color:var(--color-primary,#7c6af7);text-decoration:underline }
  /* ── Página tag (modo libro) ─────────────────────────────────────────────── */
  .prose-mundo .libro-page-tag { display:inline-flex;align-items:center;font-family:var(--font-mono,monospace);font-size:.68em;font-weight:600;letter-spacing:.06em;padding:1px 6px;border-radius:3px;background:color-mix(in srgb,var(--foreground,#fff) 6%,transparent);border:1px solid color-mix(in srgb,var(--foreground,#fff) 14%,transparent);color:color-mix(in srgb,var(--foreground,#fff) 40%,transparent);vertical-align:middle;margin-left:.3em;user-select:none;transition:background 0.12s,color 0.12s;cursor:default;white-space:nowrap }
  .prose-mundo .libro-page-tag:hover { background:color-mix(in srgb,var(--foreground,#fff) 10%,transparent);color:color-mix(in srgb,var(--foreground,#fff) 65%,transparent) }
`;
