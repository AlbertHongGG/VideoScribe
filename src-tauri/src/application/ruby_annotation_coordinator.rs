use crate::domain::agent::AgentType;
use crate::infrastructure::agents::AgentFactory;
use crate::domain::project::{ProjectState, TaskType};
use crate::domain::language::{RubySegment, RubyAnnotationProvider};
use crate::infrastructure::providers::AIProvider;
use crate::infrastructure::plugins::PluginManager;
use crate::domain::events::EventDispatcher;
use crate::application::job_manager::JobManager;

use std::sync::{Arc, Mutex};
use serde_json::{json, Value};

pub struct RubyAnnotationCoordinator;

impl RubyAnnotationCoordinator {
    pub fn start_ruby_annotation<F>(
        project_mutex: Arc<Mutex<ProjectState>>,
        provider: Arc<dyn AIProvider>,
        plugin_manager: Arc<PluginManager>,
        batch_size: usize,
        dispatcher: Arc<dyn EventDispatcher>,
        job_manager: Arc<JobManager>,
        on_complete: F,
    ) -> Result<(), String>
    where F: FnOnce() + Send + 'static {
        let mut project = project_mutex.lock().map_err(|e| e.to_string())?;
        if project.is_results_empty() {
            return Err("No STT results to annotate".into());
        }

        job_manager.update_task_progress(TaskType::RubyAnnotation, 0.0, dispatcher.clone());

        let is_japanese = project.source_language.as_deref() == Some("ja")
            || project.source_language.as_deref() == Some("auto")
            || project.results.iter().any(|r| {
                r.text.chars().any(|c| ('\u{3040}'..='\u{309f}').contains(&c) || ('\u{30a0}'..='\u{30ff}').contains(&c) || ('\u{4e00}'..='\u{9faf}').contains(&c))
            });

        if !is_japanese {
            println!("[RubyAnnotationCoordinator] Non-Japanese text detected, safely skipping RubyAnnotation task.");
            job_manager.complete_task(TaskType::RubyAnnotation, dispatcher);
            drop(project);
            on_complete();
            return Ok(());
        }

        // Auto-Baseline Injection: Ensure all results have a baseline UniDic annotation
        if let Some(ruby_provider) = plugin_manager.get_service::<dyn RubyAnnotationProvider>("japanese") {
            for res in &mut project.results {
                if res.ruby.is_none() {
                    if let Ok(ruby) = ruby_provider.annotate(&res.text) {
                        res.ruby = Some(ruby);
                    }
                }
            }
        }

        let results_clone = project.get_results_clone();
        drop(project);

        tauri::async_runtime::spawn(async move {
            let mut chunks = Vec::new();
            for chunk in results_clone.chunks(batch_size) {
                chunks.push(chunk.to_vec());
            }

            let total_chunks = chunks.len();
            let mut previous_context = String::new();
            let session_id = uuid::Uuid::new_v4().to_string();

            let mut all_annotated_results = results_clone.clone();
            let mut was_cancelled = false;

            for (i, chunk) in chunks.iter().enumerate() {
                if job_manager.is_cancelled() {
                    eprintln!("Ruby annotation cancelled by token");
                    was_cancelled = true;
                    break;
                }

                let agent = match AgentFactory::create_agent(&AgentType::RubyAnnotatorAgent, provider.clone()) {
                    Ok(a) => a,
                    Err(e) => {
                        eprintln!("Failed to create RubyAnnotatorAgent: {}", e);
                        job_manager.fail_job(e.to_string(), dispatcher.clone());
                        let _ = dispatcher.emit("error", json!({"message": format!("RubyAnnotatorAgent error: {}", e)}));
                        on_complete();
                        return;
                    }
                };

                let start_idx = i * batch_size;
                let sentences = chunk.iter().enumerate().map(|(idx, r)| {
                    json!({
                        "id": start_idx + idx,
                        "text": r.text,
                        "current_ruby": r.ruby
                    })
                }).collect::<Vec<_>>();

                let payload = json!({
                    "sentences": sentences,
                    "previousContext": previous_context,
                    "sessionId": session_id
                });

                match agent.execute(payload).await {
                    Ok(response) => {
                        // Delta Overwrite: response is an array of { id, ruby }
                        if let Some(arr) = response.as_array() {
                            for item in arr {
                                if let (Some(id), Some(ruby_val)) = (
                                    item.get("id").and_then(|v| v.as_u64()),
                                    item.get("ruby"),
                                ) {
                                    if let Ok(ruby_segments) = serde_json::from_value::<Vec<RubySegment>>(ruby_val.clone()) {
                                        if let Some(res) = all_annotated_results.get_mut(id as usize) {
                                            res.ruby = Some(ruby_segments);
                                        }
                                    }
                                }
                            }
                        }
                    }
                    Err(e) => {
                        eprintln!("Ruby annotation chunk {} failed: {}", i, e);
                        job_manager.fail_job(e.to_string(), dispatcher.clone());
                        let _ = dispatcher.emit("error", json!({"message": format!("Ruby annotation failed: {}", e)}));
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
                    proj.results = all_annotated_results.clone();
                }
                let progress = ((i + 1) as f64 / total_chunks as f64) * 100.0;
                job_manager.update_task_progress(TaskType::RubyAnnotation, progress, dispatcher.clone());
                let _ = dispatcher.emit("app-state-changed", Value::Null);
            }

            if !was_cancelled {
                if let Ok(mut proj) = project_mutex.lock() {
                    proj.results = all_annotated_results;
                }
                job_manager.complete_task(TaskType::RubyAnnotation, dispatcher.clone());
                let _ = dispatcher.emit("app-state-changed", Value::Null);
            }

            on_complete();
        });

        Ok(())
    }
}
