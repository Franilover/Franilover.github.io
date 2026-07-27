"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import PersonalUsername from "@/domains/garlia/_legacy-public/views/personalUsername";

export default function PersonalUsernameClient() {
  const params = useParams();
  const paramFromNext = params?.username as string;
  // En output:"export" + rewrite de Vercel a /placeholder, useParams()
  // devuelve el valor horneado en build ("placeholder"), no el username
  // real de la URL. Si detectamos ese caso, leemos el segmento real
  // desde window.location, que sí refleja la URL que ve el usuario.
  const [username, setUsername] = useState<string>(paramFromNext);

  useEffect(() => {
    if (paramFromNext !== "placeholder") {
      setUsername(paramFromNext);
      return;
    }
    if (typeof window === "undefined") return;
    const partes = window.location.pathname.split("/").filter(Boolean);
    // /garlia/personal/:username
    const real = partes[partes.length - 1];
    if (real) setUsername(real);
  }, [paramFromNext]);

  return <PersonalUsername username={username} />;
}
