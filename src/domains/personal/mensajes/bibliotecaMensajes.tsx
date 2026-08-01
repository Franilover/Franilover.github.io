"use client";

import ListaConversaciones from "./ListaConversaciones";

// Página mobile / fallback: pantalla completa con la lista de conversaciones.
// En desktop (md+) esta misma lista se muestra como sidebar fija gracias a
// app/(personal)/personal/mensajes/layout.tsx, así que en desktop esta
// página queda oculta (ver layout: `hidden md:block` en el panel derecho
// hace que esta ruta solo importe en mobile, donde el layout no muestra sidebar).
export default function BibliotecaMensajes() {
  return <ListaConversaciones variante="pagina" />;
}
