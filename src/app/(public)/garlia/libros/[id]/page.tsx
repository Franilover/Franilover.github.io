import LibroDetalle from '@/domains/garlia/libros/public/detallesLibro';

// Requerido por `output: export`. Ver nota en canciones/[id]/page.tsx.
export async function generateStaticParams() {
  return [{ id: "placeholder" }];
}

export default function Page() {
  return <LibroDetalle />;
}
