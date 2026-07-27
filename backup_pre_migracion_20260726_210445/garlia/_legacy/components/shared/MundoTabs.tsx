"use client";

/**
 * MundoTabs
 * ───────────────────────────────────────────────────────────────────────────
 * Navbar secundaria fija arriba del editor de mundo, siempre visible.
 * Reemplaza a <MundoMenu /> (sidebar, código muerto) y a <MundoHomeDashboard />
 * (pantalla de bienvenida cuando section === null): ahora no hay pantalla
 * intermedia, las tabs llevan directo a cada página.
 *
 * Tabs:
 *   - Inicio          → resumen, favoritos y recientes (antes vivía en el
 *                       dashboard de bienvenida; ver MundoHomeContent)
 *   - Entidades       → <EntidadesPage /> (personajes/criaturas/items/
 *                       reinos/ciudades/hechizos/dones/runas/grupos/notas/
 *                       letras)
 *   - Mapa            → <MapaSection />
 *   - Capítulos       → <CapitulosSection />
 *   - Línea de Tiempo → <LineaTiempoSection />
 *
 * "activeTab" se deriva de section: cualquier SectionKey de Entidades marca
 * la tab "entidades" activa; el resto son 1 a 1 con su SectionKey.
 */

import { Clock, Compass, Home, Mountain, ScrollText, Users } from "lucide-react";
import React from "react";

import { useMundoNavigation, type SectionKey } from "../../hooks/mundo/useMundoNavigationStore";

const ENTIDADES_SECTIONS: SectionKey[] = [
  "personajes",
  "criaturas",
  "items",
  "reinos",
  "ciudades",
  "hechizos",
  "dones",
  "runas",
  "grupos",
  "notas",
  "letras",
];

type TabKey = "inicio" | "entidades" | "mapa" | "capitulos" | "linea-tiempo" | "aventura";

interface Tab {
  key: TabKey;
  label: string;
  Icon: React.ElementType;
}

const TABS: Tab[] = [
  { key: "inicio", label: "Inicio", Icon: Home },
  { key: "aventura", label: "Aventura", Icon: Compass },
  { key: "entidades", label: "Entidades", Icon: Users },
  { key: "mapa", label: "Mapa", Icon: Mountain },
  { key: "capitulos", label: "Capítulos", Icon: ScrollText },
  { key: "linea-tiempo", label: "Línea de Tiempo", Icon: Clock },
];

function tabKeyOf(section: SectionKey | null): TabKey {
  if (section === null) return "inicio";
  if (section === "mapa") return "mapa";
  if (section === "capitulos") return "capitulos";
  if (section === "linea-tiempo") return "linea-tiempo";
  if (section === "aventura") return "aventura";
  if (ENTIDADES_SECTIONS.includes(section)) return "entidades";
  return "inicio";
}

export function MundoTabs() {
  const section = useMundoNavigation((s) => s.section);
  const selectSection = useMundoNavigation((s) => s.selectSection);
  const goToMenu = useMundoNavigation((s) => s.goToMenu);
  const activeTab = tabKeyOf(section);

  const handleClick = (tab: TabKey) => {
    if (tab === "inicio") return goToMenu();
    if (tab === "entidades") return selectSection("personajes");
    return selectSection(tab);
  };

  return (
    <div className="shrink-0 border-b border-primary/10" style={{ background: "var(--bg-main)" }}>
      <nav className="flex items-center gap-1 px-4 py-2" aria-label="Secciones del editor de mundo">
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleClick(tab.key)}
              className={`flex-1 flex items-center justify-center px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                active
                  ? "bg-primary/10 text-primary"
                  : "text-primary/50 hover:bg-primary/5 hover:text-primary/80"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
