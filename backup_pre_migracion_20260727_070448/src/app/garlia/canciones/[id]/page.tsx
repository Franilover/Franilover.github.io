import CancionDetalles from "@/domains/garlia/canciones/public/detallesCancion";

// Requerido por `output: export`. Este page.tsx debe ser Server Component
// (sin "use client") para que generateStaticParams funcione — por eso NO
// lleva "use client" acá, aunque CancionDetalles (importado) sí lo tenga
// internamente. Next permite que un Server Component renderice un Client
// Component como children/default export sin problema.
//
// El contenido real se resuelve 100% client-side vía useParams() +
// Supabase dentro de CancionDetalles, así que alcanza con generar un
// único HTML "molde" para esta ruta dinámica.
export async function generateStaticParams() {
  return [{ id: "placeholder" }];
}

export default function Page() {
  return <CancionDetalles />;
}
