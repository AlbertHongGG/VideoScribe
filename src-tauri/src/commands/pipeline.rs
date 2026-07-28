use tauri::{AppHandle, State, Emitter};
use std::sync::Arc;
use serde_json::Value;

use crate::application::python_client::PythonWorkerClient;
use crate::domain::project::{STTResult, TaskType};
use crate::infrastructure::state::AppState;
use crate::application::pipeline_engine::PipelineEngine;

use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PipelineConfig {
    pub video_path: String,
    pub model_size: String,
    pub language: String,
    pub vad_engine: String,
    pub mss_engine: String,
    pub mss_model: String,
    pub fa_engine: String,
    pub fa_model: String,
    pub use_batch: bool,
    pub batch_size: i32,
    pub enable_segmentation: bool,
    pub enable_translation: bool,
    pub target_language: String,
}

#[tauri::command]
#[specta::specta]
pub fn trigger_pipeline(
    args: PipelineConfig,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<String, String> {
    if let Ok(mut proj) = state.project.lock() {
        if proj.is_pipeline_running() {
            return Err("A job is already running".to_string());
        }
        
        let mut tasks = Vec::new();
        
        // Explicit Audio Extraction Step for videos
        let ext = std::path::Path::new(&args.video_path)
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_lowercase();
        
        if ["mp4", "mov", "mkv", "avi", "webm"].contains(&ext.as_str()) {
            tasks.push(TaskType::Preprocess);
        }
        
        if args.mss_engine != "off" { tasks.push(TaskType::Mss); }
        if args.vad_engine != "off" { tasks.push(TaskType::Vad); }
        tasks.push(TaskType::Stt);
        if args.fa_engine != "off" { tasks.push(TaskType::ForcedAlignment); }
        if args.enable_segmentation { tasks.push(TaskType::Segmentation); }
        if args.enable_translation { tasks.push(TaskType::Translation); }
        
        proj.init_pipeline(tasks);
        
        // Save args to project state so pipeline engine can use them
        proj.target_language = args.target_language.clone();
        proj.video_path = Some(args.video_path.clone());
        proj.stt_model_size = Some(args.model_size.clone());
        proj.vad_engine = Some(args.vad_engine.clone());
        proj.mss_engine = Some(args.mss_engine.clone());
        proj.mss_model = Some(args.mss_model.clone());
        proj.fa_engine = Some(args.fa_engine.clone());
        proj.fa_model = Some(args.fa_model.clone());
        proj.use_batch = args.use_batch;
        proj.batch_size = args.batch_size;
    }
    
    let _ = app.emit("app-state-changed", Value::Null);
    
    PipelineEngine::advance_pipeline(app);

    // Job ID is now generated internally by pipeline, return dummy or actual
    Ok(uuid::Uuid::new_v4().to_string())
}

#[tauri::command]
#[specta::specta]
pub fn cancel_pipeline(
    app: AppHandle,
    state: State<'_, AppState>,
    client: State<'_, Arc<PythonWorkerClient>>
) -> Result<(), String> {
    if let Ok(mut proj) = state.project.lock() {
        proj.cancel_pipeline();
    }
    let _ = client.cancel_job("".to_string());
    let _ = app.emit("app-state-changed", Value::Null);
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
pub fn dismiss_pipeline_status(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    if let Ok(mut proj) = state.project.lock() {
        proj.dismiss_pipeline_status();
    }
    let _ = app.emit("app-state-changed", Value::Null);
    Ok(())
}
