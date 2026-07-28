mod static_protocol;
mod static_rewrite;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  // reqwest 0.13 (usado internamente por Tauri / sus plugins) requiere que
  // se instale explícitamente un crypto provider de rustls antes de crear
  // cualquier cliente HTTP, o crashea con SIGABRT apenas se intenta hacer
  // la primera petición de red (ver panic en reqwest async_impl/client.rs).
  // Esto se instala una sola vez, apenas arranca la app.
  rustls::crypto::aws_lc_rs::default_provider()
    .install_default()
    .expect("no se pudo instalar el crypto provider de rustls");

  let builder = tauri::Builder::default()
    .plugin(tauri_plugin_http::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_os::init())
    // Sirve el build estático (frontendDist) aplicando los mismos
    // rewrites que vercel.json usa en la web, para que las rutas
    // dinámicas ([id], [username], etc.) funcionen igual en la app
    // empaquetada. Ver static_rewrite.rs / static_protocol.rs.
    .register_uri_scheme_protocol("garlia", |ctx, request| {
      static_protocol::handle(ctx, request)
    });

  #[cfg(target_os = "android")]
  let builder = builder.plugin(tauri_plugin_android_installer::init());

  builder
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // En dev, la ventana ya apunta a `devUrl` (next dev), que resuelve
      // las rutas [id] solo con Next, sin necesitar ningún rewrite. Ese
      // problema solo existe en el build estático (`output: "export"`),
      // así que acá solo redirigimos en producción.
      //
      // OJO: la forma del scheme custom depende del SO. En macOS/Linux es
      // "garlia://localhost/", pero en Windows y Android Tauri lo expone
      // como "http://garlia.localhost/" (mismo patrón que tauri:// vs
      // http://tauri.localhost). Si esto queda hardcodeado a una sola
      // forma, en Windows/Android la navegación nunca llega al protocolo
      // con el rewrite y las rutas [id] siguen dando 404 ahí.
      #[cfg(any(target_os = "android", target_os = "ios"))]
      let necesita_rewrite = true;
      #[cfg(not(any(target_os = "android", target_os = "ios")))]
      let necesita_rewrite = !cfg!(debug_assertions);

      if necesita_rewrite {
        if let Some(window) = app.get_webview_window("main") {
          let url = if cfg!(any(windows, target_os = "android")) {
            "http://garlia.localhost/"
          } else {
            "garlia://localhost/"
          };
          window.navigate(url.parse().expect("URL inválida"))?;
        }
      }

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application")
}
