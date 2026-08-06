import MapaInteractivo from '@/domains/garlia/reinos/public/mapaGarlia';

export default function Page() {
  // Mapa público: solo lectura. Toda la lógica de edición vive en
  // editorGarlia (ver MapaSection dentro del panel admin).
  return <MapaInteractivo allowEdit={false} />;
}