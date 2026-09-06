"use client";




import { Instagram, Youtube, Palette, NotebookPen, Pencil, Check, X, Loader2 } from "lucide-react";
import Link from "next/link";
import React, { useState, useCallback, useEffect, useRef } from "react";




import { MotionA, MotionDiv, MotionH1, MotionMain, MotionSection } from '@/ui/Motion';
import { ToastContainer } from "@/ui/ToastContainer";
import { useToast } from "@/hooks/ui/useToast";
import { db } from "@/infra/supabase/db";
import { supabase } from "@/infra/supabase/supabase";
import { useAuth } from "@/providers/AuthProvider";

// ─── Textos editables de "Sobre Mí" ───────────────────────────────────────────
// Tabla Supabase esperada: sobre_mi_textos (clave text PK, valor text, updated_at timestamptz)
// Mismo patrón local-first que en galeria.tsx: Dexie como caché, Supabase como
// fuente de verdad. Los admins (perfil.rol === "admin") pueden editar el texto
// directamente desde esta misma página, sin tocar código.

const TEXTOS_DEFAULT = {
  bienvenida:
    'Bienvenido a mi pequeño jardín digital. Uso este espacio para compartir mis hobbys y proyectos: Mi mayor proyecto es "Garden of Sins" el cual puedes ver en el icono de la flor.',
  garden_of_sins:
    "Este proyecto comenzo como una forma de compartir experiencias que no era capas de expresar verbalmente y a la vez explorar nuevas formas de arte. Luego se convirtio en algo mas grande. Ya no era solo mi historia, era un mundo entero que necesitaba sacar de mi mente. \n\nLos personajes de este mundo surgieron en base a personas que han dejado una marca en mi. Y pese a que los temas de esta historia son recurrentes en la actualidad, y muchos aconteciemtos estan basados en ciertos periodos historicos todo lo contado en estas historias es ficticio.",
} as const;

type TextoKey = keyof typeof TEXTOS_DEFAULT;
type TextosSobreMi = Record<TextoKey, string>;

async function readTextosFromDexie(): Promise<Partial<TextosSobreMi> | null> {
  try {
    if (!db) return null;
    const rows = await (db as any).sobre_mi_textos?.toArray();
    if (!rows || rows.length === 0) return null;
    const map: Partial<TextosSobreMi> = {};
    for (const row of rows) map[row.clave as TextoKey] = row.valor;
    return map;
  } catch {
    return null;
  }
}

async function writeTextoToDexie(clave: TextoKey, valor: string): Promise<void> {
  try {
    if (!db) return;
    await (db as any).sobre_mi_textos?.put({ clave, valor });
  } catch (e) {
    console.warn("[Dexie] sobre_mi_textos put falló:", e);
  }
}

function useTextosSobreMi() {
  const [textos, setTextos] = useState<TextosSobreMi>({ ...TEXTOS_DEFAULT });
  const isMounted = useRef(true);

  const fetchRemote = useCallback(async () => {
    try {
      const { data, error } = await supabase.from("sobre_mi_textos").select("clave, valor");
      if (error || !data || !isMounted.current) return;
      setTextos((prev) => {
        const next = { ...prev };
        for (const row of data as { clave: string; valor: string }[]) {
          if (row.clave in TEXTOS_DEFAULT) next[row.clave as TextoKey] = row.valor;
        }
        return next;
      });
      for (const row of data as { clave: string; valor: string }[]) {
        if (row.clave in TEXTOS_DEFAULT) void writeTextoToDexie(row.clave as TextoKey, row.valor);
      }
    } catch {
      // sin conexión: se mantiene lo que ya haya en pantalla (default o caché)
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    void readTextosFromDexie().then((local) => {
      if (!isMounted.current) return;
      if (local) setTextos((prev) => ({ ...prev, ...local }));
      void fetchRemote();
    });
    return () => {
      isMounted.current = false;
    };
  }, [fetchRemote]);

  const guardarTexto = useCallback(async (clave: TextoKey, valor: string) => {
    const { error } = await supabase
      .from("sobre_mi_textos")
      .upsert({ clave, valor, updated_at: new Date().toISOString() });
    if (error) return { ok: false as const, error };
    setTextos((prev) => ({ ...prev, [clave]: valor }));
    void writeTextoToDexie(clave, valor);
    return { ok: true as const };
  }, []);

  return { textos, guardarTexto };
}

/** Bloque de texto editable en línea: para todos es texto plano; para admins
 *  muestra un lápiz al hacer hover que abre un textarea con guardar/cancelar.
 *  Se guarda directo en Supabase (y se cachea en Dexie). */
function TextoEditable({
  valor,
  onGuardar,
  isAdmin,
  as: Component = "p",
  className,
  style,
}: {
  valor: string;
  onGuardar: (nuevoValor: string) => Promise<{ ok: boolean; error?: unknown }>;
  isAdmin: boolean;
  as?: "p" | "div";
  className?: string;
  style?: React.CSSProperties;
}) {
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState(valor);
  const [guardando, setGuardando] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!editando) setBorrador(valor);
  }, [valor, editando]);

  const handleGuardar = async () => {
    if (borrador.trim() === "") return;
    setGuardando(true);
    const res = await onGuardar(borrador.trim());
    setGuardando(false);
    if (res.ok) {
      setEditando(false);
      toast.success("Texto actualizado.");
    } else {
      toast.error("No se pudo guardar el texto.");
    }
  };

  const handleCancelar = () => {
    setBorrador(valor);
    setEditando(false);
  };

  if (editando) {
    return (
      <div className="w-full">
        <textarea
          autoFocus
          className={className}
          onChange={(e) => setBorrador(e.target.value)}
          rows={Math.max(4, Math.ceil(borrador.length / 60))}
          style={{
            ...style,
            width: "100%",
            resize: "vertical",
            background: "var(--white-custom)",
            border: "1px solid color-mix(in srgb, var(--primary) 30%, transparent)",
            borderRadius: "var(--radius-btn)",
            padding: "0.75rem",
            outline: "none",
          }}
          value={borrador}
        />
        <div className="flex items-center gap-2 mt-3">
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold rounded-full disabled:opacity-50"
            disabled={guardando}
            onClick={handleGuardar}
            style={{ background: "var(--primary)", color: "var(--white-custom)" }}
            type="button"
          >
            {guardando ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
            Guardar
          </button>
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold rounded-full disabled:opacity-50"
            disabled={guardando}
            onClick={handleCancelar}
            style={{
              background: "color-mix(in srgb, var(--primary) 8%, transparent)",
              color: "var(--primary)",
            }}
            type="button"
          >
            <X size={14} />
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group/editable relative w-full">
      <Component className={className} style={style}>
        {valor.split("\n").map((linea, i, arr) => (
          <React.Fragment key={i}>
            {linea}
            {i < arr.length - 1 && <br />}
          </React.Fragment>
        ))}
      </Component>
      {isAdmin && (
        <button
          aria-label="Editar texto"
          className="absolute -top-2 -right-2 opacity-0 group-hover/editable:opacity-100 transition-opacity duration-200 w-8 h-8 flex items-center justify-center rounded-full"
          onClick={() => setEditando(true)}
          style={{
            background: "var(--primary)",
            color: "var(--white-custom)",
            boxShadow: "var(--shadow-card)",
          }}
          type="button"
        >
          <Pencil size={14} />
        </button>
      )}
    </div>
  );
}






const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.55, delay, ease: [0.25, 0.1, 0.25, 1] as any },
});










export default function SobreMi() {
  const FORMSPREE_ID = "xvzpjdgr";
  const [_enviado, setEnviado] = useState(false);
  const [_loading, setLoading] = useState(false);
  const { toasts, toast, dismiss } = useToast();
  const { perfil } = useAuth() as any;
  const isAdmin = perfil?.rol === "admin";
  const { textos, guardarTexto } = useTextosSobreMi();

  const _handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const form = e.currentTarget;
    const data = new FormData(form);
    try {
      const res = await fetch(`https://formspree.io/f/${FORMSPREE_ID}`, {
        method: "POST", body: data, headers: { Accept: "application/json" },
      });
      if (res.ok) { setEnviado(true); form.reset(); }
      else toast.error("Hubo un error al enviar el mensaje.");
    } catch { toast.error("Error de conexión."); }
    finally { setLoading(false); }
  };

  return (
    <MotionMain
      animate={{ opacity: 1, y: 0 }}
      className="min-h-svh bg-bg-main"
      initial={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.5 }}
    >
    <div className="w-full bg-bg-main min-h-screen selection:bg-primary/10">
      <main className="max-w-7xl mx-auto px-8 md:px-16 pb-40 pt-16 md:pt-24">

        {/* ── SECCIÓN HERO: dos columnas en desktop ── */}
        <section className="mb-24 md:mb-32">
          <div className="flex flex-col md:flex-row md:gap-16 md:items-center">

            {/* Columna izquierda: título + bienvenida */}
            <div className="flex-1 min-w-0">
              <header className="mb-10 flex flex-col items-center text-center">
                <div className="overflow-visible">
                  <MotionH1
                    animate={{ y: 0 }}
                    className="font-black italic uppercase leading-[0.9]"
                    initial={{ y: "110%" }}
                    style={{
                      color: "var(--primary)",
                      fontSize: "clamp(2.8rem, 7vw, 6rem)",
                      letterSpacing: "-0.02em",
                    }}
                    transition={{ duration: 0.7, delay: 0.06, ease: [0.16, 1, 0.3, 1] as any }}
                  >
                    Sobre Mí
                  </MotionH1>
                </div>
              </header>

              {/* Cuadro de bienvenida */}
              <MotionSection
                {...fade(0.18)}
                className="relative flex flex-col items-start text-left py-10 px-8 overflow-hidden"
                style={{
                  background: "color-mix(in srgb, var(--primary) 5%, var(--white-custom))",
                  borderRadius: "var(--radius-card)",
                  border: "var(--border-width) solid color-mix(in srgb, var(--primary) 12%, transparent)",
                  boxShadow: "var(--shadow-card)",
                }}
              >
                <TextoEditable
                  as="p"
                  className="text-xl md:text-2xl leading-[1.5] font-light italic"
                  isAdmin={isAdmin}
                  onGuardar={(nuevoValor) => guardarTexto("bienvenida", nuevoValor)}
                  style={{ color: "var(--primary)", opacity: 0.88 }}
                  valor={textos.bienvenida}
                />
              </MotionSection>
            </div>

            {/* Columna derecha: enlaces internos en columna */}
            {/* Antes vivía acá el bloque "Herramientas" (TOOLS); se
                reemplazó por Galería/Ensayos, que antes vivían en la
                sidebar/navbar principal (personalLinks en
                layout/navbar.tsx) y se sacaron de ahí para vivir acá,
                al lado de "Sobre Mí". Mismo layout de card que tenía
                Herramientas — ícono + label — pero ahora como Link
                real (Herramientas era decorativo, sin href). */}
            <MotionSection {...fade(0.24)} className="mt-10 md:mt-0 md:w-[28%] shrink-0">
              <div
                className="flex items-center justify-center gap-2 text-sm font-black uppercase tracking-[0.4em] mb-6"
                style={{ color: "var(--primary)", opacity: 0.3 }}
              >
                Explorar
              </div>

              <div className="flex flex-col gap-4">
                {[
                  {
                    href: "/personal/galeria",
                    title: "Galería",
                    icon: <Palette size={18} strokeWidth={1.5} />,
                  },
                  {
                    href: "/personal/ensayos",
                    title: "Ensayos",
                    icon: <NotebookPen size={18} strokeWidth={1.5} />,
                  },
                ].map((item, i) => (
                  <MotionDiv
                    key={item.href}
                    {...fade(0.28 + i * 0.07)}
                    transition={{ duration: 0.22 }}
                    whileHover={{ x: 4 }}
                  >
                    <Link
                      href={item.href}
                      className="group relative flex items-center justify-center gap-3 p-5 overflow-hidden no-underline"
                      style={{
                        background: "var(--white-custom)",
                        borderRadius: "var(--radius-card)",
                        border: "var(--border-width) solid color-mix(in srgb, var(--primary) 10%, transparent)",
                        boxShadow: "var(--shadow-card)",
                      }}
                    >
                      <div
                        className="relative z-10 flex items-center gap-3"
                        style={{ color: "var(--primary)" }}
                      >
                        <span
                          className="flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
                          style={{ opacity: 0.65 }}
                        >
                          {item.icon}
                        </span>
                        <h4
                          className="font-black text-l leading-snug"
                          style={{ letterSpacing: "-0.02em" }}
                        >{item.title}</h4>
                      </div>

                      <div
                        className="absolute bottom-0 left-0 h-[2px] w-0 group-hover:w-full transition-all duration-500 ease-out rounded-full"
                        style={{ background: "color-mix(in srgb, var(--primary) 30%, transparent)" }}
                      />
                    </Link>
                  </MotionDiv>
                ))}
              </div>
            </MotionSection>

          </div>
        </section>

        {/* ── DIVIDER ── */}
        <MotionDiv
          {...fade(0.28)}
          className="flex items-center gap-5 mb-24 md:mb-32"
        >
          <div
            className="h-px flex-1"
            style={{ background: "color-mix(in srgb, var(--primary) 10%, transparent)" }}
          />
          <span
            className="text-xl font-black"
            style={{ color: "var(--primary)", opacity: 0.15 }}
          >⚝</span>
          <div
            className="h-px flex-1"
            style={{ background: "color-mix(in srgb, var(--primary) 10%, transparent)" }}
          />
        </MotionDiv>

        {/* ── GARDEN OF SINS: dos columnas en desktop ── */}
        <MotionSection {...fade(0.3)} className="mb-24 md:mb-32">
          <div className="flex flex-col md:flex-row md:gap-16 md:items-center">

            {/* Columna izquierda: título */}
            <div className="shrink-0 mb-10 md:mb-0 text-center md:text-left">
              <h2
                className="font-black italic uppercase leading-[0.9]"
                style={{
                  color: "var(--primary)",
                  fontSize: "clamp(2.4rem, 5.5vw, 5rem)",
                  letterSpacing: "-0.02em",
                }}
              >
                Garden<br />of Sins
              </h2>
            </div>

            {/* Columna derecha: texto */}
            <div className="flex-1 min-w-0 flex items-center">
              <MotionDiv
                className="relative pl-8 py-6 pr-6 w-full"
                style={{
                  background: "color-mix(in srgb, var(--primary) 4%, var(--white-custom))",
                  borderRadius: "var(--radius-card)",
                  borderLeft: "3px solid color-mix(in srgb, var(--primary) 35%, transparent)",
                }}
                transition={{ duration: 0.22 }}
                whileHover={{ x: 4 }}
              >
                <span
                  className="absolute top-3 left-5 text-5xl font-black leading-none select-none"
                  style={{ color: "var(--primary)", opacity: 0.08, fontFamily: "serif" }}
                >&quot;</span>
                <TextoEditable
                  as="p"
                  className="relative text-base md:text-lg font-light italic leading-relaxed"
                  isAdmin={isAdmin}
                  onGuardar={(nuevoValor) => guardarTexto("garden_of_sins", nuevoValor)}
                  style={{ color: "var(--primary)", opacity: 0.7 }}
                  valor={textos.garden_of_sins}
                />
              </MotionDiv>
            </div>

          </div>
        </MotionSection>

        {/* ── REDES SOCIALES ── */}
        <MotionSection {...fade(0.36)} className="flex flex-col items-center text-center space-y-10">
          <div
            className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.4em]"
            style={{ color: "var(--primary)", opacity: 0.3 }}
          >
            Redes Sociales
          </div>

          <div className="w-full grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {
                label: "Dibujos",
                handle: "@franiloverart",
                href: "https://www.instagram.com/franiloverart/",
                icon: <Instagram size={20} strokeWidth={1.5} style={{ opacity: 0.65 }} />,
              },
              {
                label: "Fotos",
                handle: "@franilover",
                href: "https://www.instagram.com/franilover/",
                icon: <Instagram size={20} strokeWidth={1.5} style={{ opacity: 0.65 }} />,
              },
              {
                label: "YouTube",
                handle: "@franilover",
                href: "https://youtube.com/@franilover",
                icon: <Youtube size={20} strokeWidth={1.5} style={{ opacity: 0.65 }} />,
              },
              {
                label: "TikTok",
                handle: "@franilover",
                href: "https://tiktok.com/@franilover",
                icon: (
                  <svg fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" style={{ opacity: 0.65 }} viewBox="0 0 24 24" width="20">
                    <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
                  </svg>
                ),
              },
            ].map((social, i) => (
              <MotionA
                key={social.label}
                href={social.href}
                rel="noopener noreferrer"
                target="_blank"
                {...fade(0.38 + i * 0.06)}
                className="group relative flex flex-col items-center gap-3 p-6 overflow-hidden cursor-pointer no-underline"
                style={{
                  background: "var(--white-custom)",
                  borderRadius: "var(--radius-card)",
                  border: "var(--border-width) solid color-mix(in srgb, var(--primary) 10%, transparent)",
                  boxShadow: "var(--shadow-card)",
                }}
                transition={{ duration: 0.22 }}
                whileHover={{ y: -4 }}
              >
                <div
                  className="w-10 h-10 flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
                  style={{
                    borderRadius: "var(--radius-btn)",
                    background: "color-mix(in srgb, var(--primary) 8%, transparent)",
                    color: "var(--primary)",
                  }}
                >
                  {social.icon}
                </div>
                <div className="space-y-0.5">
                  <p
                    className="font-black text-sm leading-snug"
                    style={{ color: "var(--primary)", letterSpacing: "-0.01em" }}
                  >{social.label}</p>
                  <p
                    className="text-micro font-medium"
                    style={{ color: "var(--primary)", opacity: 0.35 }}
                  >{social.handle}</p>
                </div>
                <div
                  className="absolute bottom-0 left-0 h-[2px] w-0 group-hover:w-full transition-all duration-500 ease-out rounded-full"
                  style={{ background: "color-mix(in srgb, var(--primary) 30%, transparent)" }}
                />
              </MotionA>
            ))}
          </div>
        </MotionSection>

      </main>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
    </MotionMain>
  );
}
