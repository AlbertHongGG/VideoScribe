use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager};

use crate::domain::stt_job::SttJobContext;
use crate::domain::project::{TaskType, TaskStatus};
use crate::domain::ipc_models::{WorkerCommand, WorkerEvent, WorkerEventData, StartPayload};
use crate::application::worker_process::WorkerProcess;

pub struct SttJobController {
    process: Arc<WorkerProcess>,
    current_job: Arc<Mutex<Option<SttJobContext>>>,
    app: AppHandle,
    cancel_time: Arc<Mutex<Option<Instant>>>,
}

impl SttJobController {
    pub fn new(app: AppHandle) -> Arc<Self> {
        let current_job = Arc::new(Mutex::new(None));
        let cancel_time = Arc::new(Mutex::new(None));
        
        let app_clone = app.clone();
        let job_clone = current_job.clone();
        
        let process = WorkerProcess::new(Arc::new(move |event| {
            Self::handle_event(&event, &job_clone, &app_clone);
        }));

        let controller = Arc::new(Self {
            process,
            current_job,
            app,
            cancel_time,
        });

        controller.spawn_watchdog();
        controller
    }

    fn handle_event(event: &WorkerEvent, _current_job: &Arc<Mutex<Option<SttJobContext>>>, app: &AppHandle) {
        match &event.data {
            WorkerEventData::TaskProgress(data) => {
                let task_type = match data.task_type.as_str() {
                    "mss" => Some(TaskType::Mss),
                    "vad" => Some(TaskType::Vad),
                    "stt" => Some(TaskType::Stt),
                    "forced_alignment" => Some(TaskType::ForcedAlignment),
                    _ => None,
                };
                
                if let Some(state) = app.try_state::<crate::infrastructure::state::AppState>() {
                    if let Ok(mut proj) = state.project.lock() {
                        if let Some(ref v) = data.vocals_path {
                            proj.vocals_audio_path = Some(v.clone());
                        }
                        if let Some(ref inst) = data.instrumental_path {
                            proj.background_audio_path = Some(inst.clone());
                        }
                        
                        if let Some(tt) = task_type {
                            match data.status.as_str() {
                                "completed" => {
                                    proj.complete_task(tt.clone());
                                    
                                    // If STT completed, check if we need to start translation automatically
                                    if tt == TaskType::Stt {
                                        let needs_translation = proj.tasks.iter().any(|t| t.task_type == TaskType::Translation && t.status == TaskStatus::Pending);
                                        if needs_translation {
                                            let dispatcher = Arc::new(crate::infrastructure::tauri_events::TauriEventDispatcher::new(app.clone()));
                                            let provider = state.translator_provider.clone();
                                            let project_mutex = state.project.clone();
                                            
                                            tauri::async_runtime::spawn(async move {
                                                if let Err(e) = crate::application::translation_coordinator::TranslationCoordinator::start_translation(
                                                    project_mutex, provider, dispatcher
                                                ) {
                                                    eprintln!("Failed to auto-start translation: {}", e);
                                                }
                                            });
                                        }
                                    }
                                },
                                "error" | "failed" => proj.fail_task(tt, data.error_message.clone().unwrap_or_else(|| "Unknown error".to_string())),
                                "cancelled" => proj.cancel_pipeline(),
                                _ => {
                                    if let Some(prog) = data.progress {
                                        proj.update_task_progress(tt, prog);
                                    } else {
                                        proj.update_task_progress(tt, 0.0);
                                    }
                                }
                            }
                        }
                    }
                    let _ = app.emit("app-state-changed", Value::Null);
                }
            }
            WorkerEventData::SegmentBatch(data) => {
                if let Some(state) = app.try_state::<crate::infrastructure::state::AppState>() {
                    if let Ok(mut proj) = state.project.lock() {
                        for cue in &data.cues {
                            let stt_result = crate::domain::project::STTResult {
                                start: cue.start_ms as f64 / 1000.0,
                                end: cue.end_ms as f64 / 1000.0,
                                text: cue.text.clone(),
                                translation: None,
                                words: cue.words.clone(),
                            };
                            proj.add_stt_result(stt_result);
                        }
                    }
                }
                let _ = app.emit("stt_segment_batch", data);
            }
            WorkerEventData::SegmentReplaceAll(data) => {
                if let Some(state) = app.try_state::<crate::infrastructure::state::AppState>() {
                    if let Ok(mut proj) = state.project.lock() {
                        proj.results.clear();
                        for cue in &data.cues {
                            let stt_result = crate::domain::project::STTResult {
                                start: cue.start_ms as f64 / 1000.0,
                                end: cue.end_ms as f64 / 1000.0,
                                text: cue.text.clone(),
                                translation: None,
                                words: cue.words.clone(),
                            };
                            proj.add_stt_result(stt_result);
                        }
                    }
                }
                let _ = app.emit("stt_segment_replace_all", data);
            }
            WorkerEventData::Error(data) => {
                if let Some(state) = app.try_state::<crate::infrastructure::state::AppState>() {
                    if let Ok(mut proj) = state.project.lock() {
                        proj.fail_task(TaskType::Stt, data.message.clone()); // generic fallback failure
                    }
                    let _ = app.emit("app-state-changed", Value::Null);
                }
                let _ = app.emit("stt_error", data);
            }
        }
    }

    fn spawn_watchdog(self: &Arc<Self>) {
        let process_clone = self.process.clone();
        let job_clone = self.current_job.clone();
        let cancel_time_clone = self.cancel_time.clone();
        let app_clone = self.app.clone();
        
        thread::spawn(move || {
            loop {
                thread::sleep(Duration::from_secs(1));
                let mut should_restart = false;
                {
                    let job_guard = job_clone.lock().unwrap();
                    if let Some(job) = &*job_guard {
                        if job.is_cancelling {
                            let ct_guard = cancel_time_clone.lock().unwrap();
                            if let Some(t) = *ct_guard {
                                if t.elapsed() > Duration::from_secs(5) {
                                    should_restart = true;
                                }
                            }
                        }
                    }
                }
                
                if should_restart {
                    println!("Cancel timeout reached. Restarting python worker...");
                    process_clone.restart_worker();
                    *cancel_time_clone.lock().unwrap() = None;
                    
                    let mut job_l = job_clone.lock().unwrap();
                    if let Some(ref mut j) = *job_l {
                        if j.is_cancelling {
                            j.is_cancelling = false;
                            
                            if let Some(state) = app_clone.try_state::<crate::infrastructure::state::AppState>() {
                                if let Ok(mut proj) = state.project.lock() {
                                    proj.cancel_pipeline();
                                }
                                let _ = app_clone.emit("app-state-changed", Value::Null);
                            }
                        }
                    }
                }
            }
        });
    }

    pub fn start_job(&self, video_path: String, model: String, language: String, vad_engine: String, mss_engine: String, mss_model: String, fa_engine: String, fa_model: String, use_batch: bool, batch_size: u32, enable_translation: bool) -> Result<String, String> {
        let mut job_lock = self.current_job.lock().unwrap();
        
        if let Some(state) = self.app.try_state::<crate::infrastructure::state::AppState>() {
            let mut proj = state.project.lock().unwrap();
            if proj.is_pipeline_running() {
                return Err("A job is already running".to_string());
            }
            
            let mut tasks = Vec::new();
            if mss_engine != "off" {
                tasks.push(TaskType::Mss);
            }
            if vad_engine != "off" {
                tasks.push(TaskType::Vad);
            }
            tasks.push(TaskType::Stt);
            if fa_engine != "off" {
                tasks.push(TaskType::ForcedAlignment);
            }
            if enable_translation {
                tasks.push(TaskType::Translation);
            }
            
            proj.init_pipeline(tasks);
            // Don't emit state change immediately if we emit later, but good practice
            let _ = self.app.emit("app-state-changed", Value::Null);
        }

        let new_job = SttJobContext::new();
        let job_id = new_job.job_id.clone();
        *job_lock = Some(new_job);

        let command = WorkerCommand::Start {
            job_id: job_id.clone(),
            payload: StartPayload {
                video_path,
                model,
                language,
                vad_engine,
                mss_engine,
                mss_model,
                fa_engine,
                fa_model,
                use_batch,
                batch_size,
            }
        };

        self.process.send_command(&command)?;
        Ok(job_id)
    }

    pub fn cancel_job(&self, job_id: String) -> Result<(), String> {
        let mut job_lock = self.current_job.lock().unwrap();
        if let Some(ref mut job) = *job_lock {
            if job.job_id == job_id {
                job.is_cancelling = true;
                
                if let Some(state) = self.app.try_state::<crate::infrastructure::state::AppState>() {
                    if let Ok(mut proj) = state.project.lock() {
                        proj.cancel_pipeline();
                    }
                    let _ = self.app.emit("app-state-changed", Value::Null);
                }
                
                let command = WorkerCommand::Cancel {
                    job_id: job_id.clone()
                };
                self.process.send_command(&command)?;
                
                *self.cancel_time.lock().unwrap() = Some(Instant::now());
            }
        }
        Ok(())
    }
}
