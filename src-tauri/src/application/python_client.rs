use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager};

use crate::domain::project::TaskType;
use crate::domain::ipc_models::{
    WorkerCommand, WorkerEvent, WorkerEventData, 
    PreprocessPayload, MssPayload, VadPayload, SttPayload, FaPayload
};
use crate::application::worker_process::WorkerProcess;

pub struct PythonWorkerClient {
    process: Arc<WorkerProcess>,
    app: AppHandle,
    cancel_time: Arc<Mutex<Option<Instant>>>,
    is_cancelling: Arc<Mutex<bool>>,
}

impl PythonWorkerClient {
    pub fn new(app: AppHandle) -> Arc<Self> {
        let cancel_time = Arc::new(Mutex::new(None));
        let is_cancelling = Arc::new(Mutex::new(false));
        
        let app_clone = app.clone();
        let is_cancelling_clone = is_cancelling.clone();
        
        let process = WorkerProcess::new(Arc::new(move |event| {
            Self::handle_event(&event, &app_clone, &is_cancelling_clone);
        }));

        let client = Arc::new(Self {
            process,
            app,
            cancel_time,
            is_cancelling,
        });

        client.spawn_watchdog();
        client
    }

    fn handle_event(event: &WorkerEvent, app: &AppHandle, is_cancelling: &Arc<Mutex<bool>>) {
        match &event.data {
            WorkerEventData::TaskProgress(data) => {
                let task_type: Option<TaskType> = match data.task_type.as_str() {
                    "preprocess" => Some(TaskType::Preprocess),
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
                                    if tt == TaskType::Preprocess {
                                        if let Some(ref path) = data.vocals_path {
                                            proj.extracted_audio_path = Some(path.clone());
                                        }
                                    }
                                    proj.complete_task(tt.clone());
                                    
                                    // Trigger pipeline engine to execute next step!
                                    crate::application::pipeline_engine::PipelineEngine::advance_pipeline(app.clone());
                                },
                                "error" | "failed" => {
                                    proj.fail_task(tt, data.error_message.clone().unwrap_or_else(|| "Unknown error".to_string()));
                                    // Advance pipeline even on error so it stops gracefully
                                    crate::application::pipeline_engine::PipelineEngine::advance_pipeline(app.clone());
                                },
                                "cancelled" => {
                                    *is_cancelling.lock().unwrap() = false;
                                    proj.cancel_pipeline();
                                },
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
                        // generic fallback failure
                        // we can fail any pending tasks?
                        for task in &mut proj.tasks {
                            if task.status == crate::domain::project::TaskStatus::Running {
                                task.status = crate::domain::project::TaskStatus::Error;
                                task.error_message = Some(data.message.clone());
                            }
                        }
                    }
                    let _ = app.emit("app-state-changed", Value::Null);
                }
                let _ = app.emit("stt_error", data);
            }
        }
    }

    fn spawn_watchdog(self: &Arc<Self>) {
        let process_clone = self.process.clone();
        let cancel_time_clone = self.cancel_time.clone();
        let is_cancelling_clone = self.is_cancelling.clone();
        let app_clone = self.app.clone();
        
        thread::spawn(move || {
            loop {
                thread::sleep(Duration::from_secs(1));
                let mut should_restart = false;
                
                if *is_cancelling_clone.lock().unwrap() {
                    let ct_guard = cancel_time_clone.lock().unwrap();
                    if let Some(t) = *ct_guard {
                        if t.elapsed() > Duration::from_secs(5) {
                            should_restart = true;
                        }
                    }
                }
                
                if should_restart {
                    println!("Cancel timeout reached. Restarting python worker...");
                    process_clone.restart_worker();
                    *cancel_time_clone.lock().unwrap() = None;
                    *is_cancelling_clone.lock().unwrap() = false;
                    
                    if let Some(state) = app_clone.try_state::<crate::infrastructure::state::AppState>() {
                        if let Ok(mut proj) = state.project.lock() {
                            proj.cancel_pipeline();
                        }
                        let _ = app_clone.emit("app-state-changed", Value::Null);
                    }
                }
            }
        });
    }

    pub fn send_run_preprocess(&self, job_id: String, payload: PreprocessPayload) -> Result<(), String> {
        let command = WorkerCommand::RunPreprocess { job_id, payload };
        self.process.send_command(&command)?;
        Ok(())
    }

    pub fn send_run_mss(&self, job_id: String, payload: MssPayload) -> Result<(), String> {
        let command = WorkerCommand::RunMss { job_id, payload };
        self.process.send_command(&command)?;
        Ok(())
    }

    pub fn send_run_vad(&self, job_id: String, payload: VadPayload) -> Result<(), String> {
        let command = WorkerCommand::RunVad { job_id, payload };
        self.process.send_command(&command)?;
        Ok(())
    }

    pub fn send_run_stt(&self, job_id: String, payload: SttPayload) -> Result<(), String> {
        let command = WorkerCommand::RunStt { job_id, payload };
        self.process.send_command(&command)?;
        Ok(())
    }

    pub fn send_run_fa(&self, job_id: String, payload: FaPayload) -> Result<(), String> {
        let command = WorkerCommand::RunFa { job_id, payload };
        self.process.send_command(&command)?;
        Ok(())
    }

    pub fn cancel_job(&self, job_id: String) -> Result<(), String> {
        *self.is_cancelling.lock().unwrap() = true;
        
        if let Some(state) = self.app.try_state::<crate::infrastructure::state::AppState>() {
            if let Ok(mut proj) = state.project.lock() {
                proj.cancel_pipeline();
            }
            let _ = self.app.emit("app-state-changed", Value::Null);
        }
        
        let command = WorkerCommand::Cancel { job_id };
        self.process.send_command(&command)?;
        
        *self.cancel_time.lock().unwrap() = Some(Instant::now());
        Ok(())
    }
}
