use tauri::{AppHandle, State, Emitter};
use serde_json::Value;
use std::sync::Arc;
use crate::infrastructure::state::AppState;
use crate::infrastructure::agents::AgentFactory;
use crate::infrastructure::tauri_events::TauriEventDispatcher;
use tauri::Manager;
use crate::domain::agent::AgentType;

#[tauri::command]
#[specta::specta]
pub async fn run_agent_task(
    agent_type: AgentType,
    payload_json: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let provider = match agent_type {
        AgentType::TranslatorAgent => state.translator_provider.clone(),
        AgentType::SegmenterAgent => state.segmenter_provider.clone(),
    };
    
    let payload: Value = serde_json::from_str(&payload_json).map_err(|e| e.to_string())?;
    let agent = AgentFactory::create_agent(&agent_type, provider)?;
    let result = agent.execute(payload).await?;
    
    serde_json::to_string(&result).map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub fn start_translation(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    if let Ok(mut proj) = state.project.lock() {
        if proj.is_pipeline_running() {
            return Err("A pipeline job is already running".to_string());
        }
        proj.set_task_pending(crate::domain::project::TaskType::Translation);
    }
    
    let _ = app.emit("app-state-changed", Value::Null);
    
    crate::application::pipeline_engine::PipelineEngine::advance_pipeline(app);
    Ok(())
}
