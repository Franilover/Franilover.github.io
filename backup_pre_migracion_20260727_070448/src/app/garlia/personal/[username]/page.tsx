import PersonalUsernameClient from "./PersonalUsernameClient";

// Requerido por `output: export`. Ver nota en canciones/[id]/page.tsx.
// Este archivo es Server Component (sin "use client") porque
// generateStaticParams solo puede vivir en un Server Component.
// La lógica que antes estaba acá (useParams, etc.) se movió a
// PersonalUsernameClient.tsx, que sigue siendo "use client".
export async function generateStaticParams() {
  return [{ username: "placeholder" }];
}

export default function Page() {
  return <PersonalUsernameClient />;
}
