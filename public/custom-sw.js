import { ExpirationPlugin } from "workbox-expiration";
import { precacheAndRoute } from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from "workbox-strategies";

// ── Precaché de assets estáticos generados por Next.js ───────────────────────
precacheAndRoute(self.__WB_MANIFEST);

// Identificador único de ESTE build, para usar en nombres de cache que
// necesitan cambiar en cada deploy (ver STATIC_CACHE_NAME más abajo). Se
// arma concatenando las revisiones (hashes de contenido) de las primeras
// entradas del manifest de precache — Workbox ya calcula esas revisiones
// por archivo en cada build, así que dos builds distintos casi seguro
// difieren acá aunque tengan la misma CANTIDAD de archivos (a diferencia de
// usar solo `.length`, que sí puede repetirse entre builds).
const BUILD_ID = (self.__WB_MANIFEST || [])
  .slice(0, 5)
  .map((entry) => entry.revision || entry.url)
  .join("-")
  .slice(0, 40) || "v1";

// ── Imágenes: CacheFirst ──────────────────────────────────────────────────────
registerRoute(
  ({ request, url }) =>
    request.destination === "image" ||
    url.origin.includes("githubusercontent.com") ||
    url.hostname.includes("supabase.co"),
  new CacheFirst({
    cacheName: "franilover-images-cache",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 60 * 24 * 60 * 60,
      }),
    ],
  })
);

// ── Assets JS/CSS: CacheFirst ─────────────────────────────────────────────────
//
// BUG que esto arregla: antes usaba StaleWhileRevalidate, que por diseño
// sirve SIEMPRE la respuesta cacheada primero (si existe) y revalida en
// segundo plano — nunca bloquea al usuario esperando la red. El problema es
// que Next.js versiona estos archivos por HASH en el nombre
// (`chatEngine.[hash].js`), así que cada build genera nombres de archivo
// distintos; el archivo del build viejo simplemente deja de existir en el
// servidor (404) en vez de "actualizarse" bajo el mismo nombre. Como
// StaleWhileRevalidate ya tenía una entrada cacheada para ese nombre de
// archivo viejo, seguía sirviéndola indefinidamente sin darse cuenta de que
// ya no correspondía a ningún build activo — el usuario quedaba corriendo
// JS de un deploy anterior (con bugs ya arreglados en el código fuente)
// hasta que, por lo que sea, esa entrada se invalidaba.
//
// CacheFirst es más simple y en este caso más correcto: como el nombre del
// archivo YA incluye el hash del contenido, un mismo nombre de archivo
// siempre corresponde al mismo contenido — no hay "versión más nueva" de
// `chatEngine.abc123.js`, solo existe `chatEngine.abc123.js` (build viejo)
// o `chatEngine.def456.js` (build nuevo), y son requests DISTINTOS. Servir
// directo del caché sin revalidar es seguro y más rápido, y cuando el
// navegador carga un nuevo HTML/manifest que referencia el hash nuevo, ese
// es un cache-key distinto que fuerza ir a red igual.
registerRoute(
  ({ request }) =>
    request.destination === "script" ||
    request.destination === "style",
  new CacheFirst({
    cacheName: `franilover-static-cache-${BUILD_ID}`,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 120,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      }),
    ],
  })
);

// ── Navegación: NetworkFirst con fallback al caché ───────────────────────────
//
// IMPORTANTE: las rutas dinámicas ([id], [username], etc. — ver
// src-tauri/src/static_rewrite.rs) NO deben pasar por acá. Dentro de la app
// empaquetada de Tauri, `navegarRutaDinamica()` fuerza un
// `window.location.href` para que esa navegación llegue al protocolo
// `garlia://` de Rust, que reescribe el path hacia el `placeholder`
// correspondiente antes de servir el archivo.
//
// El Service Worker corre dentro del mismo WebView y su NavigationRoute
// intercepta CUALQUIER request de navegación (mode: 'navigate') antes de que
// le llegue al protocolo custom de Tauri. Como esas rutas con id/slug real
// nunca están en caché (solo los paths fijos en APP_ROUTES) y en la app
// empaquetada no hay red real que las resuelva vía NetworkFirst, el SW
// termina sirviendo un fallback que no es la página esperada — el síntoma
// es que la navegación "rebota": el WebView recarga como si fuera un
// arranque limpio de la app (incluso reapareciendo pantallas de solo-primer-
// arranque como el aviso de actualización disponible), en vez de mostrar la
// página del id pedido.
//
// Con este `denylist`, el SW deja pasar de largo esas rutas (no intercepta
// la navegación), y es Tauri quien las resuelve directamente vía
// `garlia://` + `rewrite_path`, tal como se diseñó.
registerRoute(
  new NavigationRoute(
    new NetworkFirst({
      cacheName: "franilover-pages-cache",
      networkTimeoutSeconds: 5,
      plugins: [
        new ExpirationPlugin({
          maxEntries: 60,
          maxAgeSeconds: 7 * 24 * 60 * 60, // 7 días
        }),
      ],
    }),
    {
      denylist: [
        /^\/garlia\/libros\/.+/,
        /^\/garlia\/canciones\/.+/,
        /^\/garlia\/personal\/.+/,
        /^\/personal\/mensajes\/.+/,
      ],
    }
  )
);

// ── Precaché de TODAS las rutas al instalar ───────────────────────────────────
// Garantiza que todas las páginas estén offline desde el primer deploy,
// sin necesidad de visitarlas una por una.
const APP_ROUTES = [
  "/",
  "/personal",
  "/personal/escritorio",
  "/personal/salud",
  "/personal/dibujos",
  "/personal/fotos",
  "/personal/ropa",
  "/personal/sobre-mi",
  "/wiki",
  "/wiki/enciclopedia",
  "/wiki/canciones",
  "/wiki/libros",
  "/wiki/mapa",
  "/wiki/personal",
  "/auth/login",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open("franilover-pages-cache").then((cache) =>
      Promise.allSettled(
        APP_ROUTES.map((route) =>
          cache.add(new Request(route, { credentials: "same-origin" }))
            .catch((err) => console.warn(`[SW] No se pudo cachear ${route}:`, err))
        )
      )
    )
  );
});

// Nombres de los caches que este build de sw.js reconoce como "vigentes".
// Cualquier cache que exista en el navegador pero NO esté en esta lista es
// de un build anterior — se purga en el activate de abajo.
const STATIC_CACHE_NAME = `franilover-static-cache-${BUILD_ID}`;
const CACHES_VIGENTES = [
  "franilover-images-cache",
  "franilover-pages-cache",
  STATIC_CACHE_NAME,
];

self.addEventListener("activate", (event) => {
  event.waitUntil(
    // BUG que esto arregla: los caches de Workbox usan nombre FIJO
    // ("franilover-pages-cache", etc.), así que nunca se limpiaban solos
    // entre deploys — cada build nuevo seguía escribiendo sobre el mismo
    // cache en vez de arrancar de cero, y entradas de builds viejos podían
    // quedar sirviéndose (sobre todo en franilover-pages-cache, que cachea
    // HTML de navegación con NetworkFirst pero igual puede quedar de
    // fallback si la red falla justo en ese momento). Ahora, en cada
    // activate, se borra cualquier cache de Workbox de este SW que no esté
    // en la lista de "vigentes" — así una activación nueva siempre arranca
    // sin arrastrar contenido de builds anteriores.
    caches
      .keys()
      .then((nombres) =>
        Promise.all(
          nombres
            .filter((nombre) => nombre.startsWith("franilover-") && !CACHES_VIGENTES.includes(nombre))
            .map((nombre) => caches.delete(nombre)),
        ),
      )
      .then(() => clients.claim()),
  );
});

// ── Background Sync ───────────────────────────────────────────────────────────
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-notas") {
    console.log("SW: Detectada conexión. Iniciando sincronización...");
  }
});

// ── Push Notifications ────────────────────────────────────────────────────────
self.addEventListener("push", function(event) {
  if (event.data) {
    try {
      const data = event.data.json();
      const options = {
        body: data.body,
        icon: "/icon.png",
        badge: "/icon.png",
        image: data.image,
        vibrate: [100, 50, 100],
        data: { url: data.url || "/" }
      };
      event.waitUntil(self.registration.showNotification(data.title, options));
    } catch (e) {
      console.error("Error Push:", e);
    }
  }
});

self.addEventListener("notificationclick", function(event) {
  event.notification.close();
  const targetUrl = event.notification.data.url;
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(windowClients => {
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if (client.url === targetUrl && "focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});