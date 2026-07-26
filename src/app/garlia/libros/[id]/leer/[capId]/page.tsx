import Leer from '@/domains/garlia/_legacy-public/views/leerLibro';

// Requerido por `output: export`. En rutas anidadas con dos segmentos
// dinámicos (libros/[id]/leer/[capId]), Next.js necesita que el
// generateStaticParams del nivel MÁS PROFUNDO devuelva TODOS los params
// de la cadena juntos (id + capId), no alcanza con que cada nivel
// declare el suyo por separado.
export async function generateStaticParams() {
  return [{ id: "placeholder", capId: "placeholder" }];
}

export default function Page() {
  return <Leer />;
}
