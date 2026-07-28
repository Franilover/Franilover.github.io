import Leer from '@/domains/garlia/libros/public/leerLibro';

// Ruta estática fija — slug del libro y orden del capítulo viajan como
// ?slug=...&orden=... y se leen con useSearchParams del lado del cliente.
export default function Page() {
  return <Leer />;
}
