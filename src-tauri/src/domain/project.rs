use serde::{Deserialize, Serialize};
use ts_rs::TS;
use specta::Type;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use crate::domain::stt_job::WordTiming;

#[derive(Debug, Serialize, Deserialize, Clone, TS, Type)]
#[ts(export, export_to = "../../src/types/app_types.ts")]
pub struct STTResult {
    pub start: f64,
    pub end: f64,
    pub text: String,
    pub translation: Option<String>,
    pub words: Option<Vec<WordTiming>>,
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
    Translation,
    Segmentation,
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
            TaskType::Translation => 6,
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
pub struct ProjectState {
    pub video_path: Option<String>,
    pub extracted_audio_path: Option<String>,
    pub tasks: Vec<PipelineTask>,
    pub results: Vec<STTResult>,
    pub target_language: String,
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
    #[serde(skip)]
    pub cancel_token: Arc<AtomicBool>,
}

impl Default for ProjectState {
    fn default() -> Self {
        Self {
            video_path: None,
            extracted_audio_path: None,
            tasks: Vec::new(),
            results: Vec::new(),
            target_language: "zh-TW".to_string(),
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
            cancel_token: Arc::new(AtomicBool::new(false)),
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
        // Optionally, we could set tasks to show completed import here.
        // But importing skips the pipeline. We can just clear tasks.
        self.tasks.clear();
    }

    // Pipeline management methods
    pub fn init_pipeline(&mut self, tasks_to_run: Vec<TaskType>) {
        self.results.clear();
        self.tasks = tasks_to_run.into_iter().map(|task_type| PipelineTask {
            task_type,
            status: TaskStatus::Pending,
            progress: 0.0,
            error_message: None,
        }).collect();
        self.tasks.sort_by_key(|t| t.task_type.order_index());
        self.cancel_token.store(false, Ordering::SeqCst);
    }
    
    pub fn set_task_pending(&mut self, task_type: TaskType) {
        if !self.tasks.iter().any(|t| t.task_type == task_type) {
            self.tasks.push(PipelineTask {
                task_type: task_type.clone(),
                status: TaskStatus::Pending,
                progress: 0.0,
                error_message: None,
            });
        } else {
            if let Some(t) = self.get_task_mut(&task_type) {
                t.status = TaskStatus::Pending;
                t.progress = 0.0;
                t.error_message = None;
            }
        }
        
        self.tasks.sort_by_key(|t| t.task_type.order_index());
        
        let triggered_index = task_type.order_index();
        for t in self.tasks.iter_mut() {
            if t.task_type.order_index() > triggered_index {
                if t.status == TaskStatus::Completed || t.status == TaskStatus::Error || t.status == TaskStatus::Cancelled {
                    t.status = TaskStatus::Outdated;
                }
            }
        }
    }
    
    pub fn get_task_mut(&mut self, task_type: &TaskType) -> Option<&mut PipelineTask> {
        self.tasks.iter_mut().find(|t| t.task_type == *task_type)
    }

    pub fn update_task_progress(&mut self, task_type: TaskType, progress: f64) {
        if let Some(task) = self.get_task_mut(&task_type) {
            if task.status == TaskStatus::Cancelled || task.status == TaskStatus::Error || task.status == TaskStatus::Completed {
                return;
            }
            task.status = TaskStatus::Running;
            task.progress = progress;
        }
    }

    pub fn complete_task(&mut self, task_type: TaskType) {
        if let Some(task) = self.get_task_mut(&task_type) {
            if task.status == TaskStatus::Cancelled || task.status == TaskStatus::Error {
                return;
            }
            task.status = TaskStatus::Completed;
            task.progress = 100.0;
        }
    }

    pub fn fail_task(&mut self, task_type: TaskType, error: String) {
        if let Some(task) = self.get_task_mut(&task_type) {
            if task.status == TaskStatus::Cancelled || task.status == TaskStatus::Completed {
                return;
            }
            task.status = TaskStatus::Error;
            task.error_message = Some(error);
        }
        // Cancel all subsequent pending tasks
        for t in self.tasks.iter_mut() {
            if t.status == TaskStatus::Pending {
                t.status = TaskStatus::Cancelled;
            }
        }
    }
    
    pub fn dismiss_pipeline_status(&mut self) {
        self.tasks.clear();
    }

    pub fn cancel_pipeline(&mut self) {
        for t in self.tasks.iter_mut() {
            if t.status == TaskStatus::Running || t.status == TaskStatus::Pending {
                t.status = TaskStatus::Cancelled;
            }
        }
        self.cancel_token.store(true, Ordering::SeqCst);
    }

    pub fn is_pipeline_running(&self) -> bool {
        self.tasks.iter().any(|t| t.status == TaskStatus::Running)
    }
}
