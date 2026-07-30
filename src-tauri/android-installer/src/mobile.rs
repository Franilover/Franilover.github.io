use serde::{Deserialize, Serialize};
use tauri::{
    plugin::{PluginApi, PluginHandle},
    AppHandle, Runtime,
};

/// Args que le pasamos al lado Kotlin — tienen que ser Serialize (van hacia
/// afuera), no Deserialize como estaba antes.
#[derive(Serialize)]
pub struct InstallApkArgs {
    pub path: String,
}

#[derive(Serialize)]
pub struct StartDownloadArgs {
    pub url: String,
    #[serde(rename = "fileName")]
    pub file_name: String,
}

#[derive(Serialize)]
pub struct DownloadIdArgs {
    #[serde(rename = "downloadId")]
    pub download_id: i64,
}

#[derive(Deserialize)]
struct StartDownloadResponse {
    #[serde(rename = "downloadId")]
    download_id: i64,
}

pub fn init<R: Runtime, C: serde::de::DeserializeOwned>(
    _app: &AppHandle<R>,
    api: PluginApi<R, C>,
) -> crate::Result<AndroidInstaller<R>> {
    let handle = api.register_android_plugin("com.frani.garlia.installer", "InstallerPlugin")?;
    Ok(AndroidInstaller(handle))
}

pub struct AndroidInstaller<R: Runtime>(PluginHandle<R>);

/// Respuesta que devuelve el lado Kotlin al resolver `invoke.resolve()` sin
/// argumentos — tiene que ser Deserialize (viene desde afuera), no Serialize.
#[derive(Deserialize)]
struct EmptyResponse {}

impl<R: Runtime> AndroidInstaller<R> {
    pub fn install_apk(&self, path: String) -> crate::Result<()> {
        self.0
            .run_mobile_plugin::<EmptyResponse>("installApk", InstallApkArgs { path })?;
        Ok(())
    }

    pub fn start_download(&self, url: String, file_name: String) -> crate::Result<i64> {
        let respuesta = self.0.run_mobile_plugin::<StartDownloadResponse>(
            "startDownload",
            StartDownloadArgs { url, file_name },
        )?;
        Ok(respuesta.download_id)
    }

    pub fn query_download(&self, download_id: i64) -> crate::Result<crate::EstadoDescarga> {
        let estado = self.0.run_mobile_plugin::<crate::EstadoDescarga>(
            "queryDownload",
            DownloadIdArgs { download_id },
        )?;
        Ok(estado)
    }

    pub fn cancel_download(&self, download_id: i64) -> crate::Result<()> {
        self.0.run_mobile_plugin::<EmptyResponse>(
            "cancelDownload",
            DownloadIdArgs { download_id },
        )?;
        Ok(())
    }
}
