use serde::{Deserialize, Serialize};
use tauri::{
    plugin::{Builder, TauriPlugin},
    Manager, Runtime,
};

/// Estado de una descarga, tal como lo devuelve `DownloadManager.query()`
/// del lado Kotlin. `status` es uno de: "pending" | "running" | "paused" |
/// "successful" | "failed" | "unknown".
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EstadoDescarga {
    pub status: String,
    #[serde(rename = "bytesDownloaded")]
    pub bytes_downloaded: i64,
    #[serde(rename = "bytesTotal")]
    pub bytes_total: i64,
    #[serde(rename = "localUri")]
    pub local_uri: Option<String>,
    pub reason: i32,
}

#[cfg(target_os = "android")]
mod mobile;
#[cfg(target_os = "android")]
use mobile::AndroidInstaller;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error(transparent)]
    Tauri(#[from] tauri::Error),
    #[cfg(target_os = "android")]
    #[error(transparent)]
    PluginInvoke(#[from] tauri::plugin::mobile::PluginInvokeError),
    #[error("instalación de APK solo soportada en Android")]
    NoSoportado,
}

// El trait Serialize exige que serialize() devuelva Result<S::Ok, S::Error>
// (el error del propio Serializer, no el nuestro) — por eso acá usamos
// std::result::Result explícito en vez del alias `Result<T>` de más abajo,
// que solo tiene un genérico y no aplica a esta firma.
impl Serialize for Error {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

pub type Result<T> = std::result::Result<T, Error>;

/// Dispara el Intent nativo de instalación (ACTION_VIEW + FileProvider) para
/// el APK en `path`. En Android esto abre la pantalla del sistema donde el
/// usuario tiene que tocar "Instalar" — no hay forma de saltarse ese paso.
#[tauri::command]
async fn install_apk<R: Runtime>(
    app: tauri::AppHandle<R>,
    path: String,
) -> Result<()> {
    #[cfg(target_os = "android")]
    {
        app.state::<AndroidInstaller<R>>().install_apk(path)?;
        Ok(())
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = (app, path);
        Err(Error::NoSoportado)
    }
}

/// Encola la descarga en el DownloadManager nativo de Android y devuelve
/// el id de la descarga de inmediato (no espera a que termine). La
/// descarga sigue corriendo aunque la app se minimice o mate el WebView.
#[tauri::command]
async fn start_download<R: Runtime>(
    app: tauri::AppHandle<R>,
    url: String,
    file_name: String,
) -> Result<i64> {
    #[cfg(target_os = "android")]
    {
        app.state::<AndroidInstaller<R>>().start_download(url, file_name)
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = (app, url, file_name);
        Err(Error::NoSoportado)
    }
}

/// Consulta el estado actual de una descarga por su id.
#[tauri::command]
async fn query_download<R: Runtime>(
    app: tauri::AppHandle<R>,
    download_id: i64,
) -> Result<EstadoDescarga> {
    #[cfg(target_os = "android")]
    {
        app.state::<AndroidInstaller<R>>().query_download(download_id)
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = (app, download_id);
        Err(Error::NoSoportado)
    }
}

/// Cancela una descarga en curso y borra el archivo parcial.
#[tauri::command]
async fn cancel_download<R: Runtime>(app: tauri::AppHandle<R>, download_id: i64) -> Result<()> {
    #[cfg(target_os = "android")]
    {
        app.state::<AndroidInstaller<R>>().cancel_download(download_id)
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = (app, download_id);
        Err(Error::NoSoportado)
    }
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("android-installer")
        .invoke_handler(tauri::generate_handler![
            install_apk,
            start_download,
            query_download,
            cancel_download
        ])
        .setup(|app, api| {
            #[cfg(target_os = "android")]
            {
                let installer = mobile::init(app, api)?;
                app.manage(installer);
            }
            #[cfg(not(target_os = "android"))]
            {
                let _ = api;
            }
            Ok(())
        })
        .build()
}
