use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct SttCue {
    pub id: String,
    pub ordinal: i32,
    pub start_ms: i32,
    pub end_ms: i32,
    pub text: String,
}

#[derive(Debug, Clone)]
pub struct SttJobContext {
    pub job_id: String,
    pub is_cancelling: bool,
}

impl SttJobContext {
    pub fn new() -> Self {
        Self {
            job_id: uuid::Uuid::new_v4().to_string(),
            is_cancelling: false,
        }
    }
}
