export async function notifyIndexNow(urls: string[]) {
  const host = "franilover.vercel.app";
  const key = process.env.INDEXNOW_KEY;

  if (!key) {
    console.error("[INDEXNOW_ERROR] Falta configurar INDEXNOW_KEY en las variables de entorno");
    return false;
  }

  const payload = {
    host: host,
    key: key,
    keyLocation: `https://${host}/${key}.txt`,
    urlList: urls,
  };

  try {
    const response = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      console.warn("[INDEXNOW_SUCCESS] URLs notificadas con éxito");
      return true;
    } else {
      const errorText = await response.text();
      console.error("[INDEXNOW_ERROR] Respuesta fallida de IndexNow:", errorText);
      return false;
    }
  } catch (error) {
    console.error("[INDEXNOW_ERROR] Fallo de red al intentar contactar IndexNow:", error);
    return false;
  }
}