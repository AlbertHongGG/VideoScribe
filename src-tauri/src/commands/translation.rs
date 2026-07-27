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
        if proj.is_pipeline_running() {
            return Err("A pipeline job is already running".to_string());
        }
        proj.target_language = target_language;
        proj.set_task_pending(crate::domain::project::TaskType::Translation);
    }
    
    let _ = app.emit("app-state-changed", Value::Null);
    
    crate::application::pipeline_engine::PipelineEngine::advance_pipeline(app);
    Ok(())
}
