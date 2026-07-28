use tauri::{AppHandle, State, Emitter};
use serde_json::Value;
use crate::infrastructure::state::AppState;

#[tauri::command]
#[specta::specta]
pub fn start_translation(
    target_language: String,
    app: AppHandle, 
    state: State<'_, AppState>
) -> Result<(), String> {
    if let Ok(mut proj) = state.project.lock() {
        proj.target_language = target_language;
    }
    
    let dispatcher = std::sync::Arc::new(crate::infrastructure::tauri_events::TauriEventDispatcher::new(app.clone()));
    state.job_manager.add_tasks(vec![crate::domain::project::TaskType::Translation], dispatcher)?;
    
    crate::application::pipeline_engine::PipelineEngine::advance_pipeline(app);
    Ok(())
}
