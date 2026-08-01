package com.frani.garlia

import android.webkit.WebView
import java.lang.ref.WeakReference

// Puente mínimo entre GarliaFirebaseMessagingService (que no tiene acceso
// directo al WebView de Tauri) y el WebView real que Tauri crea dentro de
// su MainActivity generada.
//
// Por qué existe como objeto separado en vez de tocar MainActivity.kt: esa
// clase la genera `tauri android init` desde cero en cada build (se borra
// junto con gen/android), así que cualquier campo/método que le
// agregáramos a mano se perdería. En cambio, Tauri SÍ expone su WebView
// interno vía WRY, y el propio WebView de Android dispara un callback que
// podemos enganchar sin tocar el código generado: ver el paso del workflow
// que registra este puente (agrega una única línea a MainActivity.kt con
// un patch de Python, igual que se hace con signingConfig).
object PuenteFcm {
    private var webViewRef: WeakReference<WebView>? = null

    @Volatile
    var tokenFcmPendiente: String? = null

    fun registrarWebView(webView: WebView) {
        webViewRef = WeakReference(webView)
        // Si un token había llegado antes de que el WebView existiera,
        // se lo entregamos ahora que ya está disponible.
        tokenFcmPendiente?.let { token ->
            val js = "window.onFcmToken && window.onFcmToken(${org.json.JSONObject.quote(token)});"
            webView.post { webView.evaluateJavascript(js, null) }
        }
    }

    /** Devuelve true si se pudo entregar el JS a un WebView vivo, false si no había ninguno. */
    fun evaluarJs(js: String): Boolean {
        val webView = webViewRef?.get() ?: return false
        webView.post { webView.evaluateJavascript(js, null) }
        return true
    }
}
