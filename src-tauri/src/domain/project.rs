use serde::{Deserialize, Serialize};
use ts_rs::TS;
use specta::Type;

#[derive(Debug, Serialize, Deserialize, Clone, TS, Type)]
#[ts(export, export_to = "../../src/types/app_types.ts")]
pub struct STTResult {
    pub start: f64,
    pub end: f64,
    pub text: String,
    pub translation: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, TS, Type, PartialEq)]
#[ts(export, export_to = "../../src/types/app_types.ts")]
#[serde(rename_all = "snake_case")]
pub enum STTStatus {
    Idle,
    LoadingModel,
    Transcribing,
    Completed,
    Error,
}

#[derive(Debug, Serialize, Deserialize, Clone, TS, Type, PartialEq)]
#[ts(export, export_to = "../../src/types/app_types.ts")]
#[serde(rename_all = "snake_case")]
pub enum TranslationStatus {
    Idle,
    Translating,
    Completed,
    Error,
}

#[derive(Debug, Serialize, Deserialize, Clone, TS, Type)]
#[ts(export, export_to = "../../src/types/app_types.ts")]
pub struct ProjectState {
    pub video_path: Option<String>,
    pub stt_status: STTStatus,
    pub stt_progress: f64,
    pub translation_status: TranslationStatus,
    pub translation_progress: f64,
    pub results: Vec<STTResult>,
    pub target_language: String,
}

impl Default for ProjectState {
    fn default() -> Self {
        Self {
            video_path: None,
            stt_status: STTStatus::Idle,
            stt_progress: 0.0,
            translation_status: TranslationStatus::Idle,
            translation_progress: 0.0,
            results: Vec::new(),
            target_language: "zh-TW".to_string(),
        }
    }
}
