use crate::domain::project::ProjectState;
use crate::domain::events::EventDispatcher;
use crate::domain::stt::STTProvider;
use std::sync::{Arc, Mutex};
use serde_json::Value;

pub struct SttService;

impl SttService {
    pub fn run_stt(
        project_mutex: Arc<Mutex<ProjectState>>,
        dispatcher: Arc<dyn EventDispatcher>,
        provider: Arc<dyn STTProvider>,
        video_path: String,
        model_size: String
    ) -> Result<(), String> {
        let dispatcher_clone = dispatcher.clone();
        
        provider.start_transcription(
            &video_path,
            &model_size,
            Box::new(move |json: Value| {
                if let Some(typ) = json.get("type").and_then(|t| t.as_str()) {
                    if let Ok(mut project) = project_mutex.lock() {
                        match typ {
                            "progress" => {
                                if let Some(status) = json.get("status").and_then(|s| s.as_str()) {
                                    let stt_status = match status {
                                        "loading_model" => crate::domain::project::STTStatus::LoadingModel,
                                        "transcribing" => crate::domain::project::STTStatus::Transcribing,
                                        "completed" => crate::domain::project::STTStatus::Completed,
                                        "error" => crate::domain::project::STTStatus::Error,
                                        _ => crate::domain::project::STTStatus::Idle,
                                    };
                                    project.set_stt_status(stt_status);
                                }
                                if let Some(prog) = json.get("progress").and_then(|p| p.as_f64()) {
                                    project.update_stt_progress(prog);
                                }
                            }
                            "result" => {
                                if let (Some(start), Some(end), Some(text)) = (
                                    json.get("start").and_then(|v| v.as_f64()),
                                    json.get("end").and_then(|v| v.as_f64()),
                                    json.get("text").and_then(|v| v.as_str()),
                                ) {
                                    project.add_stt_result(crate::domain::project::STTResult {
                                        start,
                                        end,
                                        text: text.to_string(),
                                        translation: None,
                                    });
                                }
                            }
                            "error" => {
                                project.set_stt_error();
                            }
                            _ => {}
                        }
                    }
                    let _ = dispatcher_clone.emit("app-state-changed", Value::Null);
                }
                
                let _ = dispatcher_clone.emit("stt-progress", json);
            })
        )
    }
}
