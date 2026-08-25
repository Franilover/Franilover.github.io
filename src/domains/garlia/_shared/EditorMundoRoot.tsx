"use client";

/**
 * EditorMundoRoot
 * ───────────────────────────────────────────────────────────────────────────
 * Reemplaza:
 *   - features/editorGarlia/views/editorGarlia.tsx  (823 líneas, orquestador)
 *   - features/editorGarlia/views/EditorMundo.tsx    (2395 líneas, panel único)
 *
 * Por un shell delgado (~90 líneas) que:
 *   1. Lee el store de navegación (useMundoNavigation, Zustand — sin Provider,
 *      se importa y usa directamente donde haga falta).
 *   2. Conecta la paleta de comandos externa vía un solo puente tipado.
 *   3. Renderiza SOLO la sección activa, con code-splitting (React.lazy),
 *      así el usuario no descarga el editor de letras de canciones para
 *      editar un personaje.
 *
 * Navegación: vive por completo en la navbar global
 * (layout/navbar.tsx, submenú admin), que lee y escribe
 * useMundoNavigation directamente. Este shell solo renderiza la sección
 * activa — no dibuja ninguna barra de navegación propia.
 *
 * Requiere: npm install zustand (verificado zustand@5.0.14 + TS strict).
 *
 * Cada sección (personajes, criaturas, magia, etc.) es un feature
 * independiente que trae sus propios datos vía useSupabaseData("tabla") —
 * sin funciones dexieReadAll/dexieWriteAll duplicadas, sin estado compartido
 * con las demás secciones. Si "Criaturas" tiene un bug, "Personajes" no se
 * entera ni se re-renderiza.
 */

import { Loader2, WifiOff } from "lucide-react";
import React, { lazy, Suspense } from "react";

import { AdminOnly } from "@/ui/AdminOnly";
import { WikilinkProvider } from "@/domains/garlia/_shared/WikilinkContext";

import { useMundoNavigation } from "@/domains/garlia/_shared/useMundoNavigationStore";
import { useExternalCommandBridge } from "@/domains/garlia/_shared/useExternalCommandBridge";
import { MundoHomeContent } from "@/domains/garlia/_shared/MundoHomeContent";
import { useCreateEntity } from "@/domains/garlia/_shared/useCreateEntity";
import { useWikilinkNavigate } from "@/domains/garlia/_shared/useWikilinkNavigate";
import { EntityTabBar } from "@/domains/garlia/_shared/EntityTabBar";
import { PanelFlotanteGlobal } from "@/domains/garlia/_shared/PanelFlotanteGlobal";
import { EnsayoGosScreen } from "@/domains/plataforma/puentes/EnsayoGosScreen";

// ─── Code-splitting por página combinada ──────────────────────────────────
// Personajes/Criaturas/Items/Reinos/Ciudades/Runas/Grupos/
// Notas/Letras viven TODOS en EntidadesPage (una sola grilla grande de
// tarjetas). Runas y Letras se muestran como páginas
// independientes (sin la sub-barra de Reinos/Criaturas/Organización, que es
// exclusiva de la sección "Entidades").
const EntidadesPage = lazy(() =>
  import("./EntidadesPage").then((m) => ({ default: m.EntidadesPage })),
);
const CapitulosSection = lazy(() =>
  import("@/domains/garlia/libros/CapitulosSection").then((m) => ({ default: m.CapitulosSection })),
);
const LibroDocumentoSection = lazy(() =>
  import("@/domains/garlia/libros/LibroDocumentoSection").then((m) => ({
    default: m.LibroDocumentoSection,
  })),
);
const MapaSection = lazy(() =>
  import("./MapaSection").then((m) => ({ default: m.MapaSection })),
);
const LineaTiempoSection = lazy(() =>
  import("@/domains/garlia/libros/LineaTiempoSection").then((m) => ({ default: m.LineaTiempoSection })),
);
const AventuraSection = lazy(() =>
  import("@/domains/garlia/aventuras/AventuraSection").then((m) => ({ default: m.AventuraSection })),
);
const ElementosSection = lazy(() =>
  import("@/domains/garlia/elementos/ElementosSection").then((m) => ({
    default: m.ElementosSection,
  })),
);
const EstadoMaestroPanel = lazy(() =>
  import("@/domains/garlia/auditoria/EstadoMaestroPanel").then((m) => ({
    default: m.EstadoMaestroPanel,
  })),
);

function SectionFallback() {
  return (
    <div className="flex-1 flex items-center justify-center text-primary/30">
      <Loader2 className="animate-spin" size={20} />
    </div>
  );
}

function ActiveSection() {
  const section = useMundoNavigation((s) => s.section);
  const selectedId = useMundoNavigation((s) => s.selectedId);
  const closeTab = useMundoNavigation((s) => s.closeTab);

  switch (section) {
    case null:
      return <MundoHomeContent />;
    case "personajes":
    case "criaturas":
    case "ecosistemas":
    case "biomas":
    case "flora":
    case "minerales":
    case "items":
    case "reinos":
    case "ciudades":
    case "runas":
    case "grupos":
    case "notas":
    case "letras":
      return <EntidadesPage section={section} selectedId={selectedId} />;
    case "elementos":
      // Tabla Química/Alquímica: fuera de EntidadesPage porque trae su
      // propio hook de datos (useElementos) — igual que Mapa/Aventura,
      // no comparte el mega-grid de Entidades/Geografía/Organización.
      return <ElementosSection selectedId={selectedId} />;
    case "auditoria":
      // Dashboard de auditoría "Estado del Mundo" (Fase 1, Paso 0-3): por
      // ahora solo el panel Estado Maestro; Auditoría/Alertas se suman acá
      // mismo cuando estén listos (Paso 4-6), sin otro toque de navegación.
      return <EstadoMaestroPanel />;
    case "notas-gos":
      // Reusa el mismo editor de ensayos que EnsayosShell (/myself/escritorio),
      // pero ahora como pestaña más dentro de Mundo — igual que runas/personajes.
      return selectedId ? (
        <EnsayoGosScreen
          key={selectedId}
          ensayoId={selectedId}
          onClose={() => closeTab("notas-gos", selectedId)}
        />
      ) : null;
    case "capitulos":
      // selectedId puntual = pestaña de "documento completo" de un libro
      // (abierta con openEntity("capitulos", libroId) desde el botón junto
      // al nombre del libro en la sidebar). Pantalla completa, sin el
      // sidebar de libros/capítulos ni nada del editor alrededor — ver
      // LibroDocumentoSection. Sin selectedId, vista normal del editor.
      return selectedId ? <LibroDocumentoSection /> : <CapitulosSection />;
    case "mapa":
      return <MapaSection />;
    case "linea-tiempo":
      return <LineaTiempoSection />;
    case "aventura":
      return <AventuraSection />;
    default: {
      // Chequeo de exhaustividad: si TypeScript se queja acá de que
      // `section` no es `never`, significa que se agregó un SectionKey
      // nuevo sin sumar su case arriba — mismo bug que causó que "biomas"
      // abriera la pestaña pero renderizara en blanco (caía silenciosamente
      // acá, sin error de build).
      const _exhaustive: never = section;
      void _exhaustive;
      return null;
    }
  }
}

function EditorMundoInner() {
  const createEntity = useCreateEntity();
  useExternalCommandBridge(createEntity);
  const handleWikilinkNavigate = useWikilinkNavigate();

  // Estado de red se resuelve dentro de cada useSupabaseData por sección;
  // acá solo mostramos el banner si el navegador reporta offline, sin
  // duplicar la lógica de detección.
  const [isOffline, setIsOffline] = React.useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false,
  );
  React.useEffect(() => {
    const on = () => setIsOffline(false);
    const off = () => setIsOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  return (
    <div
      className="flex flex-col w-full overflow-hidden"
      style={{ background: "var(--bg-main)", height: "100dvh" }}
    >
      {isOffline && (
        <div className="shrink-0 flex items-center justify-center gap-2 py-1.5 text-micro font-black uppercase tracking-widest text-orange-400">
          <WifiOff size={10} /> Sin conexión · algunos datos pueden estar desactualizados
        </div>
      )}
      <EntityTabBar />
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <WikilinkProvider onWikilink={handleWikilinkNavigate}>
          <Suspense fallback={<SectionFallback />}>
            <ActiveSection />
          </Suspense>
        </WikilinkProvider>
      </div>
      <PanelFlotanteGlobal />
    </div>
  );
}

export default function EditorMundoRoot() {
  return (
    <AdminOnly>
      <EditorMundoInner />
    </AdminOnly>
  );
}
