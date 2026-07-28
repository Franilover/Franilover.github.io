import { Suspense } from 'react';
import LibroDetalle from '@/domains/garlia/libros/public/detallesLibro';

// Ruta estática fija — el id/slug real viaja como ?slug=... y se lee con
// useSearchParams del lado del cliente. Ya no hace falta generateStaticParams
// ni el rewrite de Rust/placeholder: este archivo existe tal cual en el APK.
// Suspense es obligatorio: useSearchParams necesita un boundary para poder
// prerenderizarse en output:"export".
export default function Page() {
  return (
    <Suspense fallback={null}>
      <LibroDetalle />
    </Suspense>
  );
}
