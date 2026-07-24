use serde::{Deserialize, Serialize};
use ts_rs::TS;
use specta::Type;

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
    Mss,
    Vad,
    Stt,
    ForcedAlignment,
    Translation,
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
    pub tasks: Vec<PipelineTask>,
    pub results: Vec<STTResult>,
    pub target_language: String,
    pub vocals_audio_path: Option<String>,
    pub background_audio_path: Option<String>,
}

impl Default for ProjectState {
    fn default() -> Self {
        Self {
            video_path: None,
            tasks: Vec::new(),
            results: Vec::new(),
            target_language: "zh-TW".to_string(),
            vocals_audio_path: None,
            background_audio_path: None,
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
    }
    
    pub fn ensure_task_exists(&mut self, task_type: TaskType) {
        if !self.tasks.iter().any(|t| t.task_type == task_type) {
            self.tasks.push(PipelineTask {
                task_type,
                status: TaskStatus::Pending,
                progress: 0.0,
                error_message: None,
            });
        }
    }

    pub fn get_task_mut(&mut self, task_type: &TaskType) -> Option<&mut PipelineTask> {
        self.tasks.iter_mut().find(|t| t.task_type == *task_type)
    }

    pub fn update_task_progress(&mut self, task_type: TaskType, progress: f64) {
        if let Some(task) = self.get_task_mut(&task_type) {
            task.status = TaskStatus::Running;
            task.progress = progress;
        }
    }

    pub fn complete_task(&mut self, task_type: TaskType) {
        if let Some(task) = self.get_task_mut(&task_type) {
            task.status = TaskStatus::Completed;
            task.progress = 100.0;
        }
    }

    pub fn fail_task(&mut self, task_type: TaskType, error: String) {
        if let Some(task) = self.get_task_mut(&task_type) {
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

    pub fn cancel_pipeline(&mut self) {
        for t in self.tasks.iter_mut() {
            if t.status == TaskStatus::Running || t.status == TaskStatus::Pending {
                t.status = TaskStatus::Cancelled;
            }
        }
    }

    pub fn is_pipeline_running(&self) -> bool {
        self.tasks.iter().any(|t| t.status == TaskStatus::Running)
    }
}
