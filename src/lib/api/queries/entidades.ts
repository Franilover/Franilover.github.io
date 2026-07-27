import { supabase } from "@/infra/supabase/supabase";

export type TipoEntidad = "item" | "criatura" | "personaje";

export interface EntidadesResult {
  ok: boolean;
  data: {
    items: any[];
    criaturas: any[];
    personajes: any[];
  };
  error?: string;
}

/**
 * Reemplaza a la antigua API route /api/entidades.
 *
 * Antes vivía en el servidor (Next.js API route) y usaba la
 * SUPABASE_SERVICE_ROLE_KEY. Como estos datos son de lectura pública
 * (items, criaturas, personajes del wiki de Garlia), no hace falta
 * privilegios de admin: se consulta Supabase directo desde el cliente
 * con la anon key, que ya respeta Row Level Security.
 *
 * IMPORTANTE: para que esto funcione, las tablas "items", "criaturas"
 * y "personajes" necesitan una policy de RLS que permita SELECT público
 * (o al menos a usuarios autenticados, según corresponda a tu app).
 *
 * @param tipo - si se pasa, solo trae ese tipo de entidad; si se omite, trae los 3
 */
export async function fetchEntidades(
  tipo?: TipoEntidad,
): Promise<EntidadesResult> {
  try {
    const [itemsRes, criaturasRes, personajesRes] = await Promise.all([
      !tipo || tipo === "item"
        ? supabase
            .from("items")
            .select("id, nombre, categoria, imagen_url")
            .order("nombre")
        : Promise.resolve({ data: [], error: null }),
      !tipo || tipo === "criatura"
        ? supabase
            .from("criaturas")
            .select("id, nombre, imagen_url, habitat, alma, descripcion")
            .order("nombre")
        : Promise.resolve({ data: [], error: null }),
      !tipo || tipo === "personaje"
        ? supabase
            .from("personajes")
            .select("id, nombre, img_url, reino, especie, sobre")
            .order("nombre")
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (itemsRes.error) throw itemsRes.error;
    if (criaturasRes.error) throw criaturasRes.error;
    if (personajesRes.error) throw personajesRes.error;

    return {
      ok: true,
      data: {
        items: (itemsRes.data || []).map((i: any) => ({
          ...i,
          tipo: "item",
        })),
        criaturas: (criaturasRes.data || []).map((c: any) => ({
          ...c,
          tipo: "criatura",
        })),
        personajes: (personajesRes.data || []).map((p: any) => ({
          ...p,
          imagen_url: p.img_url,
          descripcion: p.sobre,
          tipo: "personaje",
        })),
      },
    };
  } catch (err: any) {
    console.error("[fetchEntidades]", err);
    return {
      ok: false,
      data: { items: [], criaturas: [], personajes: [] },
      error: err?.message ?? String(err),
    };
  }
}
