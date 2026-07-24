use tauri::State;
use std::sync::Arc;
use crate::application::stt_job_controller::SttJobController;
// use crate::domain::stt_job::SttJobSnapshot;
use crate::domain::project::STTResult;
use crate::infrastructure::state::AppState;

use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct StartSttJobArgs {
    pub video_path: String,
    pub model_size: String,
    pub language: String,
    pub vad_engine: String,
    pub mss_engine: String,
    pub mss_model: String,
    pub fa_engine: String,
    pub fa_model: String,
    pub use_batch: bool,
    pub batch_size: u32,
    pub enable_translation: bool,
}

#[tauri::command]
#[specta::specta]
pub fn start_stt_job(
    args: StartSttJobArgs,
    state: State<'_, Arc<SttJobController>>,
) -> Result<String, String> {
    let manager = state.inner();
    manager.start_job(args.video_path, args.model_size, args.language, args.vad_engine, args.mss_engine, args.mss_model, args.fa_engine, args.fa_model, args.use_batch, args.batch_size, args.enable_translation)
}

#[tauri::command]
#[specta::specta]
pub fn cancel_stt_job(
    job_id: String,
    manager: State<'_, Arc<SttJobController>>
) -> Result<(), String> {
    manager.cancel_job(job_id)
}

// get_stt_job_state removed since ProjectState is the single source of truth

#[tauri::command]
#[specta::specta]
pub fn import_stt_results(results: Vec<STTResult>, state: State<'_, AppState>) -> Result<(), String> {
    if let Ok(mut project) = state.project.lock() {
        project.import_results(results);
    }
    Ok(())
}
