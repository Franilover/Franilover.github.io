"use client";
import {
  BookOpen, Search, X, ArrowRight, BookMarked,
  BookCheck, BookDashed, Library,
} from "lucide-react";
import React, { useMemo, useState } from "react";

import { MotionDiv } from "@/components/ui/Motion";
import { SeccionEntidad } from "@/components/ui/SeccionEntidad";

interface LibrosDashboardProps {
  ensayos: any[];
  onNavigate: (titulo: string) => void;
  onTagClick?: (tag: string) => void;
  onToggleEstado?: (libroId: string, estado: "leyendo" | "leido" | "pendiente", add: boolean) => void;
  onCrearLibro?: () => void;
}

type OrdenLibros = "reciente" | "titulo" | "palabras";

// ─── Hook sencillo para detectar móvil ───────────────────────────────────────
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );
  React.useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

// ─── Mini libro row para el panel lateral ────────────────────────────────────
function LibroRow({
  libro,
  onNavigate,
  serif,
  mono,
  formatRelative,
}: {
  libro: any;
  onNavigate: (t: string) => void;
  serif: React.CSSProperties;
  mono: React.CSSProperties;
  formatRelative: (d: string) => string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      className="w-full text-left"
      style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "7px 10px",
        background: hovered ? "color-mix(in srgb, var(--foreground) 4%, transparent)" : "transparent",
        border: "none", borderRadius: 5, cursor: "pointer",
        transition: "background 0.08s",
      }}
      onClick={() => onNavigate(libro.titulo)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          ...serif, fontSize: 11,
          color: "color-mix(in srgb, var(--foreground) 72%, transparent)",
          margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {libro.titulo || "Sin título"}
        </p>
        <span style={{ ...mono, fontSize: 8, color: "color-mix(in srgb, var(--foreground) 18%, transparent)" }}>
          {formatRelative(libro.updated_at)}
        </span>
      </div>
      <ArrowRight size={9} style={{ color: "color-mix(in srgb, var(--foreground) 18%, transparent)", flexShrink: 0, opacity: hovered ? 1 : 0, transition: "opacity 0.1s" }} />
    </button>
  );
}



// ─── Componente principal ─────────────────────────────────────────────────────
export function LibrosDashboard({ ensayos, onNavigate, onTagClick: _onTagClick, onToggleEstado, onCrearLibro }: LibrosDashboardProps) {
  const mono: React.CSSProperties = { fontFamily: "var(--font-mono)" };
  const serif: React.CSSProperties = { fontFamily: "var(--font-serif)", fontStyle: "italic" };
  const isMobile = useIsMobile();

  const [busqueda, setBusqueda] = useState("");
  const [orden, setOrden] = useState<OrdenLibros>("reciente");
  const [tagFiltro, setTagFiltro] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const libros = useMemo(
    () => ensayos.filter(e => e.tags?.includes("libro")),
    [ensayos]
  );

  const leyendo = useMemo(
    () => libros.filter(e => e.tags?.includes("leyendo"))
               .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    [libros]
  );
  const leidos = useMemo(
    () => libros.filter(e => e.tags?.includes("leido"))
               .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    [libros]
  );
  const pendientes = useMemo(
    () => libros.filter(e => e.tags?.includes("pendiente") && !e.tags?.includes("leyendo") && !e.tags?.includes("leido"))
               .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    [libros]
  );

  const estadoTags = new Set(["libro", "leyendo", "leido", "pendiente"]);
  const coTags = useMemo(() => {
    const freq: Record<string, number> = {};
    libros.forEach(e =>
      e.tags?.forEach((t: string) => {
        if (!estadoTags.has(t)) freq[t] = (freq[t] || 0) + 1;
      })
    );
    return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 12);
  }, [libros]);

  const totalPalabras = useMemo(
    () => libros.reduce((acc, e) => acc + (e.contenido?.split(/\s+/).filter(Boolean).length || 0), 0),
    [libros]
  );

  const formatRelative = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return "hoy";
    if (days === 1) return "ayer";
    if (days < 7) return `${days}d`;
    if (days < 30) return `${Math.floor(days / 7)}sem`;
    return new Date(dateStr).toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
  };

  const wordCount = (e: any) =>
    e.contenido?.split(/\s+/).filter(Boolean).length || 0;

  const filtrados = useMemo(() => {
    let result = libros;
    if (tagFiltro) result = result.filter(e => e.tags?.includes(tagFiltro));
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      result = result.filter(e => e.titulo?.toLowerCase().includes(q) || e.contenido?.toLowerCase().includes(q));
    }
    if (orden === "reciente") return [...result].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    if (orden === "titulo")   return [...result].sort((a, b) => (a.titulo || "").localeCompare(b.titulo || "", "es"));
    if (orden === "palabras") return [...result].sort((a, b) => wordCount(b) - wordCount(a));
    return result;
  }, [libros, busqueda, orden, tagFiltro]);

  const divColor = "color-mix(in srgb, var(--foreground) 5%, transparent)";
  const borderColor = "color-mix(in srgb, var(--foreground) 7%, transparent)";

  // ─── Panel de estados con SeccionEntidad ─────────────────────────────────
  // Convertimos los libros a EntidadBase para SeccionEntidad
  const librosComoEntidades = useMemo(
    () => libros.map(l => ({ id: l.id, nombre: l.titulo || "Sin título", imagen_url: l.imagen_url ?? null })),
    [libros]
  );

  const panelEstados = (
    <>
      <SeccionEntidad
        allEntities={librosComoEntidades}
        emptyLabel="ninguno en curso"
        fallbackIcon={<BookOpen size={12} />}
        icon={<BookOpen size={9} />}
        label="Leyendo ahora"
        loading={false}
        saving={false}
        selectedIds={leyendo.map(l => l.id)}
        onEntityClick={onNavigate ? (id) => {
          const libro = libros.find(l => l.id === id);
          if (libro) onNavigate(libro.titulo);
        } : undefined}
        onToggle={(id, add) => onToggleEstado?.(id, "leyendo", add)}
      />
      <div style={{ height: 1, background: borderColor, flexShrink: 0 }} />
      <SeccionEntidad
        allEntities={librosComoEntidades}
        emptyLabel="aún nada terminado"
        fallbackIcon={<BookCheck size={12} />}
        icon={<BookCheck size={9} />}
        label="Leídos"
        loading={false}
        saving={false}
        selectedIds={leidos.map(l => l.id)}
        onEntityClick={onNavigate ? (id) => {
          const libro = libros.find(l => l.id === id);
          if (libro) onNavigate(libro.titulo);
        } : undefined}
        onToggle={(id, add) => onToggleEstado?.(id, "leido", add)}
      />
      <div style={{ height: 1, background: borderColor, flexShrink: 0 }} />
      <SeccionEntidad
        allEntities={librosComoEntidades}
        emptyLabel="lista limpia"
        fallbackIcon={<BookDashed size={12} />}
        icon={<BookDashed size={9} />}
        label="Pendientes"
        loading={false}
        saving={false}
        selectedIds={pendientes.map(l => l.id)}
        onEntityClick={onNavigate ? (id) => {
          const libro = libros.find(l => l.id === id);
          if (libro) onNavigate(libro.titulo);
        } : undefined}
        onToggle={(id, add) => onToggleEstado?.(id, "pendiente", add)}
      />
    </>
  );

  // ─── Contenido principal (grid + controles) ───────────────────────────────
  const mainContent = (
    <div style={{ padding: isMobile ? "12px 8px 32px" : "16px 8px 40px" }}>

      {/* Header */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "color-mix(in srgb, var(--foreground) 5%, transparent)",
            border: "1px solid color-mix(in srgb, var(--foreground) 10%, transparent)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "color-mix(in srgb, var(--foreground) 40%, transparent)",
          }}>
            <BookOpen size={15} />
          </div>
          <h1 style={{ ...serif, fontSize: isMobile ? 18 : 22, color: "color-mix(in srgb, var(--foreground) 80%, transparent)", margin: 0, lineHeight: 1 }}>
            Biblioteca
          </h1>
        </div>
        <p style={{ ...mono, fontSize: 9, color: "color-mix(in srgb, var(--foreground) 20%, transparent)", textTransform: "uppercase", letterSpacing: "0.13em", margin: 0 }}>
          {libros.length} libros · {totalPalabras.toLocaleString("es-ES")} palabras
          {tagFiltro && ` · #${tagFiltro}`}
          {busqueda && ` · "${busqueda}"`}
        </p>
      </div>

      {/* Controles */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{
          flex: 1, minWidth: 120, display: "flex", alignItems: "center", gap: 7,
          background: "color-mix(in srgb, var(--foreground) 4%, transparent)",
          border: "1px solid color-mix(in srgb, var(--foreground) 8%, transparent)",
          borderRadius: 7, padding: "6px 10px",
        }}>
          <Search size={10} style={{ color: "color-mix(in srgb, var(--foreground) 25%, transparent)", flexShrink: 0 }} />
          <input
            placeholder="buscar libro..."
            style={{
              flex: 1, border: "none", background: "transparent", outline: "none",
              ...mono, fontSize: 10,
              color: "color-mix(in srgb, var(--foreground) 70%, transparent)",
            }}
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
          {busqueda && (
            <button style={{ border: "none", background: "transparent", cursor: "pointer", display: "flex", padding: 0, color: "color-mix(in srgb, var(--foreground) 25%, transparent)" }} onClick={() => setBusqueda("")}>
              <X size={9} />
            </button>
          )}
        </div>
        <div style={{ display: "flex", gap: 2 }}>
          {(["reciente", "titulo", "palabras"] as OrdenLibros[]).map(o => (
            <button
              key={o}
              style={{
                ...mono, fontSize: isMobile ? 7 : 8, padding: isMobile ? "4px 7px" : "5px 9px", borderRadius: 5, border: "none",
                cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.1em",
                transition: "all 0.1s",
                background: orden === o ? "color-mix(in srgb, var(--foreground) 10%, transparent)" : "transparent",
                color: orden === o ? "color-mix(in srgb, var(--foreground) 70%, transparent)" : "color-mix(in srgb, var(--foreground) 28%, transparent)",
              }}
              onClick={() => setOrden(o)}
            >
              {o}
            </button>
          ))}
        </div>
      </div>

      {/* Filtros de co-tags */}
      {coTags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 16 }}>
          <button
            style={{
              ...mono, fontSize: 9, padding: "2px 8px", borderRadius: 4, cursor: "pointer",
              border: "1px solid",
              borderColor: !tagFiltro ? "color-mix(in srgb, var(--foreground) 35%, transparent)" : "color-mix(in srgb, var(--foreground) 10%, transparent)",
              background: !tagFiltro ? "color-mix(in srgb, var(--foreground) 8%, transparent)" : "transparent",
              color: !tagFiltro ? "color-mix(in srgb, var(--foreground) 80%, transparent)" : "color-mix(in srgb, var(--foreground) 30%, transparent)",
              transition: "all 0.1s",
            }}
            onClick={() => setTagFiltro(null)}
          >
            todos
          </button>
          {coTags.map(([tag, count]) => {
            const isActive = tagFiltro === tag;
            return (
              <button
                key={tag}
                style={{
                  ...mono, fontSize: 9, padding: "2px 8px", borderRadius: 4, cursor: "pointer",
                  border: "1px solid",
                  borderColor: isActive ? "color-mix(in srgb, var(--foreground) 30%, transparent)" : "color-mix(in srgb, var(--foreground) 8%, transparent)",
                  background: isActive ? "color-mix(in srgb, var(--foreground) 7%, transparent)" : "transparent",
                  color: isActive ? "color-mix(in srgb, var(--foreground) 75%, transparent)" : "color-mix(in srgb, var(--foreground) 30%, transparent)",
                  transition: "all 0.1s",
                  display: "flex", alignItems: "center", gap: 4,
                }}
                onClick={() => setTagFiltro(isActive ? null : tag)}
              >
                #{tag}
                <span style={{ fontSize: 7, color: "color-mix(in srgb, var(--foreground) 18%, transparent)" }}>{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {filtrados.length === 0 && (
        <MotionDiv
          animate={{ opacity: 1 }}
          initial={{ opacity: 0 }}
          style={{ textAlign: "center", padding: "64px 0" }}
        >
          <BookMarked size={28} style={{ color: "color-mix(in srgb, var(--foreground) 10%, transparent)", margin: "0 auto 14px" }} />
          <p style={{ ...serif, fontSize: 15, color: "color-mix(in srgb, var(--foreground) 25%, transparent)", marginBottom: 6 }}>
            {libros.length === 0 ? "ningún libro aún" : "sin resultados"}
          </p>
          <p style={{ ...mono, fontSize: 9, color: "color-mix(in srgb, var(--foreground) 12%, transparent)" }}>
            {libros.length === 0
              ? "agrega la etiqueta #libro a una nota para verla aquí"
              : "prueba con otro término o limpia los filtros"}
          </p>
        </MotionDiv>
      )}

      {/* Carta destacada */}
      {filtrados.length > 0 && orden === "reciente" && !busqueda && !tagFiltro && (
        <MotionDiv
          animate={{ opacity: 1, y: 0 }}
          initial={{ opacity: 0, y: 6 }}
          style={{ marginBottom: 8 }}
          transition={{ duration: 0.18 }}
        >
          <button
            className="w-full text-left group"
            style={{
              display: "block", width: "100%",
              padding: isMobile ? "14px 16px" : "20px 22px",
              background: "var(--bg-main)",
              border: "1px solid color-mix(in srgb, var(--foreground) 9%, transparent)",
              borderRadius: 10, cursor: "pointer",
              transition: "all 0.12s",
            }}
            onClick={() => onNavigate(filtrados[0].titulo)}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = "color-mix(in srgb, var(--foreground) 3%, transparent)";
              (e.currentTarget as HTMLElement).style.borderColor = "color-mix(in srgb, var(--foreground) 18%, transparent)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = "var(--bg-main)";
              (e.currentTarget as HTMLElement).style.borderColor = "color-mix(in srgb, var(--foreground) 9%, transparent)";
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <span style={{ ...mono, fontSize: 8, color: "color-mix(in srgb, var(--foreground) 22%, transparent)", textTransform: "uppercase", letterSpacing: "0.13em" }}>
                    reciente
                  </span>
                  <div style={{ flex: 1, height: 1, background: "color-mix(in srgb, var(--foreground) 6%, transparent)" }} />
                </div>
                <h2 style={{ ...serif, fontSize: isMobile ? 16 : 19, color: "color-mix(in srgb, var(--foreground) 78%, transparent)", margin: "0 0 4px", lineHeight: 1.25 }}>
                  {filtrados[0].titulo || "Sin título"}
                </h2>
                {filtrados[0].autor && (
                  <p style={{ ...mono, fontSize: 9, color: "color-mix(in srgb, var(--foreground) 30%, transparent)", margin: "0 0 8px" }}>
                    {filtrados[0].autor}
                  </p>
                )}
                {filtrados[0].contenido && (
                  <p style={{
                    ...mono, fontSize: 10,
                    color: "color-mix(in srgb, var(--foreground) 30%, transparent)",
                    margin: "0 0 12px",
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical" as any,
                    lineHeight: 1.6,
                  }}>
                    {filtrados[0].contenido.replace(/#{1,6}\s/g, "").replace(/\*\*/g, "").slice(0, 200)}
                  </p>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {filtrados[0].tags?.filter((t: string) => !estadoTags.has(t)).slice(0, 4).map((t: string) => (
                    <span key={t} style={{
                      ...mono, fontSize: 8,
                      padding: "2px 6px", borderRadius: 3,
                      background: "color-mix(in srgb, var(--foreground) 5%, transparent)",
                      border: "1px solid color-mix(in srgb, var(--foreground) 8%, transparent)",
                      color: "color-mix(in srgb, var(--foreground) 28%, transparent)",
                    }}>#{t}</span>
                  ))}
                  <span style={{ ...mono, fontSize: 8, color: "color-mix(in srgb, var(--foreground) 18%, transparent)" }}>
                    {formatRelative(filtrados[0].updated_at)} · {wordCount(filtrados[0]).toLocaleString("es-ES")}p
                  </span>
                </div>
              </div>
              <ArrowRight
                size={14}
                style={{ color: "color-mix(in srgb, var(--foreground) 18%, transparent)", flexShrink: 0, marginTop: 4 }}
              />
            </div>
          </button>
        </MotionDiv>
      )}

      {/* Grid de libros */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile
          ? "repeat(2, 1fr)"
          : "repeat(auto-fill, minmax(160px, 1fr))",
        gap: 1,
        background: divColor,
        borderRadius: 8,
        overflow: "hidden",
      }}>
        {/* Botón nuevo libro */}
        <button
          style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            padding: "14px 15px", gap: 8, background: "var(--bg-main)",
            border: "none", cursor: "pointer", transition: "background 0.08s",
            minHeight: isMobile ? 80 : 100,
          }}
          onClick={onCrearLibro}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "color-mix(in srgb, var(--foreground) 3%, transparent)"}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "var(--bg-main)"}
        >
          <BookMarked size={18} style={{ color: "color-mix(in srgb, var(--foreground) 18%, transparent)" }} />
          <span style={{ ...mono, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.13em", color: "color-mix(in srgb, var(--foreground) 28%, transparent)" }}>
            + nuevo libro
          </span>
        </button>

        {(filtrados.length > 0 && orden === "reciente" && !busqueda && !tagFiltro
          ? filtrados.slice(1)
          : filtrados
        ).map((libro, i) => {
          const wc = wordCount(libro);
          const tags = libro.tags?.filter((t: string) => !estadoTags.has(t)) ?? [];
          return (
            <MotionDiv
              key={libro.id}
              animate={{ opacity: 1 }}
              initial={{ opacity: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.3) }}
            >
              <button
                className="w-full text-left"
                style={{
                  display: "flex", flexDirection: "column",
                  padding: "14px 15px",
                  background: hoveredId === libro.id
                    ? "color-mix(in srgb, var(--foreground) 4%, transparent)"
                    : "var(--bg-main)",
                  border: "none", cursor: "pointer",
                  transition: "background 0.08s",
                  height: "100%",
                }}
                onClick={() => onNavigate(libro.titulo)}
                onMouseEnter={() => setHoveredId(libro.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <p style={{
                  ...serif, fontSize: 13,
                  color: "color-mix(in srgb, var(--foreground) 72%, transparent)",
                  margin: "0 0 4px",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {libro.titulo || "Sin título"}
                </p>
                {libro.autor && (
                  <p style={{ ...mono, fontSize: 8, color: "color-mix(in srgb, var(--foreground) 30%, transparent)", margin: "0 0 4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {libro.autor}
                  </p>
                )}
                {libro.contenido && (
                  <p style={{
                    ...mono, fontSize: 9,
                    color: "color-mix(in srgb, var(--foreground) 22%, transparent)",
                    margin: "0 0 10px", lineHeight: 1.55, flex: 1,
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical" as any,
                  }}>
                    {libro.contenido.replace(/#{1,6}\s/g, "").replace(/\*\*/g, "").slice(0, 120)}
                  </p>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap", marginTop: "auto" }}>
                  {tags.slice(0, 2).map((t: string) => (
                    <span key={t} style={{ ...mono, fontSize: 7, color: "color-mix(in srgb, var(--foreground) 22%, transparent)" }}>#{t}</span>
                  ))}
                  <span style={{ marginLeft: "auto", ...mono, fontSize: 7, color: "color-mix(in srgb, var(--foreground) 16%, transparent)" }}>
                    {formatRelative(libro.updated_at)}
                    {wc > 0 && ` · ${wc.toLocaleString("es-ES")}p`}
                  </span>
                </div>
              </button>
            </MotionDiv>
          );
        })}
      </div>

      {filtrados.length === 1 && orden === "reciente" && !busqueda && !tagFiltro && (
        <div style={{ paddingTop: 16, textAlign: "center" }}>
          <p style={{ ...mono, fontSize: 9, color: "color-mix(in srgb, var(--foreground) 12%, transparent)" }}>
            solo un libro por ahora — agrega #libro a más notas para verlas aquí
          </p>
        </div>
      )}

    </div>
  );

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <MotionDiv
      animate={{ opacity: 1 }}
      initial={{ opacity: 0 }}
      style={{
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        height: isMobile ? "auto" : "100%",
        overflow: isMobile ? "visible" : "hidden",
        background: "var(--bg-main)",
      }}
      transition={{ duration: 0.22 }}
    >
      {/* Columna izquierda / principal */}
      <div style={{
        flex: 1,
        overflowY: isMobile ? "visible" : "auto",
        minWidth: 0,
      }}>
        {mainContent}
      </div>

      {/* Panel de estados — escritorio: columna lateral fija; móvil: sección inferior */}
      {isMobile ? (
        <div style={{
          borderTop: `1px solid ${borderColor}`,
          background: "color-mix(in srgb, var(--foreground) 1.5%, transparent)",
          marginBottom: 80, // espacio para la nav bar móvil
        }}>
          {/* Cabecera del panel */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 14px 8px", borderBottom: `1px solid ${borderColor}` }}>
            <Library size={10} style={{ color: "color-mix(in srgb, var(--foreground) 22%, transparent)" }} />
            <span style={{ ...mono, fontSize: 8, color: "color-mix(in srgb, var(--foreground) 22%, transparent)", textTransform: "uppercase", letterSpacing: "0.13em" }}>
              estado de lectura
            </span>
          </div>
          {panelEstados}
        </div>
      ) : (
        <div style={{
          width: 220,
          flexShrink: 0,
          borderLeft: `1px solid ${borderColor}`,
          display: "flex",
          flexDirection: "column",
          height: "100%",
          overflow: "hidden",
          background: "color-mix(in srgb, var(--foreground) 1.5%, transparent)",
        }}>
          <div style={{ padding: "14px 10px 8px", borderBottom: `1px solid ${borderColor}`, flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Library size={10} style={{ color: "color-mix(in srgb, var(--foreground) 22%, transparent)" }} />
              <span style={{ ...mono, fontSize: 8, color: "color-mix(in srgb, var(--foreground) 22%, transparent)", textTransform: "uppercase", letterSpacing: "0.13em" }}>
                estado de lectura
              </span>
            </div>
            <p style={{ ...mono, fontSize: 7, color: "color-mix(in srgb, var(--foreground) 14%, transparent)", margin: "4px 0 0" }}>
              tags: #leyendo · #leido · #pendiente
            </p>
          </div>
          {panelEstados}
        </div>
      )}
    </MotionDiv>
  );
}