"use client";

/**
 * LibroDocumentoSection
 * ───────────────────────────────────────────────────────────────────────────
 * "Documento completo" de un libro — todos sus capítulos en un solo
 * markdown editable (# Título del libro / ## Capítulo <!--cap:id--> /
 * contenido). Análogo a LineaTiempoSection + HistoriaCompletaPanel, pero
 * para libros en vez de la línea de tiempo del mundo.
 *
 * A pedido: esta vista vive FUERA de EstudioCapitulos — se abre como su
 * propia pestaña en EntityTabBar (openEntity("capitulos", libroId), ver el
 * botón en SidebarLibros dentro de EditorCapitulos.tsx) y ocupa toda la
 * pantalla disponible. Nada de sidebar de libros, nada del editor de
 * capítulos alrededor — solo header mínimo + el bloque RichEditor.
 *
 * Guardado: igual mecanismo que HistoriaCompletaPanel — autosave con
 * debounce, diffea contra el snapshot original y solo llama
 * capUpdateMeta/capUpdateContenido para los capítulos que realmente
 * cambiaron. El id embebido en cada "## Título <!--cap:id-->" es lo que
 * permite renombrar sin perder el vínculo al capítulo real.
 */

import { BookOpen, Loader2, X } from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { RichEditor } from "@/editor/lexical";
import type { Libro, Capitulo } from "@/editor/lexical/types";
import { capUpdateContenido, capUpdateMeta } from "@/editor/lexical/types";
import { SaveIndicator } from "@/layout/EstudioTemplates";
import { useMundoNavigation } from "@/domains/garlia/_shared/useMundoNavigationStore";
import { isReallyOnline } from "@/infra/sync/useOfflineSync";
import { useSupabaseData } from "@/infra/sync/useSupabaseData";
import { db } from "@/infra/supabase/db";
import { supabase } from "@/infra/supabase/supabase";

// ── Generación del markdown ──────────────────────────────────────────────
function generarMarkdownLibro(libro: Libro, capitulos: Capitulo[]): string {
  const ordenados = [...capitulos].sort((a, b) => a.orden - b.orden);
  if (ordenados.length === 0) {
    return `# ${libro.titulo}\n\n_Este libro todavía no tiene capítulos._`;
  }

  const lineas: string[] = [`# ${libro.titulo}`];
  for (const cap of ordenados) {
    lineas.push(`## ${cap.titulo_capitulo} <!--cap:${cap.id}-->`);
    const cuerpo = (cap.contenido ?? "").trim();
    if (cuerpo) lineas.push(cuerpo);
  }
  return lineas.join("\n\n");
}

// ── Parser del documento editado ─────────────────────────────────────────
interface BloqueCapEditado {
  id: string;
  titulo: string;
  contenido: string;
}

interface ParseResultadoLibro {
  bloques: BloqueCapEditado[];
  avisos: string[];
}

function parsearMarkdownLibro(markdown: string): ParseResultadoLibro {
  const bloques: BloqueCapEditado[] = [];
  const avisos: string[] = [];
  const lineasCrudas = markdown.split("\n");

  let bloqueActivo: {
    id: string | null;
    tituloCrudo: string;
    cuerpo: string[];
  } | null = null;

  const cerrarBloque = () => {
    if (!bloqueActivo) return;
    if (bloqueActivo.id) {
      bloques.push({
        id: bloqueActivo.id,
        titulo: bloqueActivo.tituloCrudo.trim(),
        contenido: bloqueActivo.cuerpo.join("\n\n").trim(),
      });
    } else {
      avisos.push(
        `No se pudo identificar el capítulo "${bloqueActivo.tituloCrudo.trim() || "(sin título)"}" — puede que se haya borrado su marcador oculto. Este cambio no se guardará.`,
      );
    }
    bloqueActivo = null;
  };

  for (const lineaCruda of lineasCrudas) {
    const linea = lineaCruda.trim();

    if (linea.startsWith("# ") && !linea.startsWith("## ")) {
      // H1 (título del libro) — cierra el bloque anterior, no editable acá.
      cerrarBloque();
      continue;
    }

    if (linea.startsWith("## ")) {
      cerrarBloque();
      const contenido = linea.slice(3);
      const idMatch = contenido.match(/<!--cap:([a-zA-Z0-9-]+)-->\s*$/);
      const tituloCrudo = contenido
        .replace(/<!--cap:[a-zA-Z0-9-]+-->\s*$/, "")
        .trim();
      bloqueActivo = {
        id: idMatch ? idMatch[1] : null,
        tituloCrudo,
        cuerpo: [],
      };
      continue;
    }

    if (linea === "") continue;

    if (bloqueActivo) {
      bloqueActivo.cuerpo.push(lineaCruda);
    } else {
      avisos.push(
        `Línea fuera de cualquier capítulo, se ignorará: "${linea.slice(0, 60)}${linea.length > 60 ? "…" : ""}"`,
      );
    }
  }
  cerrarBloque();

  return { bloques, avisos };
}

// ── Carga de capítulos de un libro (Dexie primero, Supabase después) ────
// Misma estrategia que cargarCapsLibro en EditorCapitulos.tsx, simplificada:
// esta vista solo necesita los capítulos de UN libro puntual, no un mapa
// libroId → caps para toda la sidebar.
function useCapitulosDeLibro(libroId: string) {
  const [capitulos, setCapitulos] = useState<Capitulo[]>([]);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    setLoading(true);
    let local: Capitulo[] = [];
    try {
      if (db) {
        const rows = await (db as any).capitulos
          .where("libro_id")
          .equals(libroId)
          .toArray();
        local = (rows as any[])
          .filter((c) => !c.deleted)
          .sort((a, b) => a.orden - b.orden) as Capitulo[];
      }
    } catch {}
    if (local.length > 0) setCapitulos(local);

    try {
      const online = await isReallyOnline();
      if (!online) {
        setCapitulos((prev) => (prev.length > 0 ? prev : local));
        return;
      }
      const { data, error } = await supabase
        .from("capitulos")
        .select("*")
        .eq("libro_id", libroId)
        .order("orden", { ascending: true });
      if (error) return;
      setCapitulos((data ?? []) as Capitulo[]);
    } finally {
      setLoading(false);
    }
  }, [libroId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return { capitulos, setCapitulos, loading };
}

export function LibroDocumentoSection() {
  const libroId = useMundoNavigation((s) => s.selectedId);
  const closeTab = useMundoNavigation((s) => s.closeTab);
  const { data: libros, loading: loadingLibros } = useSupabaseData<Libro>(
    "libros",
    { isAdmin: true, lite: true },
  );
  const libro = libros.find((l) => l.id === libroId);
  const { capitulos, setCapitulos, loading: loadingCaps } =
    useCapitulosDeLibro(libroId ?? "");

  if (!libroId) return null;

  if (loadingLibros || (loadingCaps && capitulos.length === 0) || !libro) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center text-primary/20">
        <Loader2 className="animate-spin" size={20} />
      </div>
    );
  }

  return (
    <LibroDocumentoEditor
      libro={libro}
      capitulos={capitulos}
      onClose={() => closeTab("capitulos", libro.id)}
      onCapChange={(id, fields) => {
        setCapitulos((prev) =>
          prev.map((c) => (c.id === id ? { ...c, ...fields } : c)),
        );
      }}
    />
  );
}

function LibroDocumentoEditor({
  libro,
  capitulos,
  onClose,
  onCapChange,
}: {
  libro: Libro;
  capitulos: Capitulo[];
  onClose: () => void;
  onCapChange: (id: string, fields: Partial<Capitulo>) => void;
}) {
  const markdown = useMemo(
    () => generarMarkdownLibro(libro, capitulos),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [libro.id],
  );
  const [valor, setValor] = useState(markdown);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [estado, setEstado] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resincroniza solo la primera vez que llegan capítulos reales (evita
  // pisar lo que el usuario está escribiendo en cada render).
  const inicializadoRef = useRef(false);
  useEffect(() => {
    if (!inicializadoRef.current && capitulos.length > 0) {
      inicializadoRef.current = true;
      setValor(generarMarkdownLibro(libro, capitulos));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capitulos.length]);

  // Snapshot original indexado por id — para diffear solo lo que cambió.
  const indiceOriginal = useMemo(() => {
    const m = new Map<string, Capitulo>();
    for (const c of capitulos) m.set(c.id, c);
    return m;
  }, [capitulos]);

  const guardar = useCallback(
    async (texto: string) => {
      const { bloques, avisos: avisosParse } = parsearMarkdownLibro(texto);
      setAvisos(avisosParse);

      const cambios: Array<() => Promise<void>> = [];

      for (const b of bloques) {
        const original = indiceOriginal.get(b.id);
        if (!original) continue; // id desconocido (capítulo borrado en otra pestaña, etc.)

        if (b.titulo && b.titulo !== (original.titulo_capitulo?.trim() || "")) {
          cambios.push(async () => {
            await capUpdateMeta(b.id, { titulo_capitulo: b.titulo });
            onCapChange(b.id, { titulo_capitulo: b.titulo });
          });
        }
        if (b.contenido !== (original.contenido ?? "").trim()) {
          cambios.push(async () => {
            await capUpdateContenido(b.id, b.contenido);
            onCapChange(b.id, { contenido: b.contenido });
          });
        }
      }

      if (cambios.length === 0) {
        setEstado("idle");
        return;
      }

      setEstado("saving");
      try {
        for (const c of cambios) await c();
        setEstado("saved");
        setTimeout(() => setEstado((s) => (s === "saved" ? "idle" : s)), 2000);
      } catch {
        setEstado("error");
      }
    },
    [indiceOriginal, onCapChange],
  );

  const handleChange = useCallback(
    (nuevoTexto: string) => {
      setValor(nuevoTexto);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void guardar(nuevoTexto);
      }, 1200);
    },
    [guardar],
  );

  // Ctrl+S fuerza guardado inmediato, saltándose el debounce.
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
          debounceRef.current = null;
        }
        void guardar(valor);
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [guardar, valor]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* Header — mínimo, sin sidebar ni nada del editor de capítulos */}
      <div
        className="shrink-0 flex items-center justify-between px-4 py-3 border-b"
        style={{
          borderColor: "color-mix(in srgb, var(--primary) 8%, transparent)",
        }}
      >
        <span
          className="flex items-center gap-1.5 text-micro font-black uppercase tracking-[0.2em]"
          style={{ color: "var(--primary)" }}
        >
          <BookOpen size={11} />
          {libro.titulo} · documento completo
        </span>
        <div className="flex items-center gap-2">
          <SaveIndicator status={estado} />
          <button
            className="p-1 rounded hover:bg-primary/8 text-primary/30 hover:text-primary transition-all"
            title="Cerrar documento"
            type="button"
            onClick={onClose}
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Nota de alcance: qué es editable y qué no */}
      <div
        className="shrink-0 px-4 py-2 text-micro leading-relaxed border-b"
        style={{
          color: "color-mix(in srgb, var(--primary) 45%, transparent)",
          borderColor: "color-mix(in srgb, var(--primary) 8%, transparent)",
          background: "color-mix(in srgb, var(--primary) 3%, transparent)",
        }}
      >
        Editar el título o el cuerpo de un capítulo acá lo guarda en ese
        capítulo. No borres el <code>&lt;!--cap:...--&gt;</code> al final de
        un encabezado — se usa para saber qué capítulo actualizar. Los
        capítulos se muestran en su orden actual; para reordenarlos usa la
        barra lateral del editor de capítulos.
      </div>

      {/* Avisos de líneas/bloques no interpretables */}
      {avisos.length > 0 && (
        <div
          className="shrink-0 px-4 py-2 text-micro leading-relaxed border-b space-y-0.5"
          style={{
            color: "#b45309",
            borderColor: "color-mix(in srgb, var(--primary) 8%, transparent)",
            background: "color-mix(in srgb, #f59e0b 8%, transparent)",
          }}
        >
          {avisos.map((a, i) => (
            <div key={i}>⚠ {a}</div>
          ))}
        </div>
      )}

      {/* Solo el bloque RichEditor — pantalla completa, nada más alrededor */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
        <RichEditor
          editable
          minHeight={200}
          value={valor}
          onChange={handleChange}
        />
      </div>
    </div>
  );
}
