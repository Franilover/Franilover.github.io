import { Suspense } from "react";
import ListaConversaciones from "@/domains/personal/mensajes/ListaConversaciones";

// Layout estilo "WhatsApp Web" para /personal/mensajes:
//
// - Desktop (md+): sidebar fija con la lista de conversaciones a la
//   izquierda + el panel de chat (children: page.tsx o detalle/page.tsx)
//   a la derecha, ambos dentro de un mismo alto de pantalla.
// - Mobile: se mantiene el comportamiento original de pantalla completa
//   (una sola vista a la vez, navegando con router.push). La sidebar se
//   oculta y children ocupa toda la pantalla.
//
// Nada de la lógica interna de bibliotecaMensajes / detalleConversacion
// cambia: solo se los envuelve visualmente en desktop.
export default function MensajesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="md:h-screen md:flex md:overflow-hidden bg-bg-main">
      {/* Sidebar: solo visible en md+ */}
      <aside
        className="hidden md:flex md:flex-col md:w-[360px] lg:w-[400px] flex-shrink-0 h-full"
        style={{
          borderRight: "1px solid color-mix(in srgb, var(--primary) 10%, transparent)",
        }}
      >
        <div className="px-5 pt-6 pb-2">
          <h1 className="text-2xl font-black text-primary italic tracking-tighter uppercase">
            Mensajes
          </h1>
        </div>
        <Suspense fallback={null}>
          <ListaConversaciones variante="sidebar" className="flex-1" />
        </Suspense>
      </aside>

      {/* Panel derecho: en mobile es la única vista (children ocupa todo);
          en desktop queda al lado de la sidebar. */}
      <main className="flex-1 min-w-0 md:h-full md:overflow-y-auto">{children}</main>
    </div>
  );
}
