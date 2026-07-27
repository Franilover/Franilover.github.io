"use client";

import { PanelLeftClose, PanelLeftOpen, RefreshCw, Search, WifiOff, X } from "lucide-react";
import React, { useState } from "react";

export interface EstudioLayoutProps {
  titulo: string;
  icono: React.ReactNode;
  colapsadoLabel?: string;
  onRefetch?: () => void;
  busqueda?: string;
  onBusquedaChange?: (v: string) => void;
  busquedaPlaceholder?: string;
  headerExtra?: React.ReactNode;
  sidebarContent: React.ReactNode;
  isOffline?: boolean;
  footerLeft?: React.ReactNode;
  footerRight?: React.ReactNode;
  sidebarOpen?: boolean;
  onSidebarOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export function EstudioLayout({
  titulo,
  icono,
  colapsadoLabel,
  onRefetch,
  busqueda = "",
  onBusquedaChange,
  busquedaPlaceholder = "Buscar…",
  headerExtra,
  sidebarContent,
  isOffline = false,
  footerLeft,
  footerRight,
  sidebarOpen: externalOpen,
  onSidebarOpenChange,
  children,
}: EstudioLayoutProps) {

  const [internalOpen, setInternalOpen] = useState(true);

  const isOpen = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = (v: boolean) => {
    if (onSidebarOpenChange) onSidebarOpenChange(v);
    else setInternalOpen(v);
  };

  return (
    <div className="flex h-screen bg-bg-main overflow-hidden relative">

      {}
      {!isOpen && (
        <div className="hidden md:flex shrink-0 w-10 flex-col items-center pt-6 gap-4 border-r border-primary/10 bg-bg-main">
          <button
            className="p-2 rounded-xl hover:bg-primary/10 text-primary/30 hover:text-primary transition-all"
            title="Abrir panel"
            onClick={() => setOpen(true)}
          >
            <PanelLeftOpen size={16} />
          </button>
          {colapsadoLabel && (
            <span
              className="text-micro font-black uppercase text-primary/15 tracking-[0.25em] select-none"
              style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
            >
              {colapsadoLabel}
            </span>
          )}
        </div>
      )}

      {}
      {isOpen && (
        <aside className="
          fixed inset-x-0 top-[41px] bottom-14 z-50 flex flex-col bg-bg-main
          md:relative md:inset-auto md:top-auto md:bottom-auto md:z-auto md:w-72 md:shrink-0
          border-r border-primary/10 shadow-2xl md:shadow-none
        ">

          {}
          <div className="px-5 pt-6 pb-4 border-b border-primary/10 shrink-0 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-black uppercase tracking-[0.3em] text-primary/50 flex items-center gap-2">
                {icono} {titulo}
              </h2>
              <div className="flex items-center gap-1">
                {onRefetch && (
                  <button
                    className="p-1.5 rounded-lg hover:bg-primary/10 text-primary/30 hover:text-primary transition-all"
                    title="Recargar"
                    onClick={onRefetch}
                  >
                    <RefreshCw size={12} />
                  </button>
                )}
                <button
                  className="p-1.5 rounded-lg hover:bg-primary/10 text-primary/30 hover:text-primary transition-all"
                  title="Cerrar panel"
                  onClick={() => setOpen(false)}
                >
                  <PanelLeftClose size={14} />
                </button>
              </div>
            </div>

            {}
            {onBusquedaChange && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/30" size={13} />
                <input
                  className="w-full bg-input-bg border border-primary/10 rounded-xl pl-9 pr-9 py-3 md:py-2.5 text-sm md:text-xs font-medium text-input-text outline-none focus:border-primary/30 placeholder:text-primary/25 transition-colors"
                  placeholder={busquedaPlaceholder}
                  value={busqueda}
                  onChange={e => onBusquedaChange(e.target.value)}
                />
                {busqueda && (
                  <button
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-primary/30 hover:text-primary"
                    onClick={() => onBusquedaChange("")}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            )}

            {headerExtra}
          </div>

          {}
          <div className="flex-1 overflow-y-auto px-3 py-3 [&>*]:md:text-xs [&_button]:min-h-[2.75rem] md:[&_button]:min-h-0">
            {sidebarContent}
          </div>

          {}
          <div className="shrink-0 px-5 py-3 border-t border-primary/10 text-micro font-black uppercase tracking-widest flex justify-between items-center">
            {isOffline ? (
              <span className="flex items-center gap-1 text-amber-400">
                <WifiOff size={10} /> Sin conexión
              </span>
            ) : (
              <span className="text-primary/20">{footerLeft}</span>
            )}
            {footerRight && (
              <span className="text-primary/20">{footerRight}</span>
            )}
          </div>
        </aside>
      )}

      {}
      <main className="flex-1 flex flex-col min-w-0 min-h-0 w-full overflow-hidden">

        {}
        {!isOpen && (
          <div className="md:hidden shrink-0 px-4 py-2 border-b border-primary/10 flex items-center">
            <button
              className="flex items-center gap-2 p-2 rounded-xl hover:bg-primary/10 text-primary/40 hover:text-primary transition-all"
              onClick={() => setOpen(true)}
            >
              <PanelLeftOpen size={16} />
              <span className="text-micro font-black uppercase tracking-widest">Lista</span>
            </button>
          </div>
        )}

        {children}
      </main>

    </div>
  );
}

export default EstudioLayout;