"use client";
import { useParams } from "next/navigation";
import PersonalUsername from "@/domains/garlia/perfil-jugador/personalUsername";

export default function PersonalUsernameClient() {
  const params   = useParams();
  const username = params?.username as string;
  return <PersonalUsername username={username} />;
}
