// app/api/admin/eliminar-usuario/route.ts
//
// Borra un usuario por completo: la fila en "perfiles" Y la cuenta real de
// Supabase Auth. Esto SOLO puede hacerse en el servidor, porque requiere la
// service_role key (nunca debe llegar al navegador).
//
// Variables de entorno necesarias (en .env.local / panel de Vercel, SIN
// prefijo NEXT_PUBLIC_ para la service role):
//   NEXT_PUBLIC_SUPABASE_URL       (la misma que ya usas en el cliente)
//   NEXT_PUBLIC_SUPABASE_ANON_KEY  (la misma que ya usas en el cliente)
//   SUPABASE_SERVICE_ROLE_KEY      (Project Settings → API → service_role)
//
// Ajusta los nombres de las dos primeras si en tu proyecto se llaman distinto
// (revisa @/lib/api/client/supabase.ts para confirmar cuáles usas ahí).

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: Request) {
  try {
    if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Faltan variables de entorno de Supabase en el servidor" },
        { status: 500 },
      );
    }

    const { userId } = await req.json();
    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "Falta userId" }, { status: 400 });
    }

    // ── 1. Verificar en el servidor que quien llama es realmente admin ──────
    // (nunca confiar en el chequeo que ya hizo el cliente: cualquiera podría
    // llamar a este endpoint directamente)
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: esAdmin, error: rpcError } = await callerClient.rpc("is_admin");
    if (rpcError || !esAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // ── 2. Cliente admin (service role) — solo existe en el servidor ────────
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // No te elimines a ti mismo por accidente y te quedes sin acceso
    const { data: callerUser } = await callerClient.auth.getUser();
    if (callerUser?.user?.id === userId) {
      return NextResponse.json(
        { error: "No puedes eliminar tu propia cuenta de admin" },
        { status: 400 },
      );
    }

    // ── 3. Borrar primero la fila de "perfiles" (y lo que cuelgue de ella si
    //      tienes ON DELETE CASCADE configurado) — así evitamos un choque de
    //      foreign key si auth.users → perfiles no tiene cascade ──────────
    const { error: perfilError } = await admin
      .from("perfiles")
      .delete()
      .eq("id", userId);
    if (perfilError) {
      return NextResponse.json({ error: perfilError.message }, { status: 500 });
    }

    // ── 4. Borrar la cuenta real de Supabase Auth ────────────────────────────
    // Esto es justo lo que faltaba: sin este paso el usuario sigue existiendo
    // en Authentication → Users aunque ya no aparezca en tu tabla "perfiles".
    const { error: authError } = await admin.auth.admin.deleteUser(userId);
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Error inesperado al eliminar el usuario" },
      { status: 500 },
    );
  }
}
