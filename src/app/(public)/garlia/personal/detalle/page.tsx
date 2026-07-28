import { Suspense } from 'react';
import PersonalUsernameDetalle from '@/domains/garlia/perfil-jugador/personalUsernameDetalle';

// Ruta estática fija — el username real viaja como ?username=... y se lee
// con useSearchParams del lado del cliente. Ya no hace falta generateStaticParams
// ni el rewrite de Rust/placeholder: este archivo existe tal cual en el APK.
// Suspense es obligatorio: useSearchParams necesita un boundary para poder
// prerenderizarse en output:"export".
export default function Page() {
  return (
    <Suspense fallback={null}>
      <PersonalUsernameDetalle />
    </Suspense>
  );
}
