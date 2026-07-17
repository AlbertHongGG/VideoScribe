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

impl ProjectState {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn is_results_empty(&self) -> bool {
        self.results.is_empty()
    }

    pub fn get_results_clone(&self) -> Vec<STTResult> {
        self.results.clone()
    }

    pub fn get_target_language(&self) -> &str {
        &self.target_language
    }

    pub fn start_translation(&mut self) {
        self.translation_status = TranslationStatus::Translating;
        self.translation_progress = 0.0;
    }

    pub fn update_translation_progress(&mut self, progress: f64, partial_results: Vec<STTResult>) {
        self.translation_progress = progress;
        self.results = partial_results;
    }

    pub fn complete_translation(&mut self, final_results: Vec<STTResult>) {
        self.translation_status = TranslationStatus::Completed;
        self.translation_progress = 100.0;
        self.results = final_results;
    }

    pub fn set_stt_status(&mut self, status: STTStatus) {
        self.stt_status = status;
    }

    pub fn update_stt_progress(&mut self, progress: f64) {
        self.stt_progress = progress;
    }

    pub fn add_stt_result(&mut self, result: STTResult) {
        self.results.push(result);
    }

    pub fn set_stt_error(&mut self) {
        self.stt_status = STTStatus::Error;
    }
}
