use serde::{Deserialize, Serialize};
use ts_rs::TS;
use specta::Type;
use crate::domain::project::PipelineTask;

#[derive(Debug, Serialize, Deserialize, Clone, TS, Type, PartialEq)]
#[ts(export, export_to = "../../src/types/app_types.ts")]
#[serde(rename_all = "snake_case")]
pub enum JobStatus {
    Pending,
    Running,
    Completed,
    Error,
    Cancelled,
}

#[derive(Debug, Serialize, Deserialize, Clone, TS, Type)]
#[ts(export, export_to = "../../src/types/app_types.ts")]
pub struct Job {
    pub id: String,
    pub tasks: Vec<PipelineTask>,
    pub status: JobStatus,
    pub error_message: Option<String>,
}

impl Job {
    pub fn new(tasks: Vec<PipelineTask>) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            tasks,
            status: JobStatus::Pending,
            error_message: None,
        }
    }
}
