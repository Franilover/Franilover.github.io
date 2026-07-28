import type { Metadata } from "next";
import PersonalUsername from "@/domains/garlia/perfil-jugador/personalUsername";
import { supabase } from "@/infra/supabase/supabase";
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

async function buscarPerfilPorUsername(username: string) {
  const { data } = await supabase
    .from("perfiles")
    .select("username, descripcion, titulo, avatar_url")
    .eq("username", username)
    .maybeSingle();
  return data ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const perfil = await buscarPerfilPorUsername(username);
  if (!perfil) {
    return { title: "Perfil no encontrado | Garlia" };
  }
  const nombre = perfil.titulo
    ? `${perfil.username} · ${perfil.titulo}`
    : perfil.username;
  return {
    title: `${nombre} | Garlia`,
    description: perfil.descripcion?.slice(0, 160) ?? undefined,
    openGraph: {
      title: nombre,
      description: perfil.descripcion?.slice(0, 160) ?? undefined,
      images: perfil.avatar_url ? [perfil.avatar_url] : undefined,
    },
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  return <PersonalUsername username={username} />;
}
