// Se define en build time: BUILD_TARGET=tauri (o NEXT_PUBLIC_BUILD_TARGET=tauri)
// en el script/CI que arma el bundle para el APK. En Vercel no se define nada,
// así que por default es el build "web" (SSR normal, sin output:"export").
export const IS_TAURI_BUILD =
  process.env.NEXT_PUBLIC_BUILD_TARGET === "tauri";
