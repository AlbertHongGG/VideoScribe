use serde::{Deserialize, Serialize};
use crate::domain::stt_job::SttCue;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartPayload {
    pub video_path: String,
    pub model: String,
    pub language: String,
    pub vad_engine: String,
    pub mss_engine: String,
    pub mss_model: String,
    pub use_batch: bool,
    pub batch_size: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "action", rename_all = "snake_case")]
pub enum WorkerCommand {
    Start {
        job_id: String,
        payload: StartPayload,
    },
    Cancel {
        job_id: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct JobStateData {
    pub job_id: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub progress: Option<u8>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub language: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub runtime_device: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub runtime_compute_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vocals_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub instrumental_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct SegmentBatchData {
    pub job_id: String,
    pub cues: Vec<SttCue>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct ErrorData {
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "event", content = "data", rename_all = "snake_case")]
pub enum WorkerEventData {
    JobState(JobStateData),
    SegmentBatch(SegmentBatchData),
    Error(ErrorData),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkerEvent {
    pub version: u32,
    #[serde(flatten)]
    pub data: WorkerEventData,
}
