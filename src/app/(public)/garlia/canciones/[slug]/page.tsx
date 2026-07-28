import type { Metadata } from "next";
import CancionDetalles from "@/domains/garlia/canciones/public/detallesCancion";
import { supabase } from "@/infra/supabase/supabase";
import { toSlug } from "@/lib/utils/slugify";
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

async function buscarCancionPorSlug(slug: string) {
  const { data } = await supabase
    .from("canciones")
    .select("titulo, info_cancion, portada_url");
  if (!data) return null;
  return data.find((c: any) => toSlug(c.titulo ?? "") === slug) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const cancion = await buscarCancionPorSlug(slug);
  if (!cancion) {
    return { title: "Canción no encontrada | Garlia" };
  }
  return {
    title: `${cancion.titulo} | Garlia`,
    description: cancion.info_cancion?.slice(0, 160) ?? undefined,
    openGraph: {
      title: cancion.titulo,
      description: cancion.info_cancion?.slice(0, 160) ?? undefined,
      images: cancion.portada_url ? [cancion.portada_url] : undefined,
    },
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <CancionDetalles slug={slug} />;
}
