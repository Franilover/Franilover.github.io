"use client";
import { usePathname } from 'next/navigation';
import React, { useEffect, useRef } from 'react';

import { useLightbox } from "@/components/modal/lightbox";
import { supabase } from "@/infra/supabase/supabase";

const RECONNECT_AFTER_MS = 10_000;

export default function AppLogic({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { closeLightbox } = useLightbox() || {};
  const hiddenAtRef = useRef<number | null>(null);
useEffect(() => {
  hiddenAtRef.current = Date.now();
}, []);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = Date.now();
        
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      } else {
        
        const hiddenDuration = Date.now() - (hiddenAtRef.current ?? Date.now());

        if (hiddenDuration > RECONNECT_AFTER_MS) {
          
          
          reconnectTimerRef.current = setTimeout(() => {
            supabase.realtime.connect();
          }, 300);
        }
      }
    };

    const handleOnline = () => {
      
      supabase.realtime.connect();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("online", handleOnline);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("online", handleOnline);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, []);

  
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.scrollTo(0, 0);
    if (closeLightbox && typeof closeLightbox === "function") (closeLightbox as () => void)();
  }, [pathname, closeLightbox]);

  
  useEffect(() => {
    if (typeof window === "undefined") return;

    const manejarEventos = (e: Event) => {
      if (e.type === "contextmenu") {
        const target = e.target as HTMLElement;
        if (target.tagName === "TEXTAREA") return;
      }
      if (e.type === "contextmenu" || e.type === "dragstart") e.preventDefault();
      const ke = e as KeyboardEvent;
      // Ctrl+K reservado para la paleta de comandos — no interceptar
      if (ke.key === "k" && (ke.ctrlKey || ke.metaKey)) return;
      if ((ke.ctrlKey || ke.metaKey) && (ke.key === "s" || ke.key === "p" || ke.key === "u")) {
        e.preventDefault();
      }
      if (ke.key === "F12") e.preventDefault();
    };

    document.addEventListener("contextmenu", manejarEventos);
    document.addEventListener("dragstart",   manejarEventos);
    document.addEventListener("keydown",     manejarEventos);

    return () => {
      document.removeEventListener("contextmenu", manejarEventos);
      document.removeEventListener("dragstart",   manejarEventos);
      document.removeEventListener("keydown",     manejarEventos);
    };
  }, []);

  return (
    <div className="app-container h-full flex flex-col">
      <main className="flex-1 min-h-0 pb-16 pb-[env(safe-area-inset-bottom,4rem)] md:pb-0">
        {children}
      </main>
    </div>
  );
}