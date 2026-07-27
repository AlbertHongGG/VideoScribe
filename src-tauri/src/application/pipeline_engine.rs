use std::sync::Arc;
use tauri::{AppHandle, Manager};
use crate::domain::project::{TaskStatus, TaskType};
use crate::infrastructure::state::AppState;
use crate::infrastructure::tauri_events::TauriEventDispatcher;

pub struct PipelineEngine;

impl PipelineEngine {
    pub fn advance_pipeline(app: AppHandle) {
        if let Some(state) = app.try_state::<AppState>() {
            let project = match state.project.lock() {
                Ok(p) => p,
                Err(e) => {
                    eprintln!("PipelineEngine: Failed to lock project state: {}", e);
                    return;
                }
            };
            
            // Check if any task is running. If so, we must wait.
            if project.tasks.iter().any(|t| t.status == TaskStatus::Running) {
                return;
            }
            
            // Find the next pending task based on fixed order
            if let Some(next_task) = project.tasks.iter().find(|t| t.status == TaskStatus::Pending).map(|t| t.task_type.clone()) {
                // If it's a python task, we must group contiguous pending python tasks
                match next_task {
                    TaskType::Mss | TaskType::Vad | TaskType::Stt | TaskType::ForcedAlignment => {
                        // The python worker naturally processes all of these as a batch if requested.
                        // For manual pipeline advance, the SttJobController's `start_job` currently handles python dispatch.
                        // However, `advance_pipeline` is strictly for Rust-level orchestration (Segmentation/Translation).
                        // If the user manually triggered Stt, `start_job` sets them to Pending and dispatches Python.
                        // When Python emits events, SttJobController handles it.
                        // When STT finishes, SttJobController calls `advance_pipeline()`.
                        // Therefore, if the next pending task is a python task, it means Python is already handling it
                        // or will handle it via SttJobController. PipelineEngine just waits.
                        return;
                    }
                    TaskType::Segmentation => {
                        let dispatcher = Arc::new(TauriEventDispatcher::new(app.clone()));
                        let segmenter_provider = state.segmenter_provider.clone();
                        let segmenter_chunk = state.config.segmenter_batch_size;
                        let project_mutex = state.project.clone();
                        
                        // Drop lock before spawning
                        drop(project);
                        
                        tauri::async_runtime::spawn(async move {
                            let app_clone = app.clone();
                            if let Err(e) = crate::application::segmentation_coordinator::SegmentationCoordinator::start_segmentation(
                                project_mutex, segmenter_provider, segmenter_chunk, dispatcher, move || {
                                    crate::application::pipeline_engine::PipelineEngine::advance_pipeline(app_clone);
                                }
                            ) {
                                eprintln!("Failed to start segmentation: {}", e);
                            }
                        });
                    }
                    TaskType::Translation => {
                        let dispatcher = Arc::new(TauriEventDispatcher::new(app.clone()));
                        let provider = state.translator_provider.clone();
                        let translator_chunk = state.config.translator_batch_size;
                        let project_mutex = state.project.clone();
                        
                        // Drop lock before spawning
                        drop(project);
                        
                        tauri::async_runtime::spawn(async move {
                            let app_clone = app.clone();
                            if let Err(e) = crate::application::translation_coordinator::TranslationCoordinator::start_translation(
                                project_mutex, provider, translator_chunk, dispatcher, move || {
                                    crate::application::pipeline_engine::PipelineEngine::advance_pipeline(app_clone);
                                }
                            ) {
                                eprintln!("Failed to start translation: {}", e);
                            }
                        });
                    }
                }
            }
        }
    }
}
