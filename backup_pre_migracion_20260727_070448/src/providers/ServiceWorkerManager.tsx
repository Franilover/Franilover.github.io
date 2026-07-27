"use client";

import { useEffect } from "react";

import { estaEnTauri } from "@/lib/utils/navegacionTauri";

/**
 * ServiceWorkerManager
 * ─────────────────────────────────────────────────────────────────────────────
 * El SW (next-pwa, ver public/custom-sw.js) tiene sentido en la web
 * (franilover.vercel.app) para offline/instalación como PWA. Dentro de la
 * app de Tauri es REDUNDANTE Y PELIGROSO:
 *
 * - El offline ya lo da el propio APK empaquetado (todo el /out vive en
 *   disco, servido por el protocolo garlia://), no hace falta cachear nada
 *   con Workbox.
 * - El SW queda registrado en el storage del WebView de Android, que NO se
 *   borra al actualizar el APK (solo al desinstalar o limpiar datos de la
 *   app a mano). Su ruta de navegación (NetworkFirst con fallback a caché)
 *   puede terminar sirviendo HTML/JS de una versión vieja de la app aunque
 *   el APK instalado sea el último — exactamente el síntoma de "ya
 *   reinstalé pero sigue fallando".
 *
 * Este componente:
 * 1. En Tauri: desregistra cualquier SW que haya quedado de una versión
 *    vieja (cuando `next-pwa` sí se registraba sin esta guarda) y borra sus
 *    cachés, para que los celus que ya tienen el bug instalado se autocuren
 *    solos la primera vez que abren la versión nueva. No registra ninguno
 *    nuevo.
 * 2. En web: no hace nada — next-pwa se sigue registrando solo, como
 *    siempre (ver next.config.mjs, register condicionado a esto).
 */
export function ServiceWorkerManager() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (!estaEnTauri()) {
      // Reemplaza el auto-registro que next-pwa hacía antes (ahora
      // register: false en next.config.mjs, ver comentario ahí).
      navigator.serviceWorker.register("/sw.js").catch(() => {});
      return;
    }

    let cancelado = false;

    (async () => {
      try {
        const registros = await navigator.serviceWorker.getRegistrations();
        if (registros.length === 0) return;

        await Promise.all(registros.map((r) => r.unregister()));

        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }

        // Ya había un SW viejo interceptando navegación: recargamos una
        // sola vez (guardado en sessionStorage) para que la página actual
        // deje de estar bajo su control inmediatamente, en vez de esperar
        // a la próxima apertura de la app.
        if (!cancelado && !sessionStorage.getItem("sw-limpiado")) {
          sessionStorage.setItem("sw-limpiado", "1");
          window.location.reload();
        }
      } catch {
        // Si algo de esto falla, no rompemos el arranque de la app por
        // esto — es una limpieza de best-effort.
      }
    })();

    return () => {
      cancelado = true;
    };
  }, []);

  return null;
}
