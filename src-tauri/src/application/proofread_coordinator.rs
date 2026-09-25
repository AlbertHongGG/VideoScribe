use crate::domain::agent::AgentType;
use crate::infrastructure::agents::AgentFactory;
use crate::domain::project::{ProjectState, TaskType};
use crate::infrastructure::providers::AIProvider;
use crate::domain::events::EventDispatcher;
use crate::application::job_manager::JobManager;

use std::sync::{Arc, Mutex};
use serde_json::{json, Value};

pub struct ProofreadCoordinator;

impl ProofreadCoordinator {
    pub fn start_proofread<F>(
        project_mutex: Arc<Mutex<ProjectState>>,
        provider: Arc<dyn AIProvider>,
        chunk_size: usize,
        dispatcher: Arc<dyn EventDispatcher>,
        job_manager: Arc<JobManager>,
        on_complete: F,
    ) -> Result<(), String>
    where F: FnOnce() + Send + 'static {
        let project = project_mutex.lock().map_err(|e| e.to_string())?;
        if project.is_results_empty() {
            return Err("No STT results to proofread".into());
        }

        job_manager.update_task_progress(TaskType::Proofread, 0.0, dispatcher.clone());

        let results_clone = project.get_results_clone();
        drop(project);

        tauri::async_runtime::spawn(async move {
            let mut chunks = Vec::new();
            for chunk in results_clone.chunks(chunk_size) {
                chunks.push(chunk.to_vec());
            }

            let total_chunks = chunks.len();
            let mut previous_context = String::new();
            let session_id = uuid::Uuid::new_v4().to_string();

            let mut all_proofread_results = results_clone.clone();
            let mut was_cancelled = false;

            for (i, chunk) in chunks.iter().enumerate() {
                if job_manager.is_cancelled() {
                    eprintln!("Proofreading cancelled by token");
                    was_cancelled = true;
                    break;
                }

                let agent = match AgentFactory::create_agent(&AgentType::ProofreaderAgent, provider.clone()) {
                    Ok(a) => a,
                    Err(e) => {
                        eprintln!("Failed to create ProofreaderAgent: {}", e);
                        job_manager.fail_job(e.to_string(), dispatcher.clone());
                        let _ = dispatcher.emit("error", json!({"message": format!("ProofreaderAgent error: {}", e)}));
                        on_complete();
                        return;
                    }
                };

                let start_idx = i * chunk_size;
                let sentences = chunk.iter().enumerate().map(|(idx, r)| {
                    json!({
                        "id": start_idx + idx,
                        "text": r.text
                    })
                }).collect::<Vec<_>>();

                let payload = json!({
                    "sentences": sentences,
                    "previousContext": previous_context,
                    "sessionId": session_id
                });

                match agent.execute(payload).await {
                    Ok(response) => {
                        // Delta Overwrite: response is an array of { id, text }
                        if let Some(arr) = response.as_array() {
                            for item in arr {
                                if let (Some(id), Some(new_text)) = (
                                    item.get("id").and_then(|v| v.as_u64()),
                                    item.get("text").and_then(|v| v.as_str()),
                                ) {
                                    if let Some(res) = all_proofread_results.get_mut(id as usize) {
                                        let trimmed = new_text.trim();
                                        if !trimmed.is_empty() && trimmed != res.text {
                                            println!("[ProofreadCoordinator] Correcting id {}: '{}' -> '{}'", id, res.text, trimmed);
                                            res.text = trimmed.to_string();
                                        }
                                    }
                                }
                            }
                        }
                    }
                    Err(e) => {
                        eprintln!("Proofreading chunk {} failed: {}", i, e);
                        job_manager.fail_job(e.to_string(), dispatcher.clone());
                        let _ = dispatcher.emit("error", json!({"message": format!("Proofreading failed: {}", e)}));
                        on_complete();
                        return;
                    }
                }

                // Update context for next chunk
                if chunk.len() > 3 {
                    previous_context = chunk.iter().skip(chunk.len() - 3).map(|r| r.text.clone()).collect::<Vec<_>>().join(" ");
                } else {
                    previous_context = chunk.iter().map(|r| r.text.clone()).collect::<Vec<_>>().join(" ");
                }

                // Update project state with latest progress
                if let Ok(mut proj) = project_mutex.lock() {
                    proj.results = all_proofread_results.clone();
                }
                let progress = ((i + 1) as f64 / total_chunks as f64) * 100.0;
                job_manager.update_task_progress(TaskType::Proofread, progress, dispatcher.clone());
                let _ = dispatcher.emit("app-state-changed", Value::Null);
            }

            if !was_cancelled {
                if let Ok(mut proj) = project_mutex.lock() {
                    proj.results = all_proofread_results;
                }
                job_manager.complete_task(TaskType::Proofread, dispatcher.clone());
                let _ = dispatcher.emit("app-state-changed", Value::Null);
            }

            on_complete();
        });

        Ok(())
    }
}
