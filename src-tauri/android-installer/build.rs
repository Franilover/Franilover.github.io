const COMMANDS: &[&str] = &[
    "install_apk",
    "start_download",
    "query_download",
    "cancel_download",
];

fn main() {
    tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .build();
}
