package com.frani.garlia

import android.app.Activity
import android.app.KeyguardManager
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

// Pantalla full-screen de "llamada entrante", lanzada por el
// setFullScreenIntent() de la notificación en
// GarliaFirebaseMessagingService cuando llega un push con
// data.tipo == "llamada_entrante". Se muestra incluso con el teléfono
// bloqueado (igual que una llamada normal de telefonía).
//
// Es una Activity separada de MainActivity (no la genera ni la toca Tauri)
// porque necesita mostrarse sobre la lockscreen y encender la pantalla,
// cosas que no tiene sentido pedirle a la Activity principal de la WebView.
// Al elegir Aceptar/Rechazar, abre MainActivity con extras que el JS lee
// para actuar (unirse a la sala LiveKit o marcar la llamada como
// rechazada) — la lógica de negocio real vive del lado web, esta Activity
// solo captura la decisión del usuario y se la pasa.
//
// Vista armada 100% en código (sin XML de layout) para no depender de
// recursos que `tauri android init` podría no generar / borrar entre
// builds, igual que el resto del código nativo de este proyecto.
class LlamadaEntranteActivity : Activity() {

    companion object {
        const val EXTRA_LLAMADA_ID = "llamada_id"
        const val EXTRA_CONVERSACION_ID = "conversacion_id"
        const val EXTRA_ROOM_NAME = "room_name"
        const val EXTRA_NOMBRE_QUIEN_LLAMA = "nombre_quien_llama"
        const val EXTRA_ACCION = "fcm_llamada_accion" // "aceptar" | "rechazar", leído por MainActivity/JS
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        mostrarSobreLockscreenYPrenderPantalla()

        val llamadaId = intent.getStringExtra(EXTRA_LLAMADA_ID) ?: ""
        val conversacionId = intent.getStringExtra(EXTRA_CONVERSACION_ID) ?: ""
        val roomName = intent.getStringExtra(EXTRA_ROOM_NAME) ?: ""
        val nombreQuienLlama = intent.getStringExtra(EXTRA_NOMBRE_QUIEN_LLAMA) ?: "Alguien"

        setContentView(armarVista(nombreQuienLlama, llamadaId, conversacionId, roomName))
    }

    private fun mostrarSobreLockscreenYPrenderPantalla() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
            val keyguardManager = getSystemService(KEYGUARD_SERVICE) as KeyguardManager
            keyguardManager.requestDismissKeyguard(this, null)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                    WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
                    WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD,
            )
        }
    }

    private fun armarVista(
        nombreQuienLlama: String,
        llamadaId: String,
        conversacionId: String,
        roomName: String,
    ): LinearLayout {
        val padding = (32 * resources.displayMetrics.density).toInt()

        val contenedor = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(padding, padding * 3, padding, padding)
            setBackgroundColor(0xFF121212.toInt())
        }

        val textoLlamando = TextView(this).apply {
            text = "Llamada entrante"
            textSize = 16f
            setTextColor(0xFFAAAAAA.toInt())
        }

        val textoNombre = TextView(this).apply {
            text = nombreQuienLlama
            textSize = 32f
            setTextColor(0xFFFFFFFF.toInt())
            setPadding(0, (16 * resources.displayMetrics.density).toInt(), 0, 0)
        }

        val espaciador = TextView(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                0,
                1f,
            )
        }

        val filaBotones = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            )
        }

        val botonRechazar = Button(this).apply {
            text = "Rechazar"
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            setOnClickListener {
                resolverLlamada("rechazar", llamadaId, conversacionId, roomName)
            }
        }

        val botonAceptar = Button(this).apply {
            text = "Aceptar"
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            setOnClickListener {
                resolverLlamada("aceptar", llamadaId, conversacionId, roomName)
            }
        }

        filaBotones.addView(botonRechazar)
        filaBotones.addView(botonAceptar)

        contenedor.addView(textoLlamando)
        contenedor.addView(textoNombre)
        contenedor.addView(espaciador)
        contenedor.addView(filaBotones)

        return contenedor
    }

    // Abre MainActivity (creándola si hace falta) con los extras de la
    // decisión. El JS del lado web (window.onFcmLlamadaAccion, a agregar
    // en el cliente) lee esos extras al arrancar y actúa: si es "aceptar",
    // navega a la pantalla de llamada y pide el token de LiveKit; si es
    // "rechazar", actualiza el estado de la llamada a 'rechazada' en
    // Supabase. Esta Activity no sabe nada de LiveKit ni de Supabase — solo
    // transporta la decisión del usuario.
    private fun resolverLlamada(accion: String, llamadaId: String, conversacionId: String, roomName: String) {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra(EXTRA_ACCION, accion)
            putExtra(EXTRA_LLAMADA_ID, llamadaId)
            putExtra(EXTRA_CONVERSACION_ID, conversacionId)
            putExtra(EXTRA_ROOM_NAME, roomName)
        }
        startActivity(intent)
        finish()
    }
}
