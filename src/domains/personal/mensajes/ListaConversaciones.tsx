"use client";

import { MessageCircle, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import React, { Suspense, useEffect, useState, useRef } from "react";

import { Loading } from "@/ui";
import { SmartImage } from "@/ui/SmartImage";
import { useUsuariosEnLinea } from "@/infra/realtime/useEnLinea";
import {
  listarConversaciones,
  buscarPerfiles,
  obtenerOCrearConversacion1a1,
  suscribirseAConversaciones,
  type ConversacionResumen,
  type PerfilResumen,
} from "@/infra/call/chatEngine";
import { supabase } from "@/infra/supabase/supabase";
import { useAuth } from "@/providers/AuthProvider";

// Ruta única al detalle de una conversación, misma para web y para el APK
// de Tauri (mensajes es contenido privado, no hay SEO en juego).
export function rutaConversacion(id: string): string {
  return `/personal/mensajes/detalle?id=${id}`;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "ahora";
  if (min < 60) return `${min}m`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h`;
  const dias = Math.floor(hrs / 24);
  return `${dias}d`;
}

type Props = {
  // "pagina": pantalla completa (mobile). "sidebar": panel angosto fijo
  // dentro del layout estilo WhatsApp Web (desktop).
  variante?: "pagina" | "sidebar";
  className?: string;
};

function ListaConversacionesInner({ variante = "pagina", className = "" }: Props) {
  const { user } = useAuth() as { user: any };
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const idsEnLinea = useUsuariosEnLinea();

  // En modo sidebar resaltamos la conversación activa (?id= de la URL).
  const conversacionActivaId =
    variante === "sidebar" && pathname?.includes("/mensajes/detalle")
      ? searchParams.get("id")
      : null;

  const [conversaciones, setConversaciones] = useState<ConversacionResumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState<PerfilResumen[]>([]);
  const [buscando, setBuscando] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cargar = async () => {
    const data = await listarConversaciones();
    setConversaciones(data);
    setLoading(false);
  };

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    void cargar();

    const canal = suscribirseAConversaciones(user.id, () => void cargar());
    return () => {
      supabase.removeChannel(canal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!busqueda.trim()) {
      setResultados([]);
      return;
    }
    setBuscando(true);
    debounceRef.current = setTimeout(async () => {
      const r = await buscarPerfiles(busqueda);
      setResultados(r.filter((p) => p.id !== user?.id));
      setBuscando(false);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [busqueda, user?.id]);

  const iniciarConversacion = async (perfil: PerfilResumen) => {
    const convId = await obtenerOCrearConversacion1a1(perfil.id);
    setBusqueda("");
    setResultados([]);
    router.push(rutaConversacion(convId));
  };

  if (!user) {
    return (
      <div className={`flex flex-col items-center justify-center gap-3 px-6 text-center ${variante === "pagina" ? "min-h-screen bg-bg-main" : "h-full"} ${className}`}>
        <MessageCircle className="text-primary/30" size={28} />
        <p className="text-primary/40 font-black uppercase text-xs tracking-widest italic">
          Necesitás iniciar sesión para ver tus mensajes
        </p>
      </div>
    );
  }

  if (loading) return <Loading />;

  const contenido = (
    <>
      {variante === "pagina" && (
        <h1 className="text-3xl font-black text-primary italic tracking-tighter uppercase mb-6">
          Mensajes
        </h1>
      )}

      {/* ── Buscador para iniciar conversación ── */}
      <div className="relative mb-4">
        <div
          className="flex items-center gap-2 px-4 py-3 rounded-[var(--radius-btn)]"
          style={{
            background: "var(--white-custom)",
            border: "var(--border-width) solid color-mix(in srgb, var(--primary) 15%, transparent)",
          }}
        >
          <Search className="text-primary/40 flex-shrink-0" size={15} />
          <input
            className="flex-1 bg-transparent outline-none text-sm font-medium text-primary placeholder:text-primary/30"
            placeholder="Buscar usuario por username…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          {busqueda && (
            <button onClick={() => setBusqueda("")} aria-label="Limpiar búsqueda">
              <X className="text-primary/40" size={14} />
            </button>
          )}
        </div>

        {busqueda && (
          <div
            className="absolute left-0 right-0 mt-1 rounded-[var(--radius-card)] overflow-hidden z-20"
            style={{
              background: "var(--white-custom)",
              border: "var(--border-width) solid color-mix(in srgb, var(--primary) 15%, transparent)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            {buscando && (
              <p className="p-4 text-center text-micro text-primary/30 italic">Buscando…</p>
            )}
            {!buscando && resultados.length === 0 && (
              <p className="p-4 text-center text-micro text-primary/30 italic">
                Sin resultados
              </p>
            )}
            {resultados.map((p) => (
              <button
                key={p.id}
                className="w-full flex items-center gap-3 p-3 hover:bg-primary/5 transition-colors text-left"
                onClick={() => void iniciarConversacion(p)}
              >
                <div className="w-8 h-8 rounded-full overflow-hidden bg-primary/10 flex-shrink-0">
                  <SmartImage
                    alt={p.username ?? "Usuario"}
                    className="w-full h-full"
                    src={p.avatar_url || "/icon.jpg"}
                  />
                </div>
                <span className="text-sm font-bold text-primary">
                  {p.username ?? "Usuario sin nombre"}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Lista de conversaciones ── */}
      {conversaciones.length === 0 ? (
        <p className="text-center text-primary/30 font-bold text-xs uppercase tracking-widest py-16 italic">
          Todavía no tenés conversaciones. Buscá a alguien para empezar a charlar.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {conversaciones.map((c) => {
            const activa = c.id === conversacionActivaId;
            return (
              <Link
                key={c.id}
                className="flex items-center gap-3 p-3 rounded-[var(--radius-btn)] transition-all"
                href={rutaConversacion(c.id)}
                style={{
                  background: activa
                    ? "color-mix(in srgb, var(--primary) 10%, transparent)"
                    : "var(--white-custom)",
                  border: `var(--border-width) solid ${
                    activa
                      ? "color-mix(in srgb, var(--primary) 25%, transparent)"
                      : "color-mix(in srgb, var(--primary) 8%, transparent)"
                  }`,
                }}
              >
                <div className="relative w-11 h-11 rounded-full overflow-hidden bg-primary/10 flex-shrink-0">
                  <SmartImage
                    alt={c.otroParticipante?.username ?? c.nombre ?? "Chat"}
                    className="w-full h-full"
                    src={c.otroParticipante?.avatar_url || "/icon.jpg"}
                  />
                  {c.otroParticipante && idsEnLinea.has(c.otroParticipante.id) && (
                    <span
                      className="absolute bottom-0 right-0 rounded-full"
                      style={{
                        width: 11,
                        height: 11,
                        background: "#22c55e",
                        border: "2px solid var(--bg-main)",
                      }}
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-black text-sm text-primary truncate">
                      {c.es_grupo ? c.nombre : c.otroParticipante?.username ?? "Usuario"}
                    </span>
                    <span className="text-micro text-primary/30 flex-shrink-0">
                      {timeAgo(c.ultimo_mensaje_at)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <span className="text-micro text-primary/40 truncate italic">
                      {c.ultimoMensaje ?? "Sin mensajes todavía"}
                    </span>
                    {c.noLeidos > 0 && (
                      <span
                        className="flex-shrink-0 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center text-[10px] font-black text-[var(--btn-text)]"
                        style={{ background: "var(--primary)" }}
                      >
                        {c.noLeidos}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );

  if (variante === "sidebar") {
    return (
      <div className={`h-full overflow-y-auto px-3 py-4 ${className}`}>
        {contenido}
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-bg-main pb-20 ${className}`}>
      <div className="max-w-2xl mx-auto px-6 pt-10">{contenido}</div>
    </div>
  );
}

// ListaConversacionesInner usa useSearchParams (para resaltar la
// conversación activa en modo sidebar), y Next exige que cualquier
// componente que lo use esté envuelto en Suspense para poder
// prerenderizarse con output:"export". Se envuelve acá adentro para que
// ningún consumidor (page.tsx, layout.tsx) tenga que acordarse de hacerlo.
export default function ListaConversaciones(props: Props) {
  return (
    <Suspense fallback={<Loading />}>
      <ListaConversacionesInner {...props} />
    </Suspense>
  );
}
