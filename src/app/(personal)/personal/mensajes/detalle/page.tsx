import { Suspense } from 'react';
import DetalleConversacion from '@/domains/personal/mensajes/detalleConversacion';

// Ruta estática fija, usada tanto en web (Vercel) como en el APK de Tauri.
// Mensajes es contenido privado (no hay generateMetadata/SEO en juego, a
// diferencia de /garlia/libros), así que no hace falta duplicar en una ruta
// dinámica [id] + una paralela: alcanza con una sola ruta que lea el id real
// como ?id=... vía useSearchParams. Suspense es obligatorio: useSearchParams
// necesita un boundary para poder prerenderizarse en output:"export".
export default function Page() {
  return (
    <Suspense fallback={null}>
      <DetalleConversacion />
    </Suspense>
  );
}
