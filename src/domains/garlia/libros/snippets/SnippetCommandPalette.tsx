"use client";
import Image from "next/image";
import {
  Search,
  Swords,
  GitBranch,
  MousePointerClick,
  DoorOpen,
  Bookmark,
  Image as ImageIcon,
  Music2,
  User,
  PawPrint,
  Package,
  Flag,
  Quote,
  AlignRight,
  Pilcrow,
  MessageCircle,
  Superscript,
} from "lucide-react";

import { fetchEntidades } from "@/lib/api/queries/entidades";

/**
 * SnippetCommandPalette — búsqueda unificada
 * ──────────────────────────────────────────
 * Un solo input. Escribís "add imagen castillo", "add drop espada",
 * "add sonido lluvia" y filtra todo en tiempo real sin pasos intermedios.
 */

import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";

import { parseSnippetRaw } from "@/domains/garlia/libros/capitulos/types";

type SnippetType =
  | "drop"
  | "dialogo"
  | "choice"
  | "use"
  | "condicion"
  | "flag"
  | "section"
  | "imagen"
  | "sound"
  | "epigrafe"
  | "nota"
  // Los siguientes tres nunca abren selectedType (ver directAction en
  // CATS) — existen como id solo para que la key de React sea única.
  | "cita"
  | "align-right"
  | "parrafo";

interface PaletteProps {
  anchorRect: { top: number; left: number };
  initialRaw?: string;
  /** Texto pre-cargado en el buscador principal (ej. lo escrito tras "/") */
  initialQuery?: string;
  listaCapitulos?: { id: string; orden: number; titulo_capitulo: string }[];
  listaSecciones?: { id: string; label: string }[];
  onInsert: (raw: string) => void;
  /** Aplica un comando de formato de bloque (ej. "align-right") sobre el
   * párrafo actual — usado por directAction, ver CATS. Si no se pasa,
   * esos items se ignoran silenciosamente (no deberían aparecer en ese
   * caso; el padre es responsable de pasarlo si expone el grupo). */
  onFormatCommand?: (commandId: "align-right") => void;
  onClose: () => void;
}

const CATS: {
  id: SnippetType;
  label: string;
  Icon: typeof Swords;
  group: "narrativa" | "media" | "estructura";
  keywords: string[];
  /**
   * Si está presente, el click ejecuta esto directo e inserta/aplica
   * sin pasar por el formulario paso 2 (selectedType). Se usa para
   * comandos que no tienen campos que llenar: insertan texto plano
   * (onInsert) o aplican un formato de bloque (formatCommand).
   */
  directAction?: {
    insert?: string;
    formatCommand?: "align-right";
  };
}[] = [
  {
    id: "drop",
    label: "Drop",
    Icon: Swords,
    group: "narrativa",
    keywords: ["drop", "entidad", "personaje", "criatura", "item"],
  },
  {
    id: "dialogo",
    label: "Diálogo",
    Icon: MessageCircle,
    group: "narrativa",
    keywords: ["dialogo", "diálogo", "habla", "personaje", "retrato", "conversacion"],
  },
  {
    id: "choice",
    label: "Choice",
    Icon: GitBranch,
    group: "narrativa",
    keywords: ["choice", "decisión", "boton", "botón"],
  },
  {
    id: "use",
    label: "Use",
    Icon: MousePointerClick,
    group: "narrativa",
    keywords: ["use", "usar", "ítem", "inventario"],
  },
  {
    id: "condicion",
    label: "Condición",
    Icon: DoorOpen,
    group: "narrativa",
    keywords: ["condicion", "condición", "gate", "puerta", "flag", "condicional", "si"],
  },
  {
    id: "flag",
    label: "Acción",
    Icon: Flag,
    group: "narrativa",
    keywords: ["flag", "accion", "acción", "bandera", "estado", "variable"],
  },
  {
    id: "section",
    label: "Sección",
    Icon: Bookmark,
    group: "narrativa",
    keywords: ["section", "sección", "seccion", "ancla"],
  },
  {
    id: "imagen",
    label: "Imagen",
    Icon: ImageIcon,
    group: "media",
    keywords: ["imagen", "img", "foto", "dibujo"],
  },
  {
    id: "sound",
    label: "Sonido",
    Icon: Music2,
    group: "media",
    keywords: ["sonido", "sound", "música", "musica", "audio"],
  },
  {
    id: "epigrafe",
    label: "Epígrafe",
    Icon: Quote,
    group: "estructura",
    keywords: ["epigrafe", "epígrafe", "cita literaria", "atribución"],
  },
  {
    id: "nota",
    label: "Nota al pie",
    Icon: Superscript,
    group: "estructura",
    keywords: ["nota", "footnote", "aclaración", "aclaracion", "pie de página", "pie de pagina"],
  },
  {
    // "cita" bibliográfica ya existente ([[cita|Texto — Fuente]]), se
    // inserta como texto plano (cae al default de rawSnippetToNode).
    // Distinta del epígrafe de arriba — conviven sin pisarse.
    id: "cita",
    label: "Cita",
    Icon: Quote,
    group: "estructura",
    keywords: ["cita", "quote", "fuente", "bibliográfica"],
    directAction: { insert: "[[cita|Texto de la cita — Fuente]]" },
  },
  {
    id: "align-right",
    label: "Alinear a la derecha",
    Icon: AlignRight,
    group: "estructura",
    keywords: ["alinear", "derecha", "align", "right"],
    directAction: { formatCommand: "align-right" },
  },
  {
    id: "parrafo",
    label: "Párrafo",
    Icon: Pilcrow,
    group: "estructura",
    keywords: ["parrafo", "párrafo", "salto"],
    directAction: { insert: " " },
  },
];

const GROUP_LABELS: Record<"narrativa" | "media" | "estructura", string> = {
  narrativa: "Narrativa",
  media: "Media",
  estructura: "Estructura",
};

const S = {
  popover: {
    position: "fixed" as const,
    zIndex: 9999,
    background: "var(--surface-2, var(--background))",
    border: "0.5px solid var(--border, rgba(255,255,255,0.1))",
    borderRadius: 10,
    boxShadow: "0 8px 24px rgba(0,0,0,.14), 0 2px 6px rgba(0,0,0,.08)",
    width: 300,
    overflow: "hidden",
    fontFamily: "var(--font-sans, system-ui)",
  },
  header: {
    display: "flex" as const,
    alignItems: "center" as const,
    gap: 8,
    padding: "10px 12px 9px",
    borderBottom:
      "0.5px solid color-mix(in srgb, var(--foreground, #fff) 8%, transparent)",
  },
  mainInput: {
    flex: 1,
    background: "none",
    border: "none",
    outline: "none",
    fontSize: 13,
    fontWeight: 500,
    color: "var(--foreground, #fff)",
    caretColor: "var(--foreground, #fff)",
    minWidth: 0,
  },
  fieldInput: {
    width: "100%",
    boxSizing: "border-box" as const,
    background: "color-mix(in srgb, var(--foreground, #fff) 5%, transparent)",
    border:
      "1px solid color-mix(in srgb, var(--foreground, #fff) 10%, transparent)",
    borderRadius: 8,
    padding: "7px 10px",
    fontSize: 12,
    fontWeight: 500,
    color: "var(--foreground, #fff)",
    outline: "none",
  },
  list: { maxHeight: 280, overflowY: "auto" as const, padding: "4px 6px" },
  groupLabel: {
    padding: "8px 8px 3px",
    fontSize: 10,
    fontWeight: 500,
    textTransform: "uppercase" as const,
    letterSpacing: ".06em",
    color: "color-mix(in srgb, var(--foreground, #fff) 32%, transparent)",
  } as React.CSSProperties,
  row: (active: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 9,
    padding: "6px 8px",
    borderRadius: 6,
    cursor: "pointer",
    background: active
      ? "color-mix(in srgb, var(--foreground, #fff) 6%, transparent)"
      : "transparent",
  }),
  iconBox: (
    color: string = "color-mix(in srgb, var(--foreground, #fff) 55%, transparent)",
  ): React.CSSProperties => ({
    width: 28,
    height: 28,
    borderRadius: 8,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background:
      color.startsWith("#")
        ? `color-mix(in srgb, ${color} 10%, transparent)`
        : "color-mix(in srgb, var(--foreground, #fff) 5%, transparent)",
    border:
      color.startsWith("#")
        ? `0.5px solid color-mix(in srgb, ${color} 22%, transparent)`
        : "0.5px solid color-mix(in srgb, var(--foreground, #fff) 10%, transparent)",
    fontSize: 13,
    color,
  }),
  label: {
    fontSize: 12.5,
    fontWeight: 400,
    color: "var(--foreground, var(--foreground))",
    lineHeight: 1.2,
  } as React.CSSProperties,
  sublabel: {
    fontSize: 10,
    fontWeight: 400,
    color:
      "color-mix(in srgb, var(--foreground, var(--foreground)) 45%, transparent)",
  } as React.CSSProperties,
  kbd: {
    fontSize: 9,
    fontWeight: 500,
    color: "color-mix(in srgb, var(--foreground, #fff) 30%, transparent)",
    background: "color-mix(in srgb, var(--foreground, #fff) 6%, transparent)",
    border:
      "0.5px solid color-mix(in srgb, var(--foreground, #fff) 10%, transparent)",
    borderRadius: 4,
    padding: "1px 5px",
    marginLeft: "auto",
    flexShrink: 0,
  } as React.CSSProperties,
  empty: {
    padding: "20px 12px",
    fontSize: 11,
    textAlign: "center" as const,
    color: "color-mix(in srgb, var(--foreground, #fff) 25%, transparent)",
  },
  insertBtn: (_color: string): React.CSSProperties => ({
    width: "100%",
    boxSizing: "border-box" as const,
    background:
      "color-mix(in srgb, var(--color-primary, var(--primary)) 12%, transparent)",
    border:
      "0.5px solid color-mix(in srgb, var(--color-primary, var(--primary)) 30%, transparent)",
    borderRadius: 8,
    padding: "8px 12px",
    fontSize: 10,
    fontWeight: 900,
    textTransform: "uppercase" as const,
    letterSpacing: ".1em",
    color: "var(--color-primary, var(--primary))",
    cursor: "pointer",
    transition: "background .12s",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  }),
  backBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "color-mix(in srgb, var(--foreground, #fff) 40%, transparent)",
    fontSize: 18,
    lineHeight: 1,
    padding: "0 2px 0 0",
    display: "flex",
    alignItems: "center",
  } as React.CSSProperties,
  fieldLabel: {
    fontSize: 9,
    fontWeight: 800,
    textTransform: "uppercase" as const,
    letterSpacing: ".1em",
    color: "color-mix(in srgb, var(--foreground, #fff) 35%, transparent)",
    marginBottom: 4,
  } as React.CSSProperties,
  selectedPill: (_color?: string): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 8,
    background:
      "color-mix(in srgb, var(--color-primary, var(--primary)) 8%, transparent)",
    border:
      "0.5px solid color-mix(in srgb, var(--color-primary, var(--primary)) 20%, transparent)",
    borderRadius: 8,
    padding: "6px 10px",
  }),
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function flattenTree(
  nodes: any[],
): { name: string; url: string; path: string }[] {
  const result: { name: string; url: string; path: string }[] = [];
  function walk(ns: any[], prefix: string) {
    for (const n of ns) {
      if (n.url)
        result.push({
          name: n.name,
          url: n.url,
          path: prefix ? `${prefix} / ${n.name}` : n.name,
        });
      if (n.children)
        walk(n.children, prefix ? `${prefix} / ${n.name}` : n.name);
    }
  }
  walk(nodes, "");
  return result;
}

// Mantiene visible el ítem activo cuando se navega con flechas — sin esto,
// el índice avanzaba pero la fila resaltada se iba fuera del área visible
// del scroll y el usuario tenía que scrollear a mano para verla (lento,
// además de que parecía que las flechas "no hacían nada").
function scrollActiveIntoView(container: HTMLElement | null, idx: number) {
  if (!container) return;
  const el = container.querySelector<HTMLElement>(`[data-idx="${idx}"]`);
  el?.scrollIntoView({ block: "nearest" });
}

// ── Header compartido para todos los forms ───────────────────────────────────

function FormHeader({
  label,
  Icon,
  onBack,
}: {
  label: string;
  Icon: typeof Swords;
  onBack: () => void;
}) {
  return (
    <div style={S.header}>
      <button style={S.backBtn} title="Volver" onClick={onBack}>
        ‹
      </button>
      <span
        style={{
          ...S.iconBox(),
          width: 22,
          height: 22,
          borderRadius: 6,
        }}
      >
        <Icon size={12} />
      </span>
      <span
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: "color-mix(in srgb, var(--foreground, #fff) 55%, transparent)",
          textTransform: "uppercase" as const,
          letterSpacing: ".08em",
        }}
      >
        {label}
      </span>
    </div>
  );
}

// ── Form Drop ────────────────────────────────────────────────────────────────

function FormDrop({
  initialRaw,
  onInsert,
  onBack,
  query,
}: {
  initialRaw?: string;
  onInsert: (s: string) => void;
  onBack: () => void;
  query?: string;
}) {
  const init = parseSnippetRaw(initialRaw);
  const initialId = init?.kind === "drop" ? (init as any).entidadId : undefined;
  const [palabra, setPalabra] = useState<string>(
    init?.kind === "drop" ? ((init as any).label ?? "") : "",
  );

  type Ent = {
    id: string;
    nombre: string;
    tipo: "personaje" | "criatura" | "item";
    subtipo?: string;
    imagen_url?: string;
  };
  const TIPO_CFG = {
    personaje: { Icon: User },
    criatura: { Icon: PawPrint },
    item: { Icon: Package },
  };

  const [all, setAll] = useState<Ent[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState(query ?? "");
  const [active, setActive] = useState(0);
  const [selected, setSelected] = useState<Ent | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollActiveIntoView(listRef.current, active);
  }, [active]);

  useEffect(() => {
    void fetchEntidades()
      .then((d) => {
        if (!d.ok) return;
        const list: Ent[] = [
          ...(d.data?.personajes ?? []).map((x: any) => ({
            id: x.id,
            nombre: x.nombre,
            tipo: "personaje" as const,
            subtipo: x.ocupacion,
            imagen_url: x.img_url || x.imagen_url,
          })),
          ...(d.data?.criaturas ?? []).map((x: any) => ({
            id: x.id,
            nombre: x.nombre,
            tipo: "criatura" as const,
            subtipo: x.habitat,
            imagen_url: x.img_url || x.imagen_url,
          })),
          ...(d.data?.items ?? []).map((x: any) => ({
            id: x.id,
            nombre: x.nombre,
            tipo: "item" as const,
            subtipo: x.categoria,
            imagen_url: x.imagen_url,
          })),
        ].sort((a, b) => a.nombre.localeCompare(b.nombre));
        setAll(list);
        // Si estamos editando un drop existente, preseleccionamos la
        // entidad real apenas tenemos la lista cargada. Antes initialId
        // se calculaba pero nunca se usaba, así que el form siempre
        // arrancaba "sin vínculo" — eso es lo que rompía el snippet
        // al volver a guardar.
        if (initialId) {
          const found = list.find((e) => e.id === initialId);
          if (found) setSelected(found);
        }
      })
      .finally(() => setLoading(false));
  }, [initialId]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  useEffect(() => {
    setActive(0);
  }, [q]);

  const filtered = useMemo(
    () =>
      q
        ? all.filter(
            (e) =>
              e.nombre.toLowerCase().includes(q.toLowerCase()) ||
              e.tipo.includes(q.toLowerCase()),
          )
        : all,
    [all, q],
  );

  if (selected) {
    const cfg = TIPO_CFG[selected.tipo];
    return (
      <>
        <FormHeader Icon={Swords} label="Drop" onBack={onBack} />
        <div
          style={{
            padding: "10px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div style={S.selectedPill()}>
            {selected.imagen_url ? (
              <Image
                alt=""
                src={selected.imagen_url}
                style={{
                  width: 36,
                  height: 36,
                  objectFit: "cover",
                  borderRadius: 6,
                  flexShrink: 0,
                }}
              />
            ) : (
              <span style={S.iconBox()}>
                <cfg.Icon size={13} />
              </span>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={S.label}>{selected.nombre}</div>
              <div style={S.sublabel}>
                {selected.tipo}
                {selected.subtipo ? ` · ${selected.subtipo}` : ""}
              </div>
            </div>
            <button
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "color-mix(in srgb,var(--foreground) 35%,transparent)",
                fontSize: 14,
              }}
              onClick={() => setSelected(null)}
            >
              ✕
            </button>
          </div>
          <div>
            <div style={S.fieldLabel}>Palabra en el texto</div>
            <input
              placeholder="ej: la espada oxidada…"
              style={S.fieldInput}
              value={palabra}
              onChange={(e) => setPalabra(e.target.value)}
            />
          </div>
          <button
            disabled={!palabra.trim()}
            style={S.insertBtn("#a09af0")}
            onClick={() =>
              onInsert(
                `[[drop|${palabra.trim()}|${selected.tipo}|${selected.id}|${selected.nombre}]]`,
              )
            }
          >
            <Swords size={12} /> Insertar Drop
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <FormHeader Icon={Swords} label="Drop" onBack={onBack} />
      <div style={{ padding: "10px 12px 6px" }}>
        <input
          ref={inputRef}
          placeholder="Personaje, criatura o ítem…"
          style={S.fieldInput}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((v) => Math.min(v + 1, filtered.length - 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((v) => Math.max(v - 1, 0));
            }
            if (e.key === "Enter" && filtered[active]) {
              setSelected(filtered[active]);
              setPalabra((p) => p || filtered[active].nombre);
            }
          }}
        />
      </div>
      <div ref={listRef} style={S.list}>
        {loading && <div style={S.empty}>Cargando…</div>}
        {!loading && filtered.length === 0 && (
          <div style={S.empty}>Sin resultados</div>
        )}
        {filtered.map((e, i) => {
          const cfg = TIPO_CFG[e.tipo];
          return (
            <div
              key={e.id}
              data-idx={i}
              style={S.row(i === active || e.id === initialId)}
              onClick={() => {
                setSelected(e);
                setPalabra((p) => p || e.nombre);
              }}
              onMouseEnter={() => setActive(i)}
            >
              {e.imagen_url ? (
                <Image
                  alt=""
                  src={e.imagen_url}
                  style={{
                    width: 28,
                    height: 28,
                    objectFit: "cover",
                    borderRadius: 6,
                    flexShrink: 0,
                  }}
                />
              ) : (
                <span style={S.iconBox()}>
                  <cfg.Icon size={13} />
                </span>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={S.label}>{e.nombre}</div>
                <div style={S.sublabel}>
                  {e.tipo}
                  {e.subtipo ? ` · ${e.subtipo}` : ""}
                </div>
              </div>
              {e.id === initialId && <span style={S.kbd}>actual</span>}
            </div>
          );
        })}
      </div>
    </>
  );
}

// ── Form Diálogo ─────────────────────────────────────────────────────────────
// Elige un Personaje real (búsqueda vía fetchEntidades, igual patrón que
// FormDrop pero acotado a personajes) y el texto que dice. El raw final
// solo guarda personaje_id + texto — nombre/retrato se resuelven SIEMPRE
// contra la ficha real al leer (ver DialogoBlock en SegmentRenderers.tsx),
// nunca se congelan acá.
function FormDialogo({
  initialRaw,
  onInsert,
  onBack,
  query,
}: {
  initialRaw?: string;
  onInsert: (s: string) => void;
  onBack: () => void;
  query?: string;
}) {
  const init = parseSnippetRaw(initialRaw);
  const initialId = init?.kind === "dialogo" ? init.personajeId : undefined;
  const [texto, setTexto] = useState<string>(
    init?.kind === "dialogo" ? init.texto : "",
  );

  type Pers = { id: string; nombre: string; imagen_url?: string; subtipo?: string };

  const [all, setAll] = useState<Pers[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState(query ?? "");
  const [active, setActive] = useState(0);
  const [selected, setSelected] = useState<Pers | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollActiveIntoView(listRef.current, active);
  }, [active]);

  useEffect(() => {
    void fetchEntidades()
      .then((d) => {
        if (!d.ok) return;
        const list: Pers[] = (d.data?.personajes ?? [])
          .map((x: any) => ({
            id: x.id,
            nombre: x.nombre,
            subtipo: x.ocupacion,
            imagen_url: x.img_url || x.imagen_url,
          }))
          .sort((a: Pers, b: Pers) => a.nombre.localeCompare(b.nombre));
        setAll(list);
        if (initialId) {
          const found = list.find((e) => e.id === initialId);
          if (found) setSelected(found);
        }
      })
      .finally(() => setLoading(false));
  }, [initialId]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  useEffect(() => {
    setActive(0);
  }, [q]);

  const filtered = useMemo(
    () => (q ? all.filter((e) => e.nombre.toLowerCase().includes(q.toLowerCase())) : all),
    [all, q],
  );

  if (selected) {
    return (
      <>
        <FormHeader Icon={MessageCircle} label="Diálogo" onBack={onBack} />
        <div
          style={{
            padding: "10px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div style={S.selectedPill()}>
            {selected.imagen_url ? (
              <Image
                alt=""
                src={selected.imagen_url}
                style={{
                  width: 36,
                  height: 36,
                  objectFit: "cover",
                  borderRadius: "50%",
                  flexShrink: 0,
                }}
              />
            ) : (
              <span style={S.iconBox()}>
                <User size={13} />
              </span>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={S.label}>{selected.nombre}</div>
              <div style={S.sublabel}>Personaje</div>
            </div>
            <button
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "color-mix(in srgb,var(--foreground) 35%,transparent)",
                fontSize: 14,
              }}
              onClick={() => setSelected(null)}
            >
              ✕
            </button>
          </div>
          <div>
            <div style={S.fieldLabel}>Qué dice</div>
            <textarea
              ref={textRef}
              placeholder="ej: No deberíamos estar aquí…"
              rows={3}
              style={{ ...S.fieldInput, resize: "vertical" as const }}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />
          </div>
          <button
            disabled={!texto.trim()}
            style={S.insertBtn("#a09af0")}
            onClick={() =>
              onInsert(`[[dialogo|${selected.id}|${texto.trim()}]]`)
            }
          >
            <MessageCircle size={12} /> Insertar Diálogo
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <FormHeader Icon={MessageCircle} label="Diálogo" onBack={onBack} />
      <div style={{ padding: "10px 12px 6px" }}>
        <input
          ref={inputRef}
          placeholder="Buscar personaje…"
          style={S.fieldInput}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((v) => Math.min(v + 1, filtered.length - 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((v) => Math.max(v - 1, 0));
            }
            if (e.key === "Enter" && filtered[active]) {
              setSelected(filtered[active]);
            }
          }}
        />
      </div>
      <div ref={listRef} style={S.list}>
        {loading && <div style={S.empty}>Cargando…</div>}
        {!loading && filtered.length === 0 && (
          <div style={S.empty}>Sin resultados</div>
        )}
        {filtered.map((e, i) => (
          <div
            key={e.id}
            data-idx={i}
            style={S.row(i === active || e.id === initialId)}
            onClick={() => setSelected(e)}
            onMouseEnter={() => setActive(i)}
          >
            {e.imagen_url ? (
              <Image
                alt=""
                src={e.imagen_url}
                style={{
                  width: 28,
                  height: 28,
                  objectFit: "cover",
                  borderRadius: "50%",
                  flexShrink: 0,
                }}
              />
            ) : (
              <span style={S.iconBox()}>
                <User size={13} />
              </span>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={S.label}>{e.nombre}</div>
              {e.subtipo && <div style={S.sublabel}>{e.subtipo}</div>}
            </div>
            {e.id === initialId && <span style={S.kbd}>actual</span>}
          </div>
        ))}
      </div>
    </>
  );
}

// ── Form Choice ──────────────────────────────────────────────────────────────

function FormChoice({
  initialRaw,
  listaSecciones = [],
  onInsert,
  onBack,
}: {
  initialRaw?: string;
  listaSecciones?: { id: string; label: string }[];
  onInsert: (s: string) => void;
  onBack: () => void;
}) {
  const init = parseSnippetRaw(initialRaw);
  const [texto, setTexto] = useState(
    init?.kind === "choice" ? (init as any).texto : "",
  );
  const [target, setTarget] = useState(
    init?.kind === "choice" ? (init as any).target : "",
  );
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  const snippet =
    texto.trim() && target.trim()
      ? `[[choice|${texto.trim()}|${target.trim()}]]`
      : "";

  return (
    <>
      <FormHeader Icon={GitBranch} label="Choice" onBack={onBack} />
      <div
        style={{
          padding: "10px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          maxHeight: 340,
          overflowY: "auto",
        }}
      >
        <div>
          <div style={S.fieldLabel}>Texto del botón</div>
          <input
            ref={inputRef}
            placeholder="ej: Inspeccionar pared…"
            style={S.fieldInput}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
        </div>
        {listaSecciones.length > 0 ? (
          <div>
            <div style={S.fieldLabel}>Sección destino</div>
            <div style={{ maxHeight: 160, overflowY: "auto" }}>
              {listaSecciones.map((sec) => (
                <div
                  key={sec.id}
                  style={{
                    ...S.row(target === sec.id),
                    borderRadius: 6,
                    marginBottom: 2,
                    border:
                      target === sec.id
                        ? "1px solid color-mix(in srgb, var(--foreground, #fff) 30%, transparent)"
                        : "1px solid transparent",
                  }}
                  onClick={() => setTarget(sec.id)}
                >
                  <span style={S.iconBox()}><Bookmark size={11} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={S.label}>{sec.label || sec.id}</div>
                    <div
                      style={{
                        ...S.sublabel,
                        fontFamily: "var(--font-mono, monospace)",
                      }}
                    >
                      {sec.id}
                    </div>
                  </div>
                  {target === sec.id && <span style={S.kbd}>✓</span>}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <div style={S.fieldLabel}>ID de sección destino</div>
            <input
              placeholder="ej: cofre-secreto"
              style={{
                ...S.fieldInput,
                fontFamily: "var(--font-mono, monospace)",
              }}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
            <div style={{ ...S.sublabel, marginTop: 4 }}>
              Creá primero una Sección en este capítulo.
            </div>
          </div>
        )}
        <button
          disabled={!snippet}
          style={S.insertBtn("#5aabf5")}
          onClick={() => snippet && onInsert(snippet)}
        >
          <GitBranch size={12} /> Insertar Choice
        </button>
      </div>
    </>
  );
}

// ── Form Section ─────────────────────────────────────────────────────────────

// ── Form Epígrafe ────────────────────────────────────────────────────────────
// Cita/epígrafe literario de inicio de capítulo: texto en cursiva +
// atribución alineada a la derecha. Distinto del "cita" bibliográfico
// (directAction en CATS, texto plano [[cita|...]]) — este es un tipo con
// form propio porque separa mejor los dos campos (texto largo vs.
// atribución corta) y deja lugar para estilos propios en el render.
function FormEpigrafe({
  initialRaw,
  onInsert,
  onBack,
}: {
  initialRaw?: string;
  onInsert: (s: string) => void;
  onBack: () => void;
}) {
  const init = parseSnippetRaw(initialRaw);
  const [texto, setTexto] = useState(
    init?.kind === "epigrafe" ? (init as any).texto : "",
  );
  const [atribucion, setAtribucion] = useState(
    init?.kind === "epigrafe" ? (init as any).atribucion : "",
  );
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const snippet = texto.trim()
    ? `[[epigrafe|${texto.trim()}|${atribucion.trim()}]]`
    : "";

  return (
    <>
      <FormHeader Icon={Quote} label="Epígrafe" onBack={onBack} />
      <div
        style={{
          padding: "10px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div>
          <div style={S.fieldLabel}>Texto</div>
          <textarea
            ref={inputRef}
            placeholder="ej: Todo lo que sé sobre el amor lo aprendí en un naufragio…"
            rows={3}
            style={{ ...S.fieldInput, resize: "vertical", fontStyle: "italic" }}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
        </div>
        <div>
          <div style={S.fieldLabel}>Atribución (opcional)</div>
          <input
            placeholder="ej: Julia Navarro"
            style={S.fieldInput}
            value={atribucion}
            onChange={(e) => setAtribucion(e.target.value)}
          />
        </div>
        <button
          disabled={!texto.trim()}
          style={S.insertBtn("#8b83e8")}
          onClick={() => snippet && onInsert(snippet)}
        >
          <Quote size={12} /> Insertar Epígrafe
        </button>
      </div>
    </>
  );
}

// ── Form Nota al pie ─────────────────────────────────────────────────────────
// Texto plano (con markdown inline propio, resuelto por el lector) que se
// inserta donde está el cursor. El lector lo numera automáticamente en
// orden de aparición y lo muestra como marcador superíndice + entrada al
// final del capítulo. Ver [[nota|...]] en ContenidoInteractivo.tsx.

function FormNota({
  initialRaw,
  onInsert,
  onBack,
}: {
  initialRaw?: string;
  onInsert: (s: string) => void;
  onBack: () => void;
}) {
  const init = parseSnippetRaw(initialRaw);
  const [texto, setTexto] = useState(
    init?.kind === "nota" ? (init as any).texto : "",
  );
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const snippet = texto.trim() ? `[[nota|${texto.trim()}]]` : "";

  return (
    <>
      <FormHeader Icon={Superscript} label="Nota al pie" onBack={onBack} />
      <div
        style={{
          padding: "10px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div>
          <div style={S.fieldLabel}>Texto de la nota</div>
          <textarea
            ref={inputRef}
            placeholder="ej: El término original en garlio antiguo era distinto…"
            rows={3}
            style={{ ...S.fieldInput, resize: "vertical" }}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
        </div>
        <span style={{ ...S.sublabel, fontSize: 10 }}>
          Se inserta donde está el cursor. El lector la numera sola y la
          muestra al final del capítulo.
        </span>
        <button
          disabled={!texto.trim()}
          style={S.insertBtn("#8b83e8")}
          onClick={() => snippet && onInsert(snippet)}
        >
          <Superscript size={12} /> Insertar Nota
        </button>
      </div>
    </>
  );
}

// ── Form Sección ─────────────────────────────────────────────────────────────

function FormSection({
  initialRaw,
  onInsert,
  onBack,
}: {
  initialRaw?: string;
  onInsert: (s: string) => void;
  onBack: () => void;
}) {
  const init = parseSnippetRaw(initialRaw);
  const [label, setLabel] = useState(
    init?.kind === "section" ? (init as any).label : "",
  );
  const [id, setId] = useState(
    init?.kind === "section" ? (init as any).id : "",
  );
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  const autoId =
    id ||
    label
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
  const snippet = autoId
    ? label
      ? `[[section|${autoId}|${label}]]`
      : `[[section|${autoId}]]`
    : "";

  return (
    <>
      <FormHeader Icon={Bookmark} label="Sección" onBack={onBack} />
      <div
        style={{
          padding: "10px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div>
          <div style={S.fieldLabel}>Nombre visible</div>
          <input
            ref={inputRef}
            placeholder="ej: Abrir el cofre…"
            style={S.fieldInput}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
        <div>
          <div style={S.fieldLabel}>ID (auto)</div>
          <input
            placeholder={autoId || "ej: cofre"}
            style={{
              ...S.fieldInput,
              fontFamily: "var(--font-mono, monospace)",
              fontSize: 11,
            }}
            value={id}
            onChange={(e) =>
              setId(e.target.value.toLowerCase().replace(/\s+/g, "-"))
            }
          />
        </div>
        <button
          disabled={!autoId}
          style={S.insertBtn("#8b83e8")}
          onClick={() => snippet && onInsert(snippet)}
        >
          <Bookmark size={12} /> Insertar Sección
        </button>
      </div>
    </>
  );
}

// ── Form Use ─────────────────────────────────────────────────────────────────

function FormUse({
  initialRaw,
  listaSecciones = [],
  onInsert,
  onBack,
}: {
  initialRaw?: string;
  listaSecciones?: { id: string; label: string }[];
  onInsert: (s: string) => void;
  onBack: () => void;
}) {
  const init = parseSnippetRaw(initialRaw);
  const [palabra, setPalabra] = useState(
    init?.kind === "use" ? (init as any).label : "",
  );
  const [targetOk, setTargetOk] = useState("");
  const [targetFail, setTargetFail] = useState("");
  const [item, setItem] = useState<{ id: string; nombre: string } | null>(null);
  const [items, setItems] = useState<{ id: string; nombre: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollActiveIntoView(listRef.current, active);
  }, [active]);

  useEffect(() => {
    void fetchEntidades("item")
      .then((d) => {
        if (d.ok)
          setItems(
            (d.data?.items ?? []).map((x: any) => ({
              id: x.id,
              nombre: x.nombre,
            })),
          );
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = useMemo(
    () => items.filter((i) => i.nombre.toLowerCase().includes(q.toLowerCase())),
    [items, q],
  );
  const snippet =
    palabra.trim() && item && targetOk
      ? `[[use|${palabra.trim()}|${item.id}|${targetOk}${targetFail ? `|${targetFail}` : ""}]]`
      : "";

  const SeccionSelect = ({
    value,
    onChange,
    placeholder,
  }: {
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
  }) =>
    listaSecciones.length > 0 ? (
      <select
        style={{ ...S.fieldInput, cursor: "pointer" }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{placeholder}</option>
        {listaSecciones.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label || s.id}
          </option>
        ))}
      </select>
    ) : (
      <input
        placeholder={placeholder}
        style={S.fieldInput}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );

  return (
    <>
      <FormHeader Icon={MousePointerClick} label="Use Ítem" onBack={onBack} />
      <div
        style={{
          padding: "10px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          maxHeight: 380,
          overflowY: "auto",
        }}
      >
        <div>
          <div style={S.fieldLabel}>Palabra en el texto</div>
          <input
            ref={inputRef}
            placeholder="ej: usar llave…"
            style={S.fieldInput}
            value={palabra}
            onChange={(e) => setPalabra(e.target.value)}
          />
        </div>
        {!item ? (
          <div>
            <div style={S.fieldLabel}>Ítem a usar</div>
            <input
              placeholder="Buscar ítem…"
              style={S.fieldInput}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((v) => Math.min(v + 1, filtered.length - 1));
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((v) => Math.max(v - 1, 0));
                }
                if (e.key === "Enter" && filtered[active])
                  setItem(filtered[active]);
              }}
            />
            <div
              ref={listRef}
              style={{ maxHeight: 120, overflowY: "auto", marginTop: 4 }}
            >
              {loading && <div style={S.empty}>Cargando…</div>}
              {filtered.map((it, i) => (
                <div
                  key={it.id}
                  data-idx={i}
                  style={S.row(i === active)}
                  onClick={() => setItem(it)}
                  onMouseEnter={() => setActive(i)}
                >
                  <span style={S.iconBox()}><MousePointerClick size={11} /></span>
                  <span style={S.label}>{it.nombre}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={S.selectedPill()}>
            <span style={S.iconBox()}><MousePointerClick size={11} /></span>
            <span style={{ ...S.label, flex: 1 }}>{item.nombre}</span>
            <button
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "color-mix(in srgb,var(--foreground) 35%,transparent)",
                fontSize: 14,
              }}
              onClick={() => setItem(null)}
            >
              ✕
            </button>
          </div>
        )}
        <div>
          <div style={S.fieldLabel}>Sección si TIENE el ítem *</div>
          <SeccionSelect
            placeholder="— elegí sección —"
            value={targetOk}
            onChange={setTargetOk}
          />
        </div>
        <div>
          <div style={S.fieldLabel}>Sección si NO tiene (opcional)</div>
          <SeccionSelect
            placeholder="— ninguna —"
            value={targetFail}
            onChange={setTargetFail}
          />
        </div>
        <button
          disabled={!snippet}
          style={S.insertBtn("#f07574")}
          onClick={() => snippet && onInsert(snippet)}
        >
          <MousePointerClick size={12} /> Insertar Use
        </button>
      </div>
    </>
  );
}

// ── Form Condición (fusión de Gate + Flag-if) ──────────────────────────────────

function FormCondicion({
  initialRaw,
  listaSecciones = [],
  onInsert,
  onBack,
}: {
  initialRaw?: string;
  listaSecciones?: { id: string; label: string }[];
  onInsert: (s: string) => void;
  onBack: () => void;
}) {
  const init = parseSnippetRaw(initialRaw);
  const initCond = init?.kind === "condicion" ? init : null;

  const [tipo, setTipo] = useState<"item" | "flag">(initCond?.tipo ?? "item");

  // tipo "item"
  const [item, setItem] = useState<{ id: string; nombre: string } | null>(
    initCond?.tipo === "item" && initCond.clave
      ? { id: initCond.clave, nombre: initCond.clave }
      : null,
  );
  const [items, setItems] = useState<{ id: string; nombre: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // tipo "flag"
  const [flagId, setFlagId] = useState(
    initCond?.tipo === "flag" ? (initCond.clave ?? "") : "",
  );
  const [valorEsperado, setValorEsperado] = useState(
    initCond?.tipo === "flag" ? (initCond.valorEsperado ?? "") : "",
  );

  // común a ambos tipos
  const [siTexto, setSiTexto] = useState(initCond?.siTexto ?? "");
  const [noTexto, setNoTexto] = useState(initCond?.noTexto ?? "");
  const [siTarget, setSiTarget] = useState(initCond?.siTarget ?? "");
  const [noTarget, setNoTarget] = useState(initCond?.noTarget ?? "");

  useEffect(() => {
    scrollActiveIntoView(listRef.current, active);
  }, [active]);

  useEffect(() => {
    void fetchEntidades("item")
      .then((d) => {
        if (d.ok) {
          const fetched = (d.data?.items ?? []).map((x: any) => ({
            id: x.id,
            nombre: x.nombre,
          }));
          setItems(fetched);
          // Si veníamos con un item ya seleccionado por id (edición de una
          // condición existente), completamos su nombre real apenas llega la lista.
          setItem((prev) =>
            prev
              ? (fetched.find((f: any) => f.id === prev.id) ?? prev)
              : prev,
          );
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(
    () => items.filter((i) => i.nombre.toLowerCase().includes(q.toLowerCase())),
    [items, q],
  );

  const buildBranch = (texto: string, target: string) =>
    target.trim() ? `${texto.trim()}\n-> ${target.trim()}` : texto.trim();

  const clave = tipo === "item" ? (item?.id ?? "") : flagId.trim();
  const claveLista =
    tipo === "item" ? !!item : !!flagId.trim() && !!valorEsperado.trim();

  const snippet =
    claveLista && siTexto.trim()
      ? `[[condicion|${tipo}|${clave}|${tipo === "flag" ? valorEsperado.trim() : ""}|\n${buildBranch(
          siTexto,
          siTarget,
        )}${
          noTexto.trim() || noTarget.trim()
            ? `\n===\n${buildBranch(noTexto, noTarget)}`
            : ""
        }\n]]`
      : "";

  const SeccionSelect = ({
    value,
    onChange,
    placeholder,
  }: {
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
  }) =>
    listaSecciones.length > 0 ? (
      <select
        style={{ ...S.fieldInput, cursor: "pointer" }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{placeholder}</option>
        {listaSecciones.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label || s.id}
          </option>
        ))}
      </select>
    ) : (
      <input
        placeholder={placeholder}
        style={S.fieldInput}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );

  return (
    <>
      <FormHeader Icon={DoorOpen} label="Condición" onBack={onBack} />
      <div
        style={{
          padding: "10px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          maxHeight: 380,
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", gap: 6 }}>
          <button
            style={{
              ...S.insertBtn(tipo === "item" ? "#e09a2a" : "transparent"),
              flex: 1,
              color:
                tipo === "item"
                  ? "#fff"
                  : "color-mix(in srgb,var(--foreground) 55%,transparent)",
              opacity: 1,
            }}
            onClick={() => setTipo("item")}
          >
            ¿Tiene ítem?
          </button>
          <button
            style={{
              ...S.insertBtn(tipo === "flag" ? "#e09a2a" : "transparent"),
              flex: 1,
              color:
                tipo === "flag"
                  ? "#fff"
                  : "color-mix(in srgb,var(--foreground) 55%,transparent)",
              opacity: 1,
            }}
            onClick={() => setTipo("flag")}
          >
            ¿Flag == valor?
          </button>
        </div>

        {tipo === "item" ? (
          !item ? (
            <div>
              <div style={S.fieldLabel}>Ítem condición</div>
              <input
                autoFocus
                placeholder="Buscar ítem…"
                style={S.fieldInput}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setActive(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActive((v) => Math.min(v + 1, filtered.length - 1));
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActive((v) => Math.max(v - 1, 0));
                  }
                  if (e.key === "Enter" && filtered[active])
                    setItem(filtered[active]);
                }}
              />
              <div
                ref={listRef}
                style={{ maxHeight: 140, overflowY: "auto", marginTop: 4 }}
              >
                {loading && <div style={S.empty}>Cargando…</div>}
                {filtered.map((it, i) => (
                  <div
                    key={it.id}
                    data-idx={i}
                    style={S.row(i === active)}
                    onClick={() => setItem(it)}
                    onMouseEnter={() => setActive(i)}
                  >
                    <span style={S.iconBox()}><DoorOpen size={11} /></span>
                    <span style={S.label}>{it.nombre}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={S.selectedPill()}>
              <span style={S.iconBox()}><DoorOpen size={11} /></span>
              <span style={{ ...S.label, flex: 1 }}>{item.nombre}</span>
              <button
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "color-mix(in srgb,var(--foreground) 35%,transparent)",
                  fontSize: 14,
                }}
                onClick={() => setItem(null)}
              >
                ✕
              </button>
            </div>
          )
        ) : (
          <>
            <div>
              <div style={S.fieldLabel}>Id del flag</div>
              <input
                autoFocus
                placeholder="ej: conoce-secreto, reputacion-reino"
                style={S.fieldInput}
                value={flagId}
                onChange={(e) => setFlagId(e.target.value)}
              />
            </div>
            <div>
              <div style={S.fieldLabel}>Valor esperado</div>
              <input
                placeholder='ej: true, "hostil"…'
                style={S.fieldInput}
                value={valorEsperado}
                onChange={(e) => setValorEsperado(e.target.value)}
              />
            </div>
          </>
        )}

        <div>
          <div style={S.fieldLabel}>
            {tipo === "item" ? "Texto si TIENE el ítem *" : "Texto si COINCIDE *"}
          </div>
          <textarea
            placeholder="El personaje usa el objeto…"
            rows={3}
            style={{
              ...S.fieldInput,
              resize: "none" as const,
              fontFamily: "inherit",
            }}
            value={siTexto}
            onChange={(e) => setSiTexto(e.target.value)}
          />
        </div>
        <div>
          <div style={S.fieldLabel}>
            {tipo === "item"
              ? "Sección destino si TIENE (opcional)"
              : "Sección destino si COINCIDE (opcional)"}
          </div>
          <SeccionSelect
            placeholder="— continúa inline, sin salto —"
            value={siTarget}
            onChange={setSiTarget}
          />
        </div>
        <div>
          <div style={S.fieldLabel}>
            {tipo === "item"
              ? "Texto si NO tiene (opcional)"
              : 'Texto si NO coincide (opcional, incluye "nunca se seteó")'}
          </div>
          <textarea
            placeholder="No tenés ese ítem…"
            rows={2}
            style={{
              ...S.fieldInput,
              resize: "none" as const,
              fontFamily: "inherit",
            }}
            value={noTexto}
            onChange={(e) => setNoTexto(e.target.value)}
          />
        </div>
        <div>
          <div style={S.fieldLabel}>
            {tipo === "item"
              ? "Sección destino si NO tiene (opcional)"
              : "Sección destino si NO coincide (opcional)"}
          </div>
          <SeccionSelect
            placeholder="— continúa inline, sin salto —"
            value={noTarget}
            onChange={setNoTarget}
          />
        </div>
        <button
          disabled={!snippet}
          style={S.insertBtn("#e09a2a")}
          onClick={() => snippet && onInsert(snippet)}
        >
          <DoorOpen size={12} /> Insertar Condición
        </button>
      </div>
    </>
  );
}

// ── Form Flag (Acción) ──────────────────────────────────────────────────────
// Ya no tiene modo "if" — eso vive en FormCondicion ahora. Este form solo
// escribe flagId=valor sin ramas ni navegación.

function FormFlag({
  initialRaw,
  onInsert,
  onBack,
}: {
  initialRaw?: string;
  onInsert: (s: string) => void;
  onBack: () => void;
}) {
  const init = parseSnippetRaw(initialRaw);
  const initSet = init?.kind === "flag-set" ? init : null;

  const [flagId, setFlagId] = useState(initSet?.flagId ?? "");
  const [valor, setValor] = useState(initSet?.valor ?? "");

  const snippet =
    flagId.trim() && valor.trim()
      ? `[[flag|set|${flagId.trim()}|${valor.trim()}]]`
      : "";

  return (
    <>
      <FormHeader Icon={Flag} label="Acción" onBack={onBack} />
      <div
        style={{
          padding: "10px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          maxHeight: 380,
          overflowY: "auto",
        }}
      >
        <div>
          <div style={S.fieldLabel}>Id del flag</div>
          <input
            autoFocus
            placeholder="ej: conoce-secreto, reputacion-reino"
            style={S.fieldInput}
            value={flagId}
            onChange={(e) => setFlagId(e.target.value)}
          />
        </div>
        <div>
          <div style={S.fieldLabel}>Valor a guardar</div>
          <input
            placeholder='ej: true, false, "hostil"…'
            style={S.fieldInput}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
          />
        </div>

        <button
          disabled={!snippet}
          style={S.insertBtn("#5b8def")}
          onClick={() => snippet && onInsert(snippet)}
        >
          <Flag size={12} /> Insertar Acción
        </button>
      </div>
    </>
  );
}

// ── Form Imagen ───────────────────────────────────────────────────────────────

function FormImagen({
  initialRaw,
  onInsert,
  onBack,
  query,
}: {
  initialRaw?: string;
  onInsert: (s: string) => void;
  onBack: () => void;
  query?: string;
}) {
  const init = parseSnippetRaw(initialRaw);
  const [all, setAll] = useState<{ name: string; url: string; path: string }[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState(query ?? "");
  const [selected, setSelected] = useState<string | null>(
    (init as any)?.url ?? null,
  );
  const [caption, setCaption] = useState((init as any)?.alt ?? "");
  const [mode, setMode] = useState<"img" | "float">(
    (init as any)?.float ? "float" : "img",
  );
  const [word, setWord] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollActiveIntoView(listRef.current, active);
  }, [active]);

  useEffect(() => {
    void fetch("/dibujos-index.json")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setAll(flattenTree(d.tree));
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  useEffect(() => {
    setActive(0);
  }, [q]);

  const filtered = useMemo(
    () =>
      q
        ? all.filter(
            (f) =>
              f.name.toLowerCase().includes(q.toLowerCase()) ||
              f.path.toLowerCase().includes(q.toLowerCase()),
          )
        : all,
    [all, q],
  );

  const snippet = selected
    ? mode === "img"
      ? caption
        ? `[[img|${selected}|${caption}]]`
        : `[[img|${selected}]]`
      : `[[float|${word.trim() || "imagen"}|${selected}${caption ? `|${caption}` : ""}]]`
    : "";

  return (
    <>
      <FormHeader Icon={ImageIcon} label="Imagen" onBack={onBack} />
      <div
        style={{
          padding: "10px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          maxHeight: 400,
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", gap: 6 }}>
          {(["img", "float"] as const).map((m) => (
            <button
              key={m}
              style={{
                flex: 1,
                padding: "6px",
                borderRadius: 7,
                cursor: "pointer",
                border: `1px solid color-mix(in srgb, var(--foreground, #fff) ${mode === m ? 30 : 10}%, transparent)`,
                fontSize: 10,
                fontWeight: 800,
                textTransform: "uppercase" as const,
                background:
                  mode === m
                    ? "color-mix(in srgb, var(--foreground, #fff) 8%, transparent)"
                    : "none",
                color:
                  mode === m
                    ? "var(--foreground, #fff)"
                    : "color-mix(in srgb,var(--foreground) 35%,transparent)",
              }}
              onClick={() => setMode(m)}
            >
              {m === "img" ? "Inline" : "Flotante"}
            </button>
          ))}
        </div>
        <div>
          <div style={S.fieldLabel}>Buscar imagen</div>
          <input
            ref={inputRef}
            placeholder="Nombre de archivo…"
            style={S.fieldInput}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((v) => Math.min(v + 1, filtered.length - 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((v) => Math.max(v - 1, 0));
              }
              if (e.key === "Enter" && filtered[active])
                setSelected(filtered[active].url);
            }}
          />
        </div>
        {!selected ? (
          <div ref={listRef} style={{ maxHeight: 180, overflowY: "auto" }}>
            {loading && <div style={S.empty}>Cargando…</div>}
            {!loading && filtered.length === 0 && (
              <div style={S.empty}>Sin resultados</div>
            )}
            {filtered.map((f, i) => (
              <div
                key={f.url}
                data-idx={i}
                style={S.row(i === active)}
                onClick={() => setSelected(f.url)}
                onMouseEnter={() => setActive(i)}
              >
                <Image
                  alt={f.name}
                  src={f.url}
                  style={{
                    width: 32,
                    height: 32,
                    objectFit: "cover",
                    borderRadius: 5,
                    flexShrink: 0,
                    border:
                      "1px solid color-mix(in srgb,var(--foreground) 10%,transparent)",
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={S.label}>{f.name}</div>
                  <div style={S.sublabel}>{f.path}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={S.selectedPill()}>
            <Image
              alt=""
              src={selected}
              style={{
                width: 36,
                height: 36,
                objectFit: "cover",
                borderRadius: 6,
                flexShrink: 0,
              }}
            />
            <span style={{ ...S.label, flex: 1, fontSize: 11 }}>
              {selected.split("/").pop()}
            </span>
            <button
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "color-mix(in srgb,var(--foreground) 35%,transparent)",
                fontSize: 14,
              }}
              onClick={() => setSelected(null)}
            >
              ✕
            </button>
          </div>
        )}
        {selected && mode === "float" && (
          <div>
            <div style={S.fieldLabel}>Palabra en el texto</div>
            <input
              placeholder="ej: el castillo…"
              style={S.fieldInput}
              value={word}
              onChange={(e) => setWord(e.target.value)}
            />
          </div>
        )}
        {selected && (
          <div>
            <div style={S.fieldLabel}>Caption (opcional)</div>
            <input
              placeholder="Descripción…"
              style={S.fieldInput}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
          </div>
        )}
        <button
          disabled={!snippet}
          style={S.insertBtn("#2dc896")}
          onClick={() => snippet && onInsert(snippet)}
        >
          <ImageIcon size={12} /> Insertar Imagen
        </button>
      </div>
    </>
  );
}

// ── Form Sound ────────────────────────────────────────────────────────────────

function FormSound({
  onInsert,
  onBack,
  query,
}: {
  onInsert: (s: string) => void;
  onBack: () => void;
  query?: string;
}) {
  const [all, setAll] = useState<{ name: string; url: string; path: string }[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState(query ?? "");
  const [selected, setSelected] = useState<string | null>(null);
  const [volume, setVolume] = useState(0.5);
  const [playing, setPlaying] = useState(false);
  const [active, setActive] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollActiveIntoView(listRef.current, active);
  }, [active]);

  useEffect(() => {
    void fetch("/sonidos-index.json")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setAll(flattenTree(d.tree));
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  useEffect(() => {
    setActive(0);
  }, [q]);
  useEffect(
    () => () => {
      audioRef.current?.pause();
    },
    [],
  );

  const filtered = useMemo(
    () =>
      q
        ? all.filter(
            (f) =>
              f.name.toLowerCase().includes(q.toLowerCase()) ||
              f.path.toLowerCase().includes(q.toLowerCase()),
          )
        : all,
    [all, q],
  );

  const togglePlay = (url: string) => {
    if (!audioRef.current) audioRef.current = new Audio();
    if (selected === url && playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.src = url;
      audioRef.current.volume = volume;
      void audioRef.current.play();
      setPlaying(true);
      setSelected(url);
    }
  };

  return (
    <>
      <FormHeader Icon={Music2} label="Sonido" onBack={onBack} />
      <div
        style={{
          padding: "10px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          maxHeight: 380,
          overflowY: "auto",
        }}
      >
        <div>
          <div style={S.fieldLabel}>Buscar sonido</div>
          <input
            ref={inputRef}
            placeholder="Nombre del archivo…"
            style={S.fieldInput}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((v) => Math.min(v + 1, filtered.length - 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((v) => Math.max(v - 1, 0));
              }
              if (e.key === "Enter" && filtered[active])
                setSelected(filtered[active].url);
            }}
          />
        </div>
        <div ref={listRef} style={{ maxHeight: 180, overflowY: "auto" }}>
          {loading && <div style={S.empty}>Cargando…</div>}
          {!loading && filtered.length === 0 && (
            <div style={S.empty}>Sin resultados</div>
          )}
          {filtered.map((f, i) => (
            <div
              key={f.url}
              data-idx={i}
              style={{
                ...S.row(i === active || selected === f.url),
                border:
                  selected === f.url
                    ? "1px solid color-mix(in srgb, var(--foreground, #fff) 30%, transparent)"
                    : "1px solid transparent",
                borderRadius: 6,
                marginBottom: 2,
              }}
              onClick={() => setSelected(f.url)}
              onMouseEnter={() => setActive(i)}
            >
              <button
                style={{
                  ...S.iconBox(),
                  cursor: "pointer",
                  border: "none",
                  flexShrink: 0,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlay(f.url);
                }}
              >
                {selected === f.url && playing ? "⏸" : "▶"}
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={S.label}>{f.name}</div>
                <div style={S.sublabel}>{f.path}</div>
              </div>
              {selected === f.url && <span style={S.kbd}>✓</span>}
            </div>
          ))}
        </div>
        {selected && (
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <div style={S.fieldLabel}>Volumen</div>
              <div style={S.sublabel}>{Math.round(volume * 100)}%</div>
            </div>
            <input
              max="1"
              min="0"
              step="0.1"
              style={{
                width: "100%",
                accentColor: "var(--foreground, #7c7c7c)",
                cursor: "pointer",
              }}
              type="range"
              value={volume}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                setVolume(v);
                if (audioRef.current) audioRef.current.volume = v;
              }}
            />
          </div>
        )}
        <button
          disabled={!selected}
          style={S.insertBtn("#e87aaa")}
          onClick={() =>
            selected && onInsert(`[[sound|${selected}|${volume.toFixed(1)}]]`)
          }
        >
          <Music2 size={12} /> Insertar Sonido
        </button>
      </div>
    </>
  );
}

// ── Paleta principal ──────────────────────────────────────────────────────────

export function SnippetCommandPalette({
  anchorRect,
  initialRaw,
  initialQuery = "",
  listaCapitulos: _listaCapitulos = [],
  listaSecciones = [],
  onInsert,
  onFormatCommand,
  onClose,
}: PaletteProps) {
  const [q, setQ] = useState(initialQuery);
  const [activeIdx, setActiveIdx] = useState(0);
  const [selectedType, setSelectedType] = useState<SnippetType | null>(() => {
    if (!initialRaw) return null;
    const kind = initialRaw.slice(2, -2).split("|")[0].trim();
    // Legacy: [[flag|if|...]] editaba antes en el mismo form que
    // [[flag|set|...]] — ahora "if" vive en Condición, "set" en Acción.
    if (kind === "flag" && initialRaw.startsWith("[[flag|if|")) {
      return "condicion";
    }
    const map: Record<string, SnippetType> = {
      drop: "drop",
      img: "imagen",
      float: "imagen",
      choice: "choice",
      use: "use",
      condicion: "condicion",
      gate: "condicion", // legacy — se migra al editar
      flag: "flag",
      section: "section",
      sound: "sound",
      epigrafe: "epigrafe",
    };
    return map[kind] ?? null;
  });
  const [childQuery, setChildQuery] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const catListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollActiveIntoView(catListRef.current, activeIdx);
  }, [activeIdx]);

  // Posición del popover: arranca pegado al cursor (anchorRect ya viene
  // como la base del caret, ver SlashCommandPlugin) y se recalcula contra
  // el tamaño REAL renderizado — no un alto fijo — porque el contenido
  // cambia mucho entre el paso 1 (lista corta) y cada formulario del
  // paso 2 (algunos con lista de entidades, imágenes, etc.), así que un
  // "maxH" fijo terminaba cortando el popover o dejándolo muy lejos del
  // cursor cuando el contenido real era más chico o más grande.
  const [computedPos, setComputedPos] = useState(() => ({
    top: anchorRect.top + 8,
    left: anchorRect.left,
  }));

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const margin = 8;
    const gap = 8; // separación respecto al cursor/anchor

    const recompute = () => {
      const W = window.innerWidth;
      const H = window.innerHeight;
      const rect = el.getBoundingClientRect();
      const w = rect.width || 300;
      const h = rect.height || 200;

      let left = anchorRect.left;
      if (left + w > W - margin) left = W - w - margin;
      if (left < margin) left = margin;

      const spaceBelow = H - anchorRect.top - gap;
      const spaceAbove = anchorRect.top - gap;
      let top: number;
      if (h <= spaceBelow || spaceBelow >= spaceAbove) {
        // Preferimos abajo del cursor (como un autocomplete normal); si
        // no entra completo igual lo clampeamos contra el borde inferior
        // en vez de dejarlo salir de la pantalla.
        top = anchorRect.top + gap;
        if (top + h > H - margin) top = Math.max(margin, H - h - margin);
      } else {
        // No entra abajo pero sí (mejor) arriba del cursor.
        top = anchorRect.top - h - gap;
        if (top < margin) top = margin;
      }
      setComputedPos({ top, left });
    };

    recompute();
    // El contenido cambia de alto de forma asincrónica (fetch de
    // entidades, imágenes cargando, cambio de formulario) — un
    // ResizeObserver mantiene la posición correcta sin tener que listar
    // a mano cada dependencia que afecta el alto.
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [anchorRect]);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      )
        onClose();
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [onClose]);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedType) {
          setSelectedType(null);
          setQ("");
          setChildQuery("");
        } else onClose();
      }
    };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [onClose, selectedType]);

  useEffect(() => {
    if (!selectedType) setTimeout(() => inputRef.current?.focus(), 30);
  }, [selectedType]);

  // Detectar "imagen castillo" → matchedCat=imagen, searchQ=castillo
  const { matchedCat, searchQ } = useMemo(() => {
    const lower = q.toLowerCase().trim();
    for (const cat of CATS) {
      for (const kw of cat.keywords) {
        if (lower === kw || lower.startsWith(kw + " ")) {
          return {
            matchedCat: cat.id as SnippetType,
            searchQ: lower.slice(kw.length).trim(),
          };
        }
      }
    }
    return { matchedCat: null as SnippetType | null, searchQ: lower };
  }, [q]);

  const filteredCats = useMemo(() => {
    if (!searchQ && !matchedCat) return CATS;
    if (matchedCat) return CATS.filter((c) => c.id === matchedCat);
    return CATS.filter(
      (c) =>
        c.keywords.some((k) => k.includes(searchQ)) ||
        c.label.toLowerCase().includes(searchQ),
    );
  }, [matchedCat, searchQ]);

  useEffect(() => {
    setActiveIdx(0);
  }, [q]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((v) => Math.min(v + 1, filteredCats.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((v) => Math.max(v - 1, 0));
    }
    if (e.key === "Enter" && filteredCats[activeIdx]) {
      e.preventDefault();
      setChildQuery(searchQ);
      setSelectedType(filteredCats[activeIdx].id);
    }
  };

  const handleInsert = useCallback(
    (raw: string) => {
      onInsert(raw);
      onClose();
    },
    [onInsert, onClose],
  );
  const handleBack = useCallback(() => {
    setSelectedType(null);
    setQ("");
    setChildQuery("");
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        ...S.popover,
        top: computedPos.top,
        left: computedPos.left,
        maxHeight: "calc(100vh - 16px)",
        overflowY: "auto",
      }}
    >
      {!selectedType && (
        <>
          <div style={S.header}>
            <Search
              color="color-mix(in srgb, var(--foreground, #fff) 35%, transparent)"
              size={14}
            />
            <input
              ref={inputRef}
              placeholder="drop espada · imagen castillo · sonido lluvia…"
              style={S.mainInput}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setActiveIdx(0);
              }}
              onKeyDown={handleKeyDown}
            />
            <span style={S.kbd}>esc</span>
          </div>

          <div ref={catListRef} style={S.list}>
            {filteredCats.length === 0 && (
              <div style={S.empty}>Sin resultados</div>
            )}
            {(["narrativa", "media", "estructura"] as const).map((group) => {
              const itemsInGroup = filteredCats.filter(
                (c) => c.group === group,
              );
              if (itemsInGroup.length === 0) return null;
              return (
                <div key={group}>
                  <div style={S.groupLabel}>{GROUP_LABELS[group]}</div>
                  {itemsInGroup.map((cat) => {
                    const i = filteredCats.indexOf(cat);
                    return (
                      <div
                        key={cat.id}
                        data-idx={i}
                        style={S.row(i === activeIdx)}
                        onClick={() => {
                          // directAction: inserta/aplica y cierra directo,
                          // sin abrir el formulario paso 2 (ver CATS).
                          if (cat.directAction) {
                            if (cat.directAction.insert !== undefined) {
                              onInsert(cat.directAction.insert);
                            }
                            if (cat.directAction.formatCommand) {
                              onFormatCommand?.(cat.directAction.formatCommand);
                            }
                            onClose();
                            return;
                          }
                          setChildQuery(searchQ);
                          setSelectedType(cat.id);
                        }}
                        onMouseEnter={() => setActiveIdx(i)}
                      >
                        <span style={S.iconBox()}>
                          <cat.Icon size={14} />
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={S.label}>{cat.label}</div>
                          {searchQ && (
                            <div style={S.sublabel}>buscar «{searchQ}»</div>
                          )}
                        </div>
                        {i === activeIdx && <span style={S.kbd}>↵</span>}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          <div
            style={{
              padding: "6px 12px 8px",
              borderTop:
                "0.5px solid color-mix(in srgb,var(--foreground) 6%,transparent)",
            }}
          >
            <span style={{ ...S.sublabel, fontSize: 8, opacity: 0.7 }}>
              tipo + nombre · ej:{" "}
              <em style={{ fontStyle: "normal" }}>imagen castillo</em>
            </span>
          </div>
        </>
      )}

      {selectedType === "drop" && (
        <FormDrop
          initialRaw={initialRaw}
          query={childQuery}
          onBack={handleBack}
          onInsert={handleInsert}
        />
      )}
      {selectedType === "dialogo" && (
        <FormDialogo
          initialRaw={initialRaw}
          query={childQuery}
          onBack={handleBack}
          onInsert={handleInsert}
        />
      )}
      {selectedType === "choice" && (
        <FormChoice
          initialRaw={initialRaw}
          listaSecciones={listaSecciones}
          onBack={handleBack}
          onInsert={handleInsert}
        />
      )}
      {selectedType === "section" && (
        <FormSection
          initialRaw={initialRaw}
          onBack={handleBack}
          onInsert={handleInsert}
        />
      )}
      {selectedType === "epigrafe" && (
        <FormEpigrafe
          initialRaw={initialRaw}
          onBack={handleBack}
          onInsert={handleInsert}
        />
      )}
      {selectedType === "nota" && (
        <FormNota
          initialRaw={initialRaw}
          onBack={handleBack}
          onInsert={handleInsert}
        />
      )}
      {selectedType === "use" && (
        <FormUse
          initialRaw={initialRaw}
          listaSecciones={listaSecciones}
          onBack={handleBack}
          onInsert={handleInsert}
        />
      )}
      {selectedType === "condicion" && (
        <FormCondicion
          initialRaw={initialRaw}
          listaSecciones={listaSecciones}
          onBack={handleBack}
          onInsert={handleInsert}
        />
      )}
      {selectedType === "flag" && (
        <FormFlag
          initialRaw={initialRaw}
          onBack={handleBack}
          onInsert={handleInsert}
        />
      )}
      {selectedType === "imagen" && (
        <FormImagen
          initialRaw={initialRaw}
          query={childQuery}
          onBack={handleBack}
          onInsert={handleInsert}
        />
      )}
      {selectedType === "sound" && (
        <FormSound
          query={childQuery}
          onBack={handleBack}
          onInsert={handleInsert}
        />
      )}
    </div>
  );
}
