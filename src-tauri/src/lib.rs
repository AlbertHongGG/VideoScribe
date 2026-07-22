use tauri::{AppHandle, State, Manager};
use serde_json::Value;


use crate::domain::language::{LookupResult, FuriganaToken, DictionaryLookup, FuriganaProvider};

pub mod domain;
pub mod infrastructure;
pub mod application;

pub fn create_builder() -> tauri_specta::Builder<tauri::Wry> {
    tauri_specta::Builder::<tauri::Wry>::new()
        .commands(tauri_specta::collect_commands![
            lookup_word,
            start_stt_job,
            cancel_stt_job,
            get_stt_job_state,
            run_agent_task,
            get_app_state,
            start_translation,
            import_stt_results,
            get_furigana
        ])
}

#[tauri::command]
#[specta::specta]
fn lookup_word(text: String, state: State<'_, crate::infrastructure::state::AppState>) -> Result<LookupResult, String> {
    let provider = state.plugin_manager
        .get_service::<dyn DictionaryLookup>("japanese")
        .ok_or_else(|| "Dictionary lookup provider for Japanese not found".to_string())?;

    provider.lookup_word(&text)
}

#[tauri::command]
#[specta::specta]
fn get_furigana(text: String, state: State<'_, crate::infrastructure::state::AppState>) -> Result<Vec<FuriganaToken>, String> {
    let provider = state.plugin_manager
        .get_service::<dyn FuriganaProvider>("japanese")
        .ok_or_else(|| "Furigana provider for Japanese not found".to_string())?;

    provider.get_furigana(&text)
}

#[tauri::command]
#[specta::specta]
fn start_stt_job(
    video_path: String,
    model_size: String,
    language: String,
    vad_engine: String,
    mss_engine: String,
    mss_model: String,
    use_batch: bool,
    batch_size: u32,
    state: State<'_, std::sync::Arc<crate::application::stt_job_controller::SttJobController>>,
) -> Result<String, String> {
    let manager = state.inner();
    manager.start_job(video_path, model_size, language, vad_engine, mss_engine, mss_model, use_batch, batch_size)
}

#[tauri::command]
#[specta::specta]
fn cancel_stt_job(
    job_id: String,
    manager: State<'_, std::sync::Arc<crate::application::stt_job_controller::SttJobController>>
) -> Result<(), String> {
    manager.cancel_job(job_id)
}

#[tauri::command]
#[specta::specta]
fn get_stt_job_state(
    manager: State<'_, std::sync::Arc<crate::application::stt_job_controller::SttJobController>>
) -> Result<Option<crate::domain::stt_job::SttJobSnapshot>, String> {
    Ok(manager.get_current_state())
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
            let plugin_manager = crate::infrastructure::plugins::PluginManager::new(app.handle());

            match crate::infrastructure::state::AppState::new(plugin_manager) {
                Ok(state) => {
                    app.manage(state);
                }
                Err(e) => {
                    eprintln!("Failed to initialize AppState: {}", e);
                }
            }
            
            let stt_manager = crate::application::stt_job_controller::SttJobController::new(app.handle().clone());
            app.manage(stt_manager);
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
