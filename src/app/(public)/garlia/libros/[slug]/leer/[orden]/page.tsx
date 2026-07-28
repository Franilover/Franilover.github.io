import Lector from "@/domains/garlia/libros/public/leerLibro";
import { IS_TAURI_BUILD } from "@/lib/config/buildTarget";

// Esta ruta solo existe con contenido real en el build web (SSR, sin
// output:"export"). En el build de Tauri (output:"export"), generateStaticParams
// devuelve [] más abajo, así que no se genera ninguna página para esta ruta
// — sin servidor no hay forma de pedirla en runtime, así que no hace falta
// bloquearla con dynamicParams (además, tiene que ser un booleano literal,
// no puede depender de una variable calculada como IS_TAURI_BUILD).

export async function generateStaticParams() {
  if (IS_TAURI_BUILD) return [];
  // Web: no pre-generamos nada en build time, SSR resuelve on-demand.
  return [];
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string; orden: string }>;
}) {
  const { slug, orden } = await params;
  return <Lector orden={orden} slug={slug} />;
}
