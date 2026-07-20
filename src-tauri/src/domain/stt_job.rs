use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, specta::Type)]
#[serde(rename_all = "snake_case")]
pub enum SttStatus {
    Idle,
    Starting,
    LoadingModel,
    Transcribing,
    Cancelling,
    Completed,
    Cancelled,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct SttCue {
    pub id: String,
    pub ordinal: i32,
    pub start_ms: i32,
    pub end_ms: i32,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct SttJobSnapshot {
    pub job_id: String,
    pub status: SttStatus,
    pub progress: u8,
    pub language: Option<String>,
    pub error_message: Option<String>,
    pub runtime_device: Option<String>,
    pub runtime_compute_type: Option<String>,
}

impl SttJobSnapshot {
    pub fn new_idle() -> Self {
        Self {
            job_id: uuid::Uuid::new_v4().to_string(),
            status: SttStatus::Idle,
            progress: 0,
            language: None,
            error_message: None,
            runtime_device: None,
            runtime_compute_type: None,
        }
    }
}
