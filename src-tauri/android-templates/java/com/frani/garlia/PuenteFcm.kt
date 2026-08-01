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

    // Cuántas veces reintentar entregar el token pendiente y cada cuánto.
    // Existe porque WebView se crea muy temprano en el arranque nativo,
    // pero window.onFcmToken recién existe una vez que React montó
    // PushActivator — un solo intento inmediato casi siempre pierde esa
    // carrera y el token se pierde en silencio (era el bug real: el token
    // JAMÁS llegaba a guardarse en Supabase). Reintentar unos segundos
    // cubre ese hueco sin necesitar un mecanismo más complejo (comando
    // Tauri, JS interface, etc.).
    private const val REINTENTOS = 15
    private const val INTERVALO_MS = 500L

    fun registrarWebView(webView: WebView) {
        webViewRef = WeakReference(webView)
        tokenFcmPendiente?.let { entregarToken(it) }
    }

    /**
     * Intenta entregar el token al WebView actual (si hay uno registrado),
     * con reintentos cortos por si window.onFcmToken todavía no existe
     * (React puede no haber montado PushActivator todavía). Se llama tanto
     * desde onNewToken() del servicio de FCM como desde
     * MainActivity.pedirTokenFcm() en cada apertura de la app — cubre
     * "token nuevo" y "token ya existente" por igual.
     */
    fun entregarToken(token: String) {
        tokenFcmPendiente = token
        val webView = webViewRef?.get() ?: return
        intentarEntregarConReintentos(webView, token, REINTENTOS)
    }

    private fun intentarEntregarConReintentos(webView: WebView, token: String, intentosRestantes: Int) {
        val js = """
            (function() {
                if (window.onFcmToken) {
                    window.onFcmToken(${org.json.JSONObject.quote(token)});
                    return true;
                }
                return false;
            })();
        """.trimIndent()

        webView.post {
            webView.evaluateJavascript(js) { resultado ->
                val entregado = resultado == "true"
                if (!entregado && intentosRestantes > 0) {
                    webView.postDelayed(
                        { intentarEntregarConReintentos(webView, token, intentosRestantes - 1) },
                        INTERVALO_MS,
                    )
                }
            }
        }
    }

    /** Devuelve true si se pudo entregar el JS a un WebView vivo, false si no había ninguno. */
    fun evaluarJs(js: String): Boolean {
        val webView = webViewRef?.get() ?: return false
        webView.post { webView.evaluateJavascript(js, null) }
        return true
    }

    /**
     * Como evaluarJs, pero reintenta si el WebView todavía no está
     * registrado (misma carrera que con el token FCM: MainActivity.onCreate
     * puede correr antes de que Tauri termine de crear el WebView). A
     * diferencia de intentarEntregarConReintentos (que verifica que exista
     * una función JS puntual antes de darse por satisfecho), acá solo nos
     * importa que HAYA un WebView al que evaluarle el JS — el propio js ya
     * incluye su chequeo de "&&" contra la función global correspondiente,
     * así que no hace falta duplicar esa lógica acá.
     */
    fun evaluarJsConReintentos(js: String, intentosRestantes: Int = REINTENTOS) {
        val webView = webViewRef?.get()
        if (webView == null) {
            if (intentosRestantes <= 0) return
            android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(
                { evaluarJsConReintentos(js, intentosRestantes - 1) },
                INTERVALO_MS,
            )
            return
        }
        webView.post { webView.evaluateJavascript(js, null) }
    }
}
