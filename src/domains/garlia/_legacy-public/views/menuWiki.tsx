"use client";
import { Compass, BookText, BookOpen, Music, UserCircle2 } from "lucide-react";

import MenuBase from "@/components/layout/MenuBase";

const ITEMS = [
  { href: "/garlia/personal",  title: "Mi Personaje", icon: <UserCircle2 />, pageKey: "personajes", delay: 0.1 },
  { href: "/garlia/aventura",  title: "Aventura",     icon: <BookOpen />,   pageKey: "aventura",    delay: 0.15 },
  { href: "/garlia/mapa",      title: "Mapa",         icon: <Compass />,    pageKey: "mapa",        delay: 0.2 },
  { href: "/garlia/libros",    title: "Libros",       icon: <BookText />,   pageKey: "libros",      delay: 0.3 },
  { href: "/garlia/canciones", title: "Canciones",    icon: <Music />,      pageKey: "canciones",   delay: 0.4 },
];

export default function WikiMenuPage() {
  return <MenuBase items={ITEMS} titulo="Jardin" />;
}