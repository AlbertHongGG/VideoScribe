use crate::domain::agent::AgentType;
use crate::infrastructure::agents::AgentFactory;
use crate::domain::project::{ProjectState, TaskType, STTResult};
use crate::infrastructure::providers::AIProvider;
use crate::domain::events::EventDispatcher;
use crate::domain::alignment::WordAligner;
use std::sync::atomic::Ordering;
use std::sync::{Arc, Mutex};
use serde_json::{json, Value};

pub struct SegmentationCoordinator;

impl SegmentationCoordinator {
    pub fn start_segmentation<F>(
        project_mutex: Arc<Mutex<ProjectState>>,
        segmenter_provider: Arc<dyn AIProvider>,
        segmenter_chunk_size: usize,
        dispatcher: Arc<dyn EventDispatcher>,
        on_complete: F,
    ) -> Result<(), String> 
    where F: FnOnce() + Send + 'static {
        let mut project = project_mutex.lock().map_err(|e| e.to_string())?;
        if project.is_results_empty() {
            return Err("No STT results to segment".into());
        }
        
        project.update_task_progress(TaskType::Segmentation, 0.0);
        let _ = dispatcher.emit("app-state-changed", Value::Null);
        
        let results_clone = project.get_results_clone();
        let cancel_token = project.cancel_token.clone();
        
        // We drop the lock here because the process will take a long time
        drop(project);
        
        tauri::async_runtime::spawn(async move {
            let mut chunks = Vec::new();
            for chunk in results_clone.chunks(segmenter_chunk_size) {
                chunks.push(chunk.to_vec());
            }
            
            let total_chunks = chunks.len();
            let session_id = uuid::Uuid::new_v4().to_string();
            
            let mut final_results: Vec<STTResult> = Vec::new();
            let mut was_cancelled = false;

            for (i, chunk) in chunks.iter().enumerate() {
                if cancel_token.load(Ordering::SeqCst) {
                    eprintln!("Segmentation cancelled by token");
                    was_cancelled = true;
                    break;
                }

                let agent = match AgentFactory::create_agent(&AgentType::SegmenterAgent, segmenter_provider.clone()) {
                    Ok(a) => a,
                    Err(e) => {
                        eprintln!("Failed to create segmenter agent: {}", e);
                        // Fallback: append original if agent creation fails
                        final_results.extend(chunk.clone());
                        continue;
                    }
                };

                let mut chunk_words = Vec::new();
                for res in chunk {
                    if let Some(words) = &res.words {
                        chunk_words.extend(words.clone());
                    }
                }
                
                if chunk_words.is_empty() {
                    // No words to align, just fallback
                    final_results.extend(chunk.clone());
                    continue;
                }
                
                let mut chunk_text = String::new();
                for w in &chunk_words {
                    chunk_text.push_str(&w.text);
                }

                let payload = json!({
                    "text": chunk_text,
                    "sessionId": session_id
                });

                match agent.execute(payload).await {
                    Ok(response) => {
                        let mut new_sentences = Vec::new();
                        if let Some(arr) = response.as_array() {
                            for item in arr {
                                if let Some(sent) = item.get("sentence").and_then(|v| v.as_str()) {
                                    new_sentences.push(sent.to_string());
                                }
                            }
                        }
                        
                        match WordAligner::align(chunk_words, new_sentences) {
                            Ok(aligned_results) => {
                                final_results.extend(aligned_results);
                            }
                            Err(align_err) => {
                                eprintln!("Alignment failed for chunk {}: {}", i, align_err);
                                // Fallback: just append the original chunks if alignment fails
                                final_results.extend(chunk.clone());
                            }
                        }
                    }
                    Err(e) => {
                        eprintln!("Segmentation chunk {} failed: {}", i, e);
                        if let Ok(mut proj) = project_mutex.lock() {
                            proj.fail_task(TaskType::Segmentation, e.to_string());
                        }
                        let _ = dispatcher.emit("error", json!({"message": format!("Segmentation failed: {}", e)}));
                        let _ = dispatcher.emit("app-state-changed", Value::Null);
                        
                        // Call on_complete even on failure to process cancellation if needed
                        on_complete();
                        return;
                    }
                }
                
                // Update state
                if let Ok(mut proj) = project_mutex.lock() {
                    let progress = ((i + 1) as f64 / total_chunks as f64) * 100.0;
                    
                    let mut temp_results = final_results.clone();
                    for remaining_chunk in chunks.iter().skip(i + 1) {
                         temp_results.extend(remaining_chunk.clone());
                    }
                    proj.results = temp_results;
                    proj.update_task_progress(TaskType::Segmentation, progress);
                }
                let _ = dispatcher.emit("app-state-changed", Value::Null);
            }
            
            if !was_cancelled {
                if let Ok(mut proj) = project_mutex.lock() {
                    proj.results = final_results;
                    proj.complete_task(TaskType::Segmentation);
                }
                let _ = dispatcher.emit("app-state-changed", Value::Null);
            }
            
            on_complete();
        });
        
        Ok(())
    }
}
