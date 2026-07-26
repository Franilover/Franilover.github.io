"use client";




import { Instagram, Youtube } from "lucide-react";
import React, { useState } from "react";





import { MotionA, MotionDiv, MotionH1, MotionMain, MotionSection } from '@/components/ui/Motion';
import { ToastContainer } from "@/components/ui/ToastContainer";
import { useToast } from "@/hooks/ui/useToast";





const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.55, delay, ease: [0.25, 0.1, 0.25, 1] as any },
});





const TOOLS = [
  { num: "01", title: "Arch Linux",       },
  { num: "02",  title: "Krita", },
  { num: "03",  title: "Reaper", },
];





export default function SobreMi() {
  const FORMSPREE_ID = "xvzpjdgr";
  const [_enviado, setEnviado] = useState(false);
  const [_loading, setLoading] = useState(false);
  const { toasts, toast, dismiss } = useToast();

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
                <p
                  className="text-xl md:text-2xl leading-[1.5] font-light italic"
                  style={{ color: "var(--primary)", opacity: 0.88 }}
                >
                  Bienvenido a mi pequeño jardín digital. Uso este espacio para compartir mis hobbys y
                  proyectos: Mi mayor proyecto es &quot;Garden of Sins&quot; el cual puedes ver en el icono de la flor.
                </p>
              </MotionSection>
            </div>

            {/* Columna derecha: herramientas en columna */}
            <MotionSection {...fade(0.24)} className="mt-10 md:mt-0 md:w-[28%] shrink-0">
              <div
                className="flex items-center justify-center gap-2 text-sm font-black uppercase tracking-[0.4em] mb-6"
                style={{ color: "var(--primary)", opacity: 0.3 }}
              >
                Herramientas
              </div>

              <div className="flex flex-col gap-4">
                {TOOLS.map((tool, i) => {
                  return (
                    <MotionDiv
                      key={tool.num}
                      {...fade(0.28 + i * 0.07)}
                      className="group relative flex items-center justify-center gap-4 p-5 overflow-hidden cursor-default text-center"
                      style={{
                        background: "var(--white-custom)",
                        borderRadius: "var(--radius-card)",
                        border: "var(--border-width) solid color-mix(in srgb, var(--primary) 10%, transparent)",
                        boxShadow: "var(--shadow-card)",
                      }}
                      transition={{ duration: 0.22 }}
                      whileHover={{ x: 4 }}
                    >

                      <div className="relative z-10 space-y-0.5 text-left">
                        <h4
                          className="font-black text-l leading-snug"
                          style={{ color: "var(--primary)", letterSpacing: "-0.02em" }}
                        >{tool.title}</h4>
                      </div>

                      <div
                        className="absolute bottom-0 left-0 h-[2px] w-0 group-hover:w-full transition-all duration-500 ease-out rounded-full"
                        style={{ background: "color-mix(in srgb, var(--primary) 30%, transparent)" }}
                      />
                    </MotionDiv>
                  );
                })}
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
                <p
                  className="relative text-base md:text-lg font-light italic leading-relaxed"
                  style={{ color: "var(--primary)", opacity: 0.7 }}
                >
                  Este proyecto comenzo como una forma de compartir experiencias que no era capas de expresar verbalmente
                  y a la vez explorar nuevas formas de arte.
                  Luego se convirtio en algo mas grande. Ya no era solo mi historia, era un mundo entero que necesitaba
                  sacar de mi mente. <br /><br /> Los personajes de este mundo surgieron en base a personas que han dejado una marca
                  en mi. Y pese a que los temas de esta historia son recurrentes en la actualidad, y muchos aconteciemtos
                  estan basados en ciertos periodos historicos todo lo contado en estas historias es ficticio.
                </p>
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