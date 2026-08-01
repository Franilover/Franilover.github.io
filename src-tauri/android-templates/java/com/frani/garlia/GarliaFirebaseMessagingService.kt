package com.frani.garlia

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

// Recibe los eventos de Firebase Cloud Messaging del lado nativo Android.
// Dos responsabilidades:
//   1. onNewToken: Firebase entrega/renueva el token del dispositivo. Se lo
//      pasamos al WebView (window.onFcmToken) para que el JS lo guarde en
//      Supabase vía guardarTokenFcm() (ver pushEngine.ts).
//   2. onMessageReceived: llega un push. Si la Activity principal está en
//      foreground, se lo pasamos también al WebView (window.onFcmMensaje)
//      para que la UI pueda reaccionar (ej. refrescar la conversación
//      abierta). Si no, mostramos la notificación del sistema nosotros
//      mismos — con la app cerrada, no hay WebView vivo que la muestre.
//
// Este archivo vive en el repo (fuera de src-tauri/gen/android, que se
// borra y regenera en cada build) y se copia al lugar correcto por un
// paso del workflow build-android-release.yml.
class GarliaFirebaseMessagingService : FirebaseMessagingService() {

    companion object {
        private const val CANAL_ID = "mensajes"
        private const val CANAL_NOMBRE = "Mensajes"

        // Canal separado del de mensajes: necesita IMPORTANCE_HIGH +
        // sonido de timbre continuo, y no queremos que Android lo agrupe
        // ni comparta configuración con las notificaciones de mensajes
        // normales (el usuario podría silenciar "Mensajes" sin querer
        // silenciar llamadas, o viceversa).
        private const val CANAL_LLAMADAS_ID = "llamadas_entrantes"
        private const val CANAL_LLAMADAS_NOMBRE = "Llamadas entrantes"
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        PuenteFcm.entregarToken(token)
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)

        // notify-call manda un push data-only con data.tipo = "llamada_entrante"
        // (a propósito, sin bloque `notification`, para poder decidir acá
        // mismo cómo mostrarla — con full-screen intent — en vez de dejar
        // que el sistema la muestre como una notificación normal). Todo lo
        // demás (notify-message, notify-subscribers) sigue el camino de
        // siempre, sin tocar.
        if (remoteMessage.data["tipo"] == "llamada_entrante") {
            mostrarLlamadaEntrante(remoteMessage)
            return
        }

        val titulo = remoteMessage.notification?.title
            ?: remoteMessage.data["title"]
            ?: "Nuevo mensaje"
        val cuerpo = remoteMessage.notification?.body
            ?: remoteMessage.data["body"]
            ?: ""
        val url = remoteMessage.data["url"] // ej. /personal/mensajes/detalle?id=...

        val jsPayload = org.json.JSONObject().apply {
            put("titulo", titulo)
            put("cuerpo", cuerpo)
            put("url", url ?: "")
        }
        val js = "window.onFcmMensaje && window.onFcmMensaje($jsPayload);"
        val entregadoAlWebView = PuenteFcm.evaluarJs(js)

        // Si la app está en foreground, el WebView ya se enteró arriba y
        // puede decidir qué hacer (ej. no mostrar notificación si la
        // conversación ya está abierta). Si no hay WebView vivo, mostramos
        // la notificación del sistema nosotros — es el caso típico de "me
        // llega un mensaje con la app cerrada".
        if (entregadoAlWebView != true) {
            mostrarNotificacionDelSistema(titulo, cuerpo, url)
        }
    }

    // Llamada entrante: siempre se muestra como notificación full-screen
    // del sistema, sin pasar por el WebView primero. A diferencia de un
    // mensaje, acá no tiene sentido "avisarle al JS y que decida" — una
    // llamada tiene que sonar e interrumpir sí o sí, esté la app en
    // foreground, background, o cerrada.
    private fun mostrarLlamadaEntrante(remoteMessage: RemoteMessage) {
        val data = remoteMessage.data
        val llamadaId = data["llamadaId"] ?: return
        val conversacionId = data["conversacionId"] ?: ""
        val roomName = data["roomName"] ?: ""
        val nombreQuienLlama = data["nombreQuienLlama"] ?: "Alguien"

        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val canalExistente = manager.getNotificationChannel(CANAL_LLAMADAS_ID)
            if (canalExistente == null) {
                val canal = NotificationChannel(
                    CANAL_LLAMADAS_ID,
                    CANAL_LLAMADAS_NOMBRE,
                    NotificationManager.IMPORTANCE_HIGH,
                )
                manager.createNotificationChannel(canal)
            }
        }

        val intentPantallaCompleta = Intent(this, LlamadaEntranteActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                Intent.FLAG_ACTIVITY_CLEAR_TOP or
                Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra(LlamadaEntranteActivity.EXTRA_LLAMADA_ID, llamadaId)
            putExtra(LlamadaEntranteActivity.EXTRA_CONVERSACION_ID, conversacionId)
            putExtra(LlamadaEntranteActivity.EXTRA_ROOM_NAME, roomName)
            putExtra(LlamadaEntranteActivity.EXTRA_NOMBRE_QUIEN_LLAMA, nombreQuienLlama)
        }
        val pendingIntentPantallaCompleta = PendingIntent.getActivity(
            this,
            llamadaId.hashCode(),
            intentPantallaCompleta,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val notificacion = NotificationCompat.Builder(this, CANAL_LLAMADAS_ID)
            .setContentTitle("Llamada entrante")
            .setContentText(nombreQuienLlama)
            .setSmallIcon(applicationInfo.icon)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setAutoCancel(true)
            .setOngoing(true)
            // Es lo que hace que, con la pantalla apagada o el teléfono
            // bloqueado, se dispare directamente LlamadaEntranteActivity
            // en vez de (o además de) mostrar la notificación en la
            // bandeja. En foreground con otra app activa, Android puede
            // optar por mostrar solo un heads-up en vez de la pantalla
            // completa — comportamiento estándar del sistema.
            .setFullScreenIntent(pendingIntentPantallaCompleta, true)
            .setContentIntent(pendingIntentPantallaCompleta)
            .build()

        manager.notify(llamadaId.hashCode(), notificacion)
    }

    private fun mostrarNotificacionDelSistema(titulo: String, cuerpo: String, url: String?) {
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val canalExistente = manager.getNotificationChannel(CANAL_ID)
            if (canalExistente == null) {
                val canal = NotificationChannel(
                    CANAL_ID,
                    CANAL_NOMBRE,
                    NotificationManager.IMPORTANCE_HIGH,
                )
                manager.createNotificationChannel(canal)
            }
        }

        // Al tocar la notificación, abre/trae al frente la Activity
        // principal. Si vino una url de destino (ej. la conversación
        // puntual), se la pasamos como extra para que el JS pueda navegar
        // ahí — MainActivity la debería leer del intent al arrancar.
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            if (!url.isNullOrEmpty()) putExtra("fcm_url", url)
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val notificacion = NotificationCompat.Builder(this, CANAL_ID)
            .setContentTitle(titulo)
            .setContentText(cuerpo)
            .setSmallIcon(applicationInfo.icon)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()

        manager.notify(System.currentTimeMillis().toInt(), notificacion)
    }
}
