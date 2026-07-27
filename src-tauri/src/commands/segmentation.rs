use tauri::{AppHandle, State, Manager, Emitter};
use std::sync::Arc;
use crate::infrastructure::state::AppState;
use serde_json::Value;

#[tauri::command]
#[specta::specta]
pub fn start_segmentation(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    if let Ok(mut proj) = state.project.lock() {
        if proj.is_pipeline_running() {
            return Err("A pipeline job is already running".to_string());
        }
        proj.set_task_pending(crate::domain::project::TaskType::Segmentation);
    }
    
    let _ = app.emit("app-state-changed", Value::Null);
    
    crate::application::pipeline_engine::PipelineEngine::advance_pipeline(app);
    Ok(())
}
