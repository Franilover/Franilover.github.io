"use client";




import { MessageCircle, Palette, Star } from "lucide-react";





import MenuBase from "@/components/layout/MenuBase";





const ITEMS = [
  { href: "/personal/sobre-mi", title: "Sobre Mí", icon: <Star />,    pageKey: "sobre-mi", delay: 0.1 },
  { href: "/personal/galeria", title: "Galería", icon: <Palette />, pageKey: "galeria", delay: 0.2 },
  { href: "/personal/mensajes", title: "Mensajes", icon: <MessageCircle />, pageKey: "mensajes", delay: 0.3 },
];





export default function PersonalMenuPage() {
  return <MenuBase items={ITEMS} titulo="Personal" />;
}