// next.config.mjs
import withPWAInit from "next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  // El registro automático de next-pwa no distingue web de Tauri — se
  // desactiva acá y se maneja a mano en ServiceWorkerManager.tsx, que
  // registra solo en web y activamente desregistra/limpia dentro de Tauri
  // (ver el comentario largo en ese archivo).
  register: false,
  skipWaiting: true,
  buildExcludes: [/middleware-manifest\.json$/],
  swSrc: "public/custom-sw.js",
  sw: "sw.js",
});

const nextConfig = {
  // Solo el build empaquetado en el APK necesita export estático puro.
  // El deploy de Vercel corre con SSR normal, así que sí puede tener rutas
  // dinámicas [slug] con metadata real por página (título/OG/descripción).
  // Se activa poniendo NEXT_PUBLIC_BUILD_TARGET=tauri en el script/CI que
  // arma el bundle para Tauri (src-tauri o el workflow que lo dispare).
  output: process.env.NEXT_PUBLIC_BUILD_TARGET === "tauri" ? "export" : undefined,
  eslint: {
    ignoreDuringBuilds: true,
  },
  turbopack: {},
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ftdxthnizdosaaavjhah.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "raw.githubusercontent.com",
        pathname: "/**",
      },
    ],
  },
};

export default withPWA(nextConfig);