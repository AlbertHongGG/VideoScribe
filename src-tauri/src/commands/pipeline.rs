use tauri::{AppHandle, State, Emitter};
use std::sync::Arc;
use serde_json::Value;

use crate::application::python_client::PythonWorkerClient;
pub use crate::domain::project::{PipelineConfig, STTResult};
use crate::infrastructure::state::AppState;
use crate::application::pipeline_engine::PipelineEngine;
use crate::infrastructure::tauri_events::TauriEventDispatcher;

#[tauri::command]
#[specta::specta]
pub fn trigger_pipeline(
    args: PipelineConfig,
    app: AppHandle,
    state: State<'_, AppState>,
    client: State<'_, Arc<PythonWorkerClient>>,
) -> Result<String, String> {
    if client.is_cancelling() {
        return Err("Worker is currently cancelling a previous task. Please wait.".to_string());
    }

    if state.job_manager.is_running() {
        return Err("A job is already running".to_string());
    }

    if let Ok(mut proj) = state.project.lock() {
        let tasks = proj.determine_pipeline_tasks(&args);
        
        let dispatcher = Arc::new(TauriEventDispatcher::new(app.clone()));
        let _job_id = state.job_manager.start_new_job(tasks.clone(), dispatcher)?;
        
        // Authoritative domain operations: cache invalidation and arguments persistence
        proj.invalidate_task_caches(&tasks, args.mss_engine == "off");
        let workspace_dir = crate::infrastructure::workspace_manager::WorkspaceManager::get_or_create_workspace(&args.video_path);
        proj.apply_pipeline_args(&args, workspace_dir);
    }
    
    let _ = app.emit("app-state-changed", Value::Null);
    
    PipelineEngine::advance_pipeline(app);

    Ok("".to_string())
}

#[tauri::command]
#[specta::specta]
pub fn cancel_pipeline(
    app: AppHandle,
    state: State<'_, AppState>,
    client: State<'_, Arc<PythonWorkerClient>>
) -> Result<(), String> {
    let dispatcher = Arc::new(TauriEventDispatcher::new(app.clone()));
    state.job_manager.cancel_job(dispatcher);
    

    let _ = client.cancel_job("".to_string());
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn import_pipeline_results(app: AppHandle, results: Vec<STTResult>, state: State<'_, AppState>) -> Result<(), String> {
    if let Ok(mut project) = state.project.lock() {
        project.import_results(results);
    }
    let _ = app.emit("app-state-changed", Value::Null);
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn dismiss_job(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let dispatcher = std::sync::Arc::new(crate::infrastructure::tauri_events::TauriEventDispatcher::new(app));
    state.job_manager.dismiss_job(dispatcher);
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn get_current_job(state: State<'_, AppState>) -> Result<Option<crate::domain::job::Job>, String> {
    Ok(state.job_manager.get_current_job())
}

