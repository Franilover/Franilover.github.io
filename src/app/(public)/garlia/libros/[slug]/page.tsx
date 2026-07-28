import type { Metadata } from "next";
import LibroDetalle from "@/domains/garlia/libros/public/detallesLibro";
import { supabase } from "@/infra/supabase/supabase";
import { toSlug } from "@/lib/utils/slugify";
import { IS_TAURI_BUILD } from "@/lib/config/buildTarget";

// Esta ruta solo existe en el build web (SSR, sin output:"export").
// En el build de Tauri no se genera ninguna página acá: el APK usa
// /garlia/libros/detalle?slug=... en su lugar (ver ese page.tsx).
export const dynamicParams = !IS_TAURI_BUILD;

export async function generateStaticParams() {
  if (IS_TAURI_BUILD) return [];
  // Web: no pre-generamos nada en build time, SSR resuelve on-demand.
  return [];
}

async function buscarLibroPorSlug(slug: string) {
  const { data } = await supabase
    .from("libros")
    .select("titulo, sinopsis, portada_url, categoria")
    .in("visibilidad", ["publico", "programado"]);
  if (!data) return null;
  return data.find((l: any) => toSlug(l.titulo ?? "") === slug) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const libro = await buscarLibroPorSlug(slug);
  if (!libro) {
    return { title: "Libro no encontrado | Garlia" };
  }
  return {
    title: `${libro.titulo} | Garlia`,
    description: libro.sinopsis?.slice(0, 160) ?? undefined,
    openGraph: {
      title: libro.titulo,
      description: libro.sinopsis?.slice(0, 160) ?? undefined,
      images: libro.portada_url ? [libro.portada_url] : undefined,
    },
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <LibroDetalle slug={slug} />;
}
