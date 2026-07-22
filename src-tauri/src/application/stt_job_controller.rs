use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use uuid::Uuid;
use tauri::{AppHandle, Emitter, Manager};

use crate::domain::stt_job::{SttJobSnapshot, SttStatus};
use crate::domain::ipc_models::{WorkerCommand, WorkerEvent, WorkerEventData, StartPayload};
use crate::application::worker_process::WorkerProcess;

pub struct SttJobController {
    process: Arc<WorkerProcess>,
    current_job: Arc<Mutex<Option<SttJobSnapshot>>>,
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

    fn handle_event(event: &WorkerEvent, current_job: &Arc<Mutex<Option<SttJobSnapshot>>>, app: &AppHandle) {
        match &event.data {
            WorkerEventData::JobState(data) => {
                if let Ok(mut job_lock) = current_job.lock() {
                    let mut snapshot = job_lock.clone().unwrap_or_else(|| SttJobSnapshot::new_idle());
                    snapshot.job_id = data.job_id.clone();
                    
                    snapshot.status = match data.status.as_str() {
                        "idle" => SttStatus::Idle,
                        "starting" => SttStatus::Starting,
                        "loading_model" => SttStatus::LoadingModel,
                        "transcribing" => SttStatus::Transcribing,
                        "cancelling" => SttStatus::Cancelling,
                        "completed" => SttStatus::Completed,
                        "cancelled" => SttStatus::Cancelled,
                        "failed" => SttStatus::Failed,
                        _ => snapshot.status,
                    };
                    
                    if let Some(progress) = data.progress {
                        snapshot.progress = progress;
                    }
                    if let Some(ref lang) = data.language {
                        snapshot.language = Some(lang.clone());
                    }
                    if let Some(ref err) = data.error_message {
                        snapshot.error_message = Some(err.clone());
                    }
                    if let Some(ref device) = data.runtime_device {
                        snapshot.runtime_device = Some(device.clone());
                    }
                    if let Some(ref ct) = data.runtime_compute_type {
                        snapshot.runtime_compute_type = Some(ct.clone());
                    }
                    if let Some(ref v) = data.vocals_path {
                        snapshot.vocals_path = Some(v.clone());
                    }
                    if let Some(ref inst) = data.instrumental_path {
                        snapshot.instrumental_path = Some(inst.clone());
                    }

                    if let Some(state) = app.try_state::<crate::infrastructure::state::AppState>() {
                        if let Ok(mut proj) = state.project.lock() {
                            if let Some(ref v) = data.vocals_path {
                                proj.vocals_audio_path = Some(v.clone());
                            }
                            if let Some(ref inst) = data.instrumental_path {
                                proj.background_audio_path = Some(inst.clone());
                            }
                        }
                    }
                    
                    *job_lock = Some(snapshot.clone());
                    let _ = app.emit("stt_job_state", snapshot);
                }
            }
            WorkerEventData::SegmentBatch(data) => {
                let _ = app.emit("stt_segment_batch", data);
            }
            WorkerEventData::Error(data) => {
                // If it's a fatal internal error, update the state to Failed
                if let Ok(mut job_lock) = current_job.lock() {
                    if let Some(ref mut job) = *job_lock {
                        if job.status == SttStatus::Starting || job.status == SttStatus::Transcribing || job.status == SttStatus::LoadingModel {
                            job.status = SttStatus::Failed;
                            job.error_message = Some(data.message.clone());
                            let _ = app.emit("stt_job_state", job.clone());
                        }
                    }
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
                        if job.status == SttStatus::Cancelling {
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
                        if j.status == SttStatus::Cancelling {
                            j.status = SttStatus::Cancelled;
                            let _ = app_clone.emit("stt_job_state", j.clone());
                        }
                    }
                }
            }
        });
    }

    pub fn start_job(&self, video_path: String, model: String, language: String, vad_engine: String, mss_engine: String, mss_model: String, use_batch: bool, batch_size: u32) -> Result<String, String> {
        let _job_id = Uuid::new_v4().to_string();
        let mut job_lock = self.current_job.lock().unwrap();
        
        if let Some(job) = &*job_lock {
            if job.status != SttStatus::Idle && job.status != SttStatus::Completed && job.status != SttStatus::Failed && job.status != SttStatus::Cancelled {
                return Err("A job is already running".to_string());
            }
        }

        let new_job = SttJobSnapshot::new_idle();
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
                job.status = SttStatus::Cancelling;
                let _ = self.app.emit("stt_job_state", job.clone());
                
                let command = WorkerCommand::Cancel {
                    job_id: job_id.clone()
                };
                self.process.send_command(&command)?;
                
                *self.cancel_time.lock().unwrap() = Some(Instant::now());
            }
        }
        Ok(())
    }
    
    pub fn get_current_state(&self) -> Option<SttJobSnapshot> {
        self.current_job.lock().unwrap().clone()
    }
}
