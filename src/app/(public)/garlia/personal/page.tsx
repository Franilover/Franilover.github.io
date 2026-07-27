import Personal from "@/domains/garlia/perfil-jugador/PerfilJugador";

export default async function Page() {
  const datos = {
    username: "",
    status: "",
    avatar_url: "",
    inventario_usuario: []
  };

  return (
    <Personal datos={{
      username: datos.username,
      status: datos.status,
      avatar_url: datos.avatar_url,
      inventario_usuario: datos.inventario_usuario, 
    }} />
  );
}