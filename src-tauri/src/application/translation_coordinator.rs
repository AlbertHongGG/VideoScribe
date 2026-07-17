use crate::domain::agent::AgentType;
use crate::infrastructure::agents::AgentFactory;
use crate::infrastructure::state::AppState;
use tauri::{AppHandle, Emitter, Manager};
use serde_json::json;

pub struct TranslationCoordinator;

impl TranslationCoordinator {
    pub fn start_translation(app: AppHandle) -> Result<(), String> {
        let state = app.state::<AppState>();
        
        let mut project = state.project.lock().map_err(|e| e.to_string())?;
        if project.is_results_empty() {
            return Err("No STT results to translate".into());
        }
        
        project.start_translation();
        let _ = app.emit("app-state-changed", ());
        
        let provider = state.translator_provider.clone();
        
        let target_language = project.get_target_language().to_string();
        let results_clone = project.get_results_clone();
        
        // We drop the lock here because the translation process will take a long time
        // and we want to be able to update progress along the way.
        drop(project);
        
        tauri::async_runtime::spawn(async move {
            let chunk_size = 15;
            let mut chunks = Vec::new();
            for chunk in results_clone.chunks(chunk_size) {
                chunks.push(chunk.to_vec());
            }
            
            let total_chunks = chunks.len();
            let mut previous_context = String::new();
            let session_id = uuid::Uuid::new_v4().to_string();
            
            let mut all_translated_results = results_clone.clone();

            for (i, chunk) in chunks.iter().enumerate() {
                let agent = match AgentFactory::create_agent(&AgentType::TranslatorAgent, provider.clone()) {
                    Ok(a) => a,
                    Err(e) => {
                        eprintln!("Failed to create translator agent: {}", e);
                        continue;
                    }
                };

                let start_idx = i * chunk_size;
                let segments = chunk.iter().enumerate().map(|(idx, r)| {
                    json!({
                        "id": start_idx + idx,
                        "text": r.text
                    })
                }).collect::<Vec<_>>();

                let payload = json!({
                    "segments": segments,
                    "targetLanguage": target_language,
                    "previousContext": previous_context,
                    "sessionId": session_id
                });

                match agent.execute(payload).await {
                    Ok(response) => {
                        // Assuming response is an array of objects with id and translation
                        if let Some(arr) = response.as_array() {
                            for item in arr {
                                if let (Some(id), Some(trans)) = (
                                    item.get("id").and_then(|v| v.as_u64()),
                                    item.get("translation").and_then(|v| v.as_str())
                                ) {
                                    if let Some(res) = all_translated_results.get_mut(id as usize) {
                                        res.translation = Some(trans.to_string());
                                    }
                                }
                            }
                        }
                    }
                    Err(e) => {
                        eprintln!("Translation chunk {} failed: {}", i, e);
                    }
                }
                
                // Update context for next chunk
                if chunk.len() > 3 {
                    previous_context = chunk.iter().skip(chunk.len() - 3).map(|r| r.text.clone()).collect::<Vec<_>>().join(" ");
                } else {
                    previous_context = chunk.iter().map(|r| r.text.clone()).collect::<Vec<_>>().join(" ");
                }
                
                // Update state
                let state = app.state::<AppState>();
                if let Ok(mut proj) = state.project.lock() {
                    let progress = ((i + 1) as f64 / total_chunks as f64) * 100.0;
                    proj.update_translation_progress(progress, all_translated_results.clone());
                }
                let _ = app.emit("app-state-changed", ());
            }
            
            let state = app.state::<AppState>();
            if let Ok(mut proj) = state.project.lock() {
                proj.complete_translation(all_translated_results);
            }
            let _ = app.emit("app-state-changed", ());
        });
        
        Ok(())
    }
}
