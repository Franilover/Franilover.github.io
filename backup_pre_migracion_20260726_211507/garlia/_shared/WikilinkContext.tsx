"use client";

/**
 * WikilinkContext
 * ──────────────────────────────────────────────────────────────────────────────
 * Contexto React que conecta [[wikilinks]] con la navegación de editorEntidades.
 *
 * PROBLEMA QUE RESUELVE:
 *   Navegar a una entidad desde un wikilink requiere DOS acciones simultáneas:
 *     1. Cambiar el tab activo (ej: "personajes")
 *     2. Seleccionar el item (setSelectedId)
 *   Si solo se hace una de las dos, la navegación falla silenciosamente.
 *
 * CÓMO USARLO en editorEntidades.tsx:
 *
 *   import { WikilinkProvider } from "./WikilinkContext";
 *
 *   const handleWikilinkNavigate = useCallback((target: string) => {
 *     const norm = (s: string) =>
 *       s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
 *     const t = norm(target);
 *
 *     const collections = [
 *       { tab: "personajes" as TabKey, items: allItems.personajes },
 *       { tab: "criaturas"  as TabKey, items: allItems.criaturas  },
 *       { tab: "items"      as TabKey, items: allItems.items      },
 *       { tab: "reinos"     as TabKey, items: allItems.reinos     },
 *     ];
 *
 *     for (const { tab, items } of collections) {
 *       const found =
 *         items.find(i => norm(i.nombre) === t) ??
 *         items.find(i => norm(i.nombre).startsWith(t)) ??
 *         items.find(i => norm(i.nombre).includes(t));
 *       if (found) {
 *         setActiveTab(tab);        // ← cambiar tab PRIMERO
 *         setSelectedId(found.id);  // ← luego seleccionar
 *         return;
 *       }
 *     }
 *   }, [allItems]);
 *
 *   // Envolver el árbol con el provider:
 *   <WikilinkProvider onWikilink={handleWikilinkNavigate}>
 *     <EditorPersonaje ... />
 *     <EditorCriatura  ... />
 *   </WikilinkProvider>
 */

import React, { createContext, useContext, useCallback } from "react";

import type { SnippetAction } from "@/components/forms/Markdown/commandItems";

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface WikilinkContextValue {
  /** Navegar a una entidad por nombre (texto crudo del wikilink). */
  onWikilink: (target: string) => void;
  /** Adapter para MarkdownEditor.onSnippetAction — solo maneja { type: "wikilink" }. */
  onSnippetAction: (action: SnippetAction) => void;
}

// ── Contexto ──────────────────────────────────────────────────────────────────
const WikilinkContext = createContext<WikilinkContextValue | null>(null);

// ── Hook ──────────────────────────────────────────────────────────────────────
/**
 * Devuelve el contexto de wikilinks.
 * Fuera del provider → noops (no crashea, solo no navega).
 */
export function useWikilink(): WikilinkContextValue {
  const ctx = useContext(WikilinkContext);
  if (!ctx) {
    return {
      onWikilink: () => {},
      onSnippetAction: () => {},
    };
  }
  return ctx;
}

// ── Provider ──────────────────────────────────────────────────────────────────
interface WikilinkProviderProps {
  onWikilink: (target: string) => void;
  children: React.ReactNode;
}

export function WikilinkProvider({ onWikilink, children }: WikilinkProviderProps) {
  const onSnippetAction = useCallback((action: SnippetAction) => {
    if (action.type === "wikilink") {
      onWikilink(action.target);
    }
    // "choice", "section", "use", "drop", "sound", "img", "float" → lector de ensayos, ignorar
  }, [onWikilink]);

  return (
    <WikilinkContext.Provider value={{ onWikilink, onSnippetAction }}>
      {children}
    </WikilinkContext.Provider>
  );
}