use tauri::{AppHandle, State};
use crate::infrastructure::state::AppState;

#[tauri::command]
#[specta::specta]
pub fn start_proofread(
    app: AppHandle, 
    state: State<'_, AppState>
) -> Result<(), String> {
    let dispatcher = std::sync::Arc::new(crate::infrastructure::tauri_events::TauriEventDispatcher::new(app.clone()));
    state.job_manager.add_tasks(vec![crate::domain::project::TaskType::Proofread], dispatcher)?;
    
    crate::application::pipeline_engine::PipelineEngine::advance_pipeline(app);
    Ok(())
}
