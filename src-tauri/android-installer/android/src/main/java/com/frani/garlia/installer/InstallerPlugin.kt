package com.frani.garlia.installer

import android.app.Activity
import android.app.DownloadManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import android.webkit.WebView
import androidx.core.content.FileProvider
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import java.io.File

@InvokeArg
class InstallApkArgs {
    lateinit var path: String
}

@InvokeArg
class StartDownloadArgs {
    lateinit var url: String
    lateinit var fileName: String
}

@InvokeArg
class DownloadIdArgs {
    var downloadId: Long = 0
}

/**
 * InstallerPlugin
 * ─────────────────────────────────────────────────────────────────────────
 * Único trabajo: dado un .apk ya descargado a disco por el lado JS/Rust
 * (ver ActualizacionDisponible.tsx), abrir la pantalla nativa de Android
 * para instalarlo. Android NO permite auto-instalación silenciosa fuera
 * de Play Store — el usuario siempre tiene que tocar "Instalar" a mano
 * en la pantalla del sistema que dispara este Intent.
 *
 * Requiere:
 *  - permiso REQUEST_INSTALL_PACKAGES en el AndroidManifest.xml
 *  - un <provider> FileProvider declarado (ver file_paths.xml al lado)
 * ─────────────────────────────────────────────────────────────────────────
 */
@TauriPlugin
class InstallerPlugin(private val activity: Activity) : Plugin(activity) {

    // DownloadManager delega la descarga al sistema operativo — corre en un
    // proceso/servicio propio de Android, así que sobrevive a que el
    // usuario minimice la app o se apague la pantalla, cosa que un fetch en
    // JS dentro del WebView no puede garantizar.
    private val downloadManager: DownloadManager by lazy {
        activity.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
    }

    private var receptorRegistrado = false

    // Cuando termina (bien o mal) una descarga encolada por CUALQUIER app,
    // Android manda este broadcast. Lo escuchamos para avisarle a JS que ya
    // puede dejar de pollear y revisar el estado final — incluso si el
    // usuario volvió a abrir la app después de que la descarga ya terminó
    // en segundo plano.
    private val receptorDescarga = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            val id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L)
            if (id == -1L) return
            val data = JSObject()
            data.put("downloadId", id)
            trigger("download-complete", data)
        }
    }

    override fun load(webView: WebView) {
        super.load(webView)
        if (!receptorRegistrado) {
            val filtro = IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                activity.registerReceiver(receptorDescarga, filtro, Context.RECEIVER_EXPORTED)
            } else {
                @Suppress("DEPRECATION")
                activity.registerReceiver(receptorDescarga, filtro)
            }
            receptorRegistrado = true
        }
    }

    /**
     * Encola la descarga del APK en el DownloadManager del sistema y
     * devuelve el `downloadId` en el momento — no espera a que termine.
     * El archivo queda en el directorio externo propio de la app
     * (no requiere permisos de almacenamiento, es scoped storage).
     */
    @Command
    fun startDownload(invoke: Invoke) {
        val args = invoke.parseArgs(StartDownloadArgs::class.java)

        try {
            val request = DownloadManager.Request(Uri.parse(args.url)).apply {
                setTitle("Actualizando Garlia")
                setDescription(args.fileName)
                setNotificationVisibility(
                    DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED
                )
                setDestinationInExternalFilesDir(
                    activity,
                    Environment.DIRECTORY_DOWNLOADS,
                    args.fileName
                )
                setAllowedOverMetered(true)
                setAllowedOverRoaming(true)
            }

            val id = downloadManager.enqueue(request)
            val result = JSObject()
            result.put("downloadId", id)
            invoke.resolve(result)
        } catch (e: Exception) {
            invoke.reject("No se pudo iniciar la descarga: ${e.message}")
        }
    }

    /**
     * Consulta el estado actual de una descarga encolada. Se pensó para
     * pollearse cada ~500-1000ms desde JS mientras la app está en primer
     * plano; la descarga en sí sigue corriendo la haya que polleando o no.
     */
    @Command
    fun queryDownload(invoke: Invoke) {
        val args = invoke.parseArgs(DownloadIdArgs::class.java)

        val query = DownloadManager.Query().setFilterById(args.downloadId)
        val cursor = downloadManager.query(query)

        if (cursor == null || !cursor.moveToFirst()) {
            cursor?.close()
            invoke.reject("Descarga no encontrada (id=${args.downloadId})")
            return
        }

        try {
            val estadoIdx = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS)
            val bajadosIdx = cursor.getColumnIndex(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR)
            val totalIdx = cursor.getColumnIndex(DownloadManager.COLUMN_TOTAL_SIZE_BYTES)
            val uriLocalIdx = cursor.getColumnIndex(DownloadManager.COLUMN_LOCAL_URI)
            val razonIdx = cursor.getColumnIndex(DownloadManager.COLUMN_REASON)

            val estado = when (cursor.getInt(estadoIdx)) {
                DownloadManager.STATUS_PENDING -> "pending"
                DownloadManager.STATUS_RUNNING -> "running"
                DownloadManager.STATUS_PAUSED -> "paused"
                DownloadManager.STATUS_SUCCESSFUL -> "successful"
                DownloadManager.STATUS_FAILED -> "failed"
                else -> "unknown"
            }

            val result = JSObject()
            result.put("status", estado)
            result.put("bytesDownloaded", cursor.getLong(bajadosIdx))
            result.put("bytesTotal", if (totalIdx >= 0) cursor.getLong(totalIdx) else 0L)
            result.put("localUri", if (uriLocalIdx >= 0) cursor.getString(uriLocalIdx) else null)
            result.put("reason", if (razonIdx >= 0) cursor.getInt(razonIdx) else -1)
            invoke.resolve(result)
        } finally {
            cursor.close()
        }
    }

    /** Cancela (y borra el archivo parcial de) una descarga en curso. */
    @Command
    fun cancelDownload(invoke: Invoke) {
        val args = invoke.parseArgs(DownloadIdArgs::class.java)
        downloadManager.remove(args.downloadId)
        invoke.resolve()
    }

    @Command
    fun installApk(invoke: Invoke) {
        val args = invoke.parseArgs(InstallApkArgs::class.java)
        val apkFile = File(args.path)

        if (!apkFile.exists()) {
            invoke.reject("El archivo APK no existe en la ruta indicada: ${args.path}")
            return
        }

        // Android 8+ exige permiso explícito de "instalar apps desconocidas"
        // para este origen. Si no lo tiene, lo mandamos a la pantalla de
        // ajustes correspondiente en vez de fallar en silencio.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
            !activity.packageManager.canRequestPackageInstalls()
        ) {
            val settingsIntent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES).apply {
                data = Uri.parse("package:${activity.packageName}")
            }
            activity.startActivity(settingsIntent)
            invoke.reject(
                "Falta el permiso 'instalar apps desconocidas'. Se abrió la pantalla de " +
                    "ajustes: activalo y volvé a tocar 'Actualizar'."
            )
            return
        }

        try {
            val apkUri: Uri = FileProvider.getUriForFile(
                activity,
                "${activity.packageName}.fileprovider",
                apkFile
            )

            val installIntent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(apkUri, "application/vnd.android.package-archive")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }

            activity.startActivity(installIntent)
            invoke.resolve()
        } catch (e: Exception) {
            invoke.reject("No se pudo abrir el instalador: ${e.message}")
        }
    }
}
