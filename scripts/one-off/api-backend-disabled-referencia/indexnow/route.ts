import { NextResponse } from "next/server";

import { notifyIndexNow } from "@/lib/utils/indexNow";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { urls } = body;

    // Validación exhaustiva de los datos de entrada
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json(
        {
          error:
            "Se requiere un array de URLs válido para notificar a IndexNow",
        },
        { status: 400 },
      );
    }

    // Llamada a la utilidad que extrajimos a la carpeta lib
    const success = await notifyIndexNow(urls);

    if (success) {
      return NextResponse.json({
        success: true,
        message: "URLs enviadas a IndexNow correctamente",
      });
    } else {
      return NextResponse.json(
        { error: "Error al comunicarse con la API de IndexNow" },
        { status: 502 },
      );
    }
  } catch (error) {
    console.error(
      "[INDEXNOW_API_ERROR] Fallo interno en el manejador de la ruta:",
      error,
    );
    return NextResponse.json(
      { error: "Error interno del servidor al procesar la solicitud" },
      { status: 500 },
    );
  }
}
