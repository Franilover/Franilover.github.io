import { AdminOnly } from "@/ui/AdminOnly";
import { PanelActualizacionApk } from "@/domains/plataforma/actualizaciones/PanelActualizacionApk";

export default function ActualizacionesPage() {
  return (
    <AdminOnly>
      <div className="max-w-lg mx-auto px-4 py-8">
        <PanelActualizacionApk />
      </div>
    </AdminOnly>
  );
}
