"use client";
import { useSearchParams } from "next/navigation";
import PersonalUsername from "@/domains/garlia/perfil-jugador/personalUsername";

// Wrapper para la ruta estática de Tauri (/garlia/personal/detalle?username=...).
// La ruta web usa el server component en app/(public)/garlia/personal/[username]/page.tsx,
// que pasa el username por prop directamente sin pasar por acá.
export default function PersonalUsernameDetalle() {
  const searchParams = useSearchParams();
  const username = searchParams.get("username") ?? "";
  return <PersonalUsername username={username} />;
}
