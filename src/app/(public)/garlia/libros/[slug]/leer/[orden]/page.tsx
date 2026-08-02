import type { Metadata } from "next";
import Lector from "@/domains/garlia/libros/public/leerLibro";
import { IS_TAURI_BUILD } from "@/lib/config/buildTarget";
import { supabase } from "@/infra/supabase/supabase";
import { toSlug } from "@/lib/utils/slugify";

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

async function buscarCapituloPorOrden(slug: string, orden: string) {
  const { data: libros } = await supabase
    .from("libros")
    .select("id, titulo, sinopsis, portada_url")
    .in("visibilidad", ["publico", "programado"]);
  const libro = libros?.find((l: any) => toSlug(l.titulo ?? "") === slug);
  if (!libro) return null;

  const n = parseInt(orden, 10);
  if (isNaN(n)) return null;

  const { data: capitulo } = await supabase
    .from("capitulos")
    .select("titulo_capitulo, orden")
    .eq("libro_id", libro.id)
    .eq("orden", n)
    .eq("visibilidad", "publico")
    .maybeSingle();
  if (!capitulo) return null;

  return { libro, capitulo };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; orden: string }>;
}): Promise<Metadata> {
  const { slug, orden } = await params;
  const resultado = await buscarCapituloPorOrden(slug, orden);
  if (!resultado) {
    return { title: "Capítulo no encontrado | Garlia" };
  }
  const { libro, capitulo } = resultado;
  const titulo = `${capitulo.titulo_capitulo} · ${libro.titulo} | Garlia`;
  const description = libro.sinopsis?.slice(0, 160) ?? undefined;
  return {
    title: titulo,
    description,
    openGraph: {
      title: titulo,
      description,
      images: libro.portada_url ? [libro.portada_url] : undefined,
    },
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string; orden: string }>;
}) {
  const { slug, orden } = await params;
  return <Lector orden={orden} slug={slug} />;
}
