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
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        PuenteFcm.entregarToken(token)
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)

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
