use std::sync::Arc;
use tauri::{AppHandle, Manager};
use crate::domain::project::TaskType;
use crate::infrastructure::state::AppState;
use crate::infrastructure::tauri_events::TauriEventDispatcher;
use crate::application::python_client::PythonWorkerClient;
use crate::domain::ipc_models::{MssPayload, VadPayload, SttPayload, FaPayload};

pub struct PipelineEngine;

impl PipelineEngine {
    pub fn advance_pipeline(app: AppHandle) {
        let (next_task, project_clone, job_manager_clone) = {
            if let Some(state) = app.try_state::<AppState>() {
                let project = match state.project.lock() {
                    Ok(p) => p,
                    Err(e) => {
                        eprintln!("PipelineEngine: Failed to lock project state: {}", e);
                        return;
                    }
                };
                
                let next_task = state.job_manager.get_next_pending_task();
                (next_task, project.clone(), state.job_manager.clone())
            } else {
                return;
            }
        };

        if let Some(next_task) = next_task {
            match next_task {
                TaskType::Preprocess => {
                    if let Some(client) = app.try_state::<Arc<PythonWorkerClient>>() {
                        let video_path = project_clone.video_path.clone().unwrap_or_default();
                        let workspace_dir = std::path::Path::new(&video_path)
                            .parent()
                            .map(|p| p.to_string_lossy().to_string())
                            .unwrap_or_default();
                            
                        let payload = crate::domain::ipc_models::PreprocessPayload {
                            video_path,
                            workspace_dir,
                        };
                        let dispatcher = Arc::new(TauriEventDispatcher::new(app.clone()));
                        job_manager_clone.update_task_progress(TaskType::Preprocess, 0.0, dispatcher.clone());
                        if let Err(e) = client.send_run_preprocess(uuid::Uuid::new_v4().to_string(), payload) {
                            job_manager_clone.fail_job(e, dispatcher);
                        }
                    }
                }
                TaskType::Mss => {
                    if let Some(client) = app.try_state::<Arc<PythonWorkerClient>>() {
                        let payload = MssPayload {
                            audio_path: project_clone.extracted_audio_path.clone().or(project_clone.video_path.clone()).unwrap_or_default(),
                            mss_engine: project_clone.mss_engine.clone().unwrap_or_default(),
                            mss_model: project_clone.mss_model.clone().unwrap_or_default(),
                            workspace_dir: project_clone.workspace_dir.clone().unwrap_or_default(),
                        };
                        let dispatcher = Arc::new(TauriEventDispatcher::new(app.clone()));
                        job_manager_clone.update_task_progress(TaskType::Mss, 0.0, dispatcher.clone());
                        if let Err(e) = client.send_run_mss(uuid::Uuid::new_v4().to_string(), payload) {
                            job_manager_clone.fail_job(e, dispatcher);
                        }
                    }
                }
                TaskType::Vad => {
                    if let Some(client) = app.try_state::<Arc<PythonWorkerClient>>() {
                        let payload = VadPayload {
                            audio_path: project_clone.vocals_audio_path.clone().or(project_clone.extracted_audio_path.clone()).or(project_clone.video_path.clone()).unwrap_or_default(),
                            vad_engine: project_clone.vad_engine.clone().unwrap_or_default(),
                            workspace_dir: project_clone.workspace_dir.clone().unwrap_or_default(),
                        };
                        let dispatcher = Arc::new(TauriEventDispatcher::new(app.clone()));
                        job_manager_clone.update_task_progress(TaskType::Vad, 0.0, dispatcher.clone());
                        if let Err(e) = client.send_run_vad(uuid::Uuid::new_v4().to_string(), payload) {
                            job_manager_clone.fail_job(e, dispatcher);
                        }
                    }
                }
                TaskType::Stt => {
                    if let Some(client) = app.try_state::<Arc<PythonWorkerClient>>() {
                        let payload = SttPayload {
                            audio_path: project_clone.vocals_audio_path.clone().or(project_clone.extracted_audio_path.clone()).or(project_clone.video_path.clone()).unwrap_or_default(),
                            model: project_clone.stt_model_size.clone().unwrap_or_default(),
                            language: project_clone.source_language.clone().unwrap_or_else(|| "auto".to_string()),
                            use_batch: project_clone.use_batch,
                            batch_size: project_clone.batch_size,
                            vad_engine: project_clone.vad_engine.clone().unwrap_or_default(),
                            vad_segments: project_clone.vad_segments,
                            workspace_dir: project_clone.workspace_dir.clone().unwrap_or_default(),
                        };
                        let dispatcher = Arc::new(TauriEventDispatcher::new(app.clone()));
                        job_manager_clone.update_task_progress(TaskType::Stt, 0.0, dispatcher.clone());
                        if let Err(e) = client.send_run_stt(uuid::Uuid::new_v4().to_string(), payload) {
                            job_manager_clone.fail_job(e, dispatcher);
                        }
                    }
                }
                TaskType::ForcedAlignment => {
                    if let Some(client) = app.try_state::<Arc<PythonWorkerClient>>() {
                        let payload = FaPayload {
                            audio_path: project_clone.vocals_audio_path.clone().or(project_clone.extracted_audio_path.clone()).or(project_clone.video_path.clone()).unwrap_or_default(),
                            fa_engine: project_clone.fa_engine.clone().unwrap_or_default(),
                            fa_model: project_clone.fa_model.clone().unwrap_or_default(),
                            transcripts: project_clone.results.clone(),
                            workspace_dir: project_clone.workspace_dir.clone().unwrap_or_default(),
                        };
                        let dispatcher = Arc::new(TauriEventDispatcher::new(app.clone()));
                        job_manager_clone.update_task_progress(TaskType::ForcedAlignment, 0.0, dispatcher.clone());
                        if let Err(e) = client.send_run_fa(uuid::Uuid::new_v4().to_string(), payload) {
                            job_manager_clone.fail_job(e, dispatcher);
                        }
                    }
                }
                TaskType::Segmentation => {
                    if let Some(state) = app.try_state::<AppState>() {
                        let dispatcher = Arc::new(TauriEventDispatcher::new(app.clone()));
                        let segmenter_provider = state.segmenter_provider.clone();
                        let segmenter_chunk = state.config.segmenter_batch_size;
                        let project_mutex = state.project.clone();
                        let job_manager_clone = state.job_manager.clone();
                        
                        tauri::async_runtime::spawn(async move {
                            let app_clone = app.clone();
                            if let Err(e) = crate::application::segmentation_coordinator::SegmentationCoordinator::start_segmentation(
                                project_mutex, segmenter_provider, segmenter_chunk, dispatcher.clone(), job_manager_clone.clone(), move || {
                                    crate::application::pipeline_engine::PipelineEngine::advance_pipeline(app_clone);
                                }
                            ) {
                                eprintln!("Failed to start segmentation: {}", e);
                                job_manager_clone.fail_job(e, dispatcher);
                            }
                        });
                    }
                }
                TaskType::RubyAnnotation => {
                    if let Some(state) = app.try_state::<AppState>() {
                        let dispatcher = Arc::new(TauriEventDispatcher::new(app.clone()));
                        let provider = state.ruby_annotator_provider.clone();
                        let chunk_size = state.config.ruby_annotator_batch_size;
                        let project_mutex = state.project.clone();
                        let job_manager_clone = state.job_manager.clone();
                        let plugin_manager = state.plugin_manager.clone();

                        tauri::async_runtime::spawn(async move {
                            let app_clone = app.clone();
                            if let Err(e) = crate::application::ruby_annotation_coordinator::RubyAnnotationCoordinator::start_ruby_annotation(
                                project_mutex, provider, plugin_manager, chunk_size, dispatcher.clone(), job_manager_clone.clone(), move || {
                                    crate::application::pipeline_engine::PipelineEngine::advance_pipeline(app_clone);
                                }
                            ) {
                                eprintln!("Failed to start ruby annotation: {}", e);
                                job_manager_clone.fail_job(e, dispatcher);
                            }
                        });
                    }
                }
                TaskType::Translation => {
                    if let Some(state) = app.try_state::<AppState>() {
                        let dispatcher = Arc::new(TauriEventDispatcher::new(app.clone()));
                        let provider = state.translator_provider.clone();
                        let translator_chunk = state.config.translator_batch_size;
                        let project_mutex = state.project.clone();
                        let job_manager_clone = state.job_manager.clone();
                        
                        tauri::async_runtime::spawn(async move {
                            let app_clone = app.clone();
                            if let Err(e) = crate::application::translation_coordinator::TranslationCoordinator::start_translation(
                                project_mutex, provider, translator_chunk, dispatcher.clone(), job_manager_clone.clone(), move || {
                                    crate::application::pipeline_engine::PipelineEngine::advance_pipeline(app_clone);
                                }
                            ) {
                                eprintln!("Failed to start translation: {}", e);
                                job_manager_clone.fail_job(e, dispatcher);
                            }
                        });
                    }
                }
            }
        }
    }
}

