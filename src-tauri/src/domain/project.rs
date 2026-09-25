use serde::{Deserialize, Serialize};
use ts_rs::TS;
use specta::Type;


use crate::domain::stt_job::WordTiming;
use crate::domain::language::RubySegment;

#[derive(Debug, Serialize, Deserialize, Clone, TS, Type)]
#[ts(export, export_to = "../../src/types/app_types.ts")]
pub struct STTResult {
    pub start: f64,
    pub end: f64,
    pub text: String,
    pub translation: Option<String>,
    pub words: Option<Vec<WordTiming>>,
    pub ruby: Option<Vec<RubySegment>>,
}

#[derive(Debug, Serialize, Deserialize, Clone, TS, Type, PartialEq)]
#[ts(export, export_to = "../../src/types/app_types.ts")]
#[serde(rename_all = "snake_case")]
pub enum TaskType {
    Preprocess,
    Mss,
    Vad,
    Stt,
    ForcedAlignment,
    Segmentation,
    RubyAnnotation,
    Translation,
}

impl TaskType {
    pub fn order_index(&self) -> usize {
        match self {
            TaskType::Preprocess => 0,
            TaskType::Mss => 1,
            TaskType::Vad => 2,
            TaskType::Stt => 3,
            TaskType::ForcedAlignment => 4,
            TaskType::Segmentation => 5,
            TaskType::RubyAnnotation => 6,
            TaskType::Translation => 7,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, TS, Type, PartialEq)]
#[ts(export, export_to = "../../src/types/app_types.ts")]
#[serde(rename_all = "snake_case")]
pub enum TaskStatus {
    Pending,
    Running,
    Completed,
    Error,
    Cancelled,
    Outdated,
}

#[derive(Debug, Serialize, Deserialize, Clone, TS, Type)]
#[ts(export, export_to = "../../src/types/app_types.ts")]
pub struct PipelineTask {
    pub task_type: TaskType,
    pub status: TaskStatus,
    pub progress: f64,
    pub error_message: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, TS, Type)]
#[ts(export, export_to = "../../src/types/app_types.ts")]
pub struct VadSegment {
    pub start: f64,
    pub end: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone, TS, Type)]
#[ts(export, export_to = "../../src/types/app_types.ts")]
pub struct ProjectState {
    pub workspace_dir: Option<String>,
    pub video_path: Option<String>,
    pub extracted_audio_path: Option<String>,
    pub results: Vec<STTResult>,
    pub target_language: String,
    pub source_language: Option<String>,
    pub vocals_audio_path: Option<String>,
    pub background_audio_path: Option<String>,
    pub stt_model_size: Option<String>,
    pub vad_engine: Option<String>,
    pub mss_engine: Option<String>,
    pub mss_model: Option<String>,
    pub fa_engine: Option<String>,
    pub fa_model: Option<String>,
    pub use_batch: bool,
    pub batch_size: i32,
    pub vad_segments: Option<Vec<VadSegment>>,
    pub enable_furigana: bool,
}

impl Default for ProjectState {
    fn default() -> Self {
        Self {
            workspace_dir: None,
            video_path: None,
            extracted_audio_path: None,
            results: Vec::new(),
            target_language: "zh-TW".to_string(),
            source_language: None,
            vocals_audio_path: None,
            background_audio_path: None,
            stt_model_size: None,
            vad_engine: None,
            mss_engine: None,
            mss_model: None,
            fa_engine: None,
            fa_model: None,
            use_batch: false,
            batch_size: 1,
            vad_segments: None,
            enable_furigana: false,
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

    pub fn add_stt_result(&mut self, result: STTResult) {
        self.results.push(result);
    }

    pub fn import_results(&mut self, results: Vec<STTResult>) {
        self.results = results;
    }
}
