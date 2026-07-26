import DetalleConversacion from '@/domains/garlia/_legacy-public/views/detalleConversacion';

// Requerido por `output: export`. Ver nota en garlia/libros/[id]/page.tsx.
export async function generateStaticParams() {
  return [{ id: "placeholder" }];
}

export default function Page() {
  return <DetalleConversacion />;
}
