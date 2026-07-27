use tauri::{AppHandle, State};
use std::sync::Arc;
use crate::infrastructure::state::AppState;
use crate::infrastructure::tauri_events::TauriEventDispatcher;
use crate::application::segmentation_coordinator::SegmentationCoordinator;

#[tauri::command]
#[specta::specta]
pub fn start_segmentation(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let dispatcher = Arc::new(TauriEventDispatcher::new(app));
    // Reusing translator_provider since segmenter is an LLM agent too, or a specific one if configured
    SegmentationCoordinator::start_segmentation(
        state.project.clone(),
        state.segmenter_provider.clone(),
        state.translator_provider.clone(),
        state.config.segmenter_batch_size,
        state.config.translator_batch_size,
        dispatcher
    )
}
