use tauri::{AppHandle, State, Manager};
use serde_json::Value;
use std::sync::Mutex;
use std::path::PathBuf;

use crate::domain::language::LookupResult;
use crate::infrastructure::plugins::PluginManager;
use crate::infrastructure::plugins::japanese::JapanesePlugin;

pub mod domain;
pub mod infrastructure;
pub mod application;

pub fn create_builder() -> tauri_specta::Builder<tauri::Wry> {
    tauri_specta::Builder::<tauri::Wry>::new()
        .commands(tauri_specta::collect_commands![
            lookup_word,
            run_stt,
            run_agent_task,
            get_app_state,
            start_translation,
            import_stt_results
        ])
}

#[tauri::command]
#[specta::specta]
fn lookup_word(text: String, state: State<'_, crate::infrastructure::state::AppState>) -> Result<LookupResult, String> {
    let language = crate::domain::language::Language::Japanese; // Hardcode Japanese for now
    
    crate::application::language_service::LanguageService::lookup_word(
        state.plugin_manager.clone(),
        language,
        &text
    )
}

#[tauri::command]
#[specta::specta]
async fn run_stt(
    app: AppHandle, 
    video_path: String, 
    model_size: String,
    state: State<'_, crate::infrastructure::state::AppState>
) -> Result<(), String> {
    let dispatcher = std::sync::Arc::new(crate::infrastructure::tauri_events::TauriEventDispatcher::new(app));
    let provider = std::sync::Arc::new(crate::infrastructure::providers::local_stt::LocalSTTProvider::new(state.config.backend_port));
    
    crate::application::stt_service::SttService::run_stt(
        state.project.clone(),
        dispatcher,
        provider,
        video_path,
        model_size
    )
}

#[tauri::command]
#[specta::specta]
async fn run_agent_task(
    agent_type: crate::domain::agent::AgentType,
    payload_json: String,
    state: State<'_, crate::infrastructure::state::AppState>,
) -> Result<String, String> {
    use crate::infrastructure::agents::AgentFactory;

    let provider = match agent_type {
        crate::domain::agent::AgentType::TranslatorAgent => state.translator_provider.clone(),
    };
    
    let payload: Value = serde_json::from_str(&payload_json).map_err(|e| e.to_string())?;
    let agent = AgentFactory::create_agent(&agent_type, provider)?;
    let result = agent.execute(payload).await?;
    
    serde_json::to_string(&result).map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
fn get_app_state(state: State<'_, crate::infrastructure::state::AppState>) -> Result<crate::domain::project::ProjectState, String> {
    let project = state.project.lock().map_err(|e| e.to_string())?;
    Ok(project.clone())
}

#[tauri::command]
#[specta::specta]
fn start_translation(app: AppHandle, state: State<'_, crate::infrastructure::state::AppState>) -> Result<(), String> {
    let dispatcher = std::sync::Arc::new(crate::infrastructure::tauri_events::TauriEventDispatcher::new(app));
    crate::application::translation_coordinator::TranslationCoordinator::start_translation(
        state.project.clone(),
        state.translator_provider.clone(),
        dispatcher
    )
}

#[tauri::command]
#[specta::specta]
fn import_stt_results(results: Vec<crate::domain::project::STTResult>, state: State<'_, crate::infrastructure::state::AppState>) -> Result<(), String> {
    if let Ok(mut project) = state.project.lock() {
        project.import_results(results);
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = create_builder();

    tauri::Builder::default()
        .setup(|app| {
            let resource_dir = app.path().resource_dir().unwrap_or_else(|_| PathBuf::from("."));
            let db_path = resource_dir.join("jmdict.db");
            
            let exe_dir = std::env::current_exe()
                .unwrap_or_else(|_| PathBuf::from("."))
                .parent()
                .unwrap_or_else(|| std::path::Path::new("."))
                .to_path_buf();
            let portable_db_path = exe_dir.join("jmdict.db");

            // Priority: Portable db -> Tauri resource db -> local fallback
            let actual_db_path = if portable_db_path.exists() {
                portable_db_path
            } else if db_path.exists() {
                db_path
            } else {
                PathBuf::from("jmdict.db")
            };

            let mut plugin_manager = PluginManager::new();
            if let Ok(japanese_plugin) = JapanesePlugin::new(actual_db_path) {
                plugin_manager.register_plugin(std::sync::Arc::new(japanese_plugin));
            } else {
                eprintln!("Failed to initialize Japanese plugin");
            }

            match crate::infrastructure::state::AppState::new(plugin_manager) {
                Ok(state) => {
                    app.manage(state);
                }
                Err(e) => {
                    eprintln!("Failed to initialize AppState: {}", e);
                }
            }
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
