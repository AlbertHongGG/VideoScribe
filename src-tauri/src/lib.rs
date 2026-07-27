use tauri::Manager;

pub mod domain;
pub mod infrastructure;
pub mod application;
pub mod commands;
pub use commands::create_builder;

pub fn run() {
    let builder = commands::create_builder();

    tauri::Builder::default()
        .setup(|app| {
            let plugin_manager = infrastructure::plugins::PluginManager::new(app.handle());

            match infrastructure::state::AppState::new(plugin_manager) {
                Ok(state) => {
                    app.manage(state);
                }
                Err(e) => {
                    eprintln!("Failed to initialize AppState: {}", e);
                }
            }
            
            let python_client = application::python_client::PythonWorkerClient::new(app.handle().clone());
            app.manage(python_client);
            Ok(())
        })
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(builder.invoke_handler())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
