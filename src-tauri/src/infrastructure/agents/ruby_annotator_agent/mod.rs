pub mod prompts;
pub mod validator;
pub mod codec;

use crate::infrastructure::agents::Agent;
use crate::infrastructure::providers::AIProvider;
use crate::infrastructure::providers::types::GenerateRequest;
use crate::infrastructure::logger::AppLogger;
use async_trait::async_trait;
use serde_json::{Value, json};
use std::sync::Arc;
use validator::{RubyCorrectionItem, validate_invariance};
use codec::RubyCodec;

pub struct RubyAnnotatorAgent {
    provider: Arc<dyn AIProvider>,
}

impl RubyAnnotatorAgent {
    pub fn new(provider: Arc<dyn AIProvider>) -> Self {
        Self { provider }
    }
}

#[async_trait]
impl Agent for RubyAnnotatorAgent {
    fn name(&self) -> &'static str {
        "RubyAnnotatorAgent"
    }

    async fn execute(&self, input: Value) -> Result<Value, String> {
        let sentences = input.get("sentences").ok_or("Missing 'sentences' in input")?;
        let sentences_arr = sentences.as_array().ok_or("'sentences' must be an array")?;
        let previous_context = input.get("previousContext").and_then(|v| v.as_str()).unwrap_or("");
        let session_id = input.get("sessionId").and_then(|v| v.as_str()).map(|s| s.to_string());

        let sentences_json = serde_json::to_string_pretty(sentences).map_err(|e| e.to_string())?;
        let system_prompt = prompts::build_system_prompt();
        let prompt = prompts::build_annotation_prompt(&sentences_json, previous_context);

        println!("[RubyAnnotatorAgent] Starting Furigana inspection for {} sentences...", sentences_arr.len());

        let mut retries = 2;
        while retries >= 0 {
            println!("[RubyAnnotatorAgent] Sending inspection request... (Attempt {}/3)", 3 - retries);

            let request = GenerateRequest {
                prompt: prompt.clone(),
                system_prompt: Some(system_prompt.clone()),
                messages: None,
                temperature: Some(0.1),
                max_tokens: Some(8192),
                images: None,
                session_id: session_id.clone(),
                stream: Some(false),
            };

            match self.provider.generate(&request).await {
                Ok(response) => {
                    let mut text = response.text.trim();
                    if text.starts_with("```json") {
                        text = &text[7..];
                    } else if text.starts_with("```") {
                        text = &text[3..];
                    }
                    if text.ends_with("```") {
                        text = &text[..text.len() - 3];
                    }
                    let text = text.trim();

                    match serde_json::from_str::<Vec<RubyCorrectionItem>>(text) {
                        Ok(corrections) => {
                            // Validate character invariance and syntax for each correction
                            let mut valid = true;
                            for corr in &corrections {
                                let orig_item = sentences_arr.iter().find(|s| {
                                    s.get("id").and_then(|id| id.as_u64()) == Some(corr.id as u64)
                                });

                                if let Some(orig) = orig_item {
                                    if let Some(orig_text) = orig.get("text").and_then(|t| t.as_str()) {
                                        match RubyCodec::from_compact(&corr.ruby) {
                                            Ok(segments) => {
                                                if let Err(e) = validate_invariance(orig_text, &segments) {
                                                    println!("[RubyAnnotatorAgent] Invariance validation error on id {}: {}", corr.id, e);
                                                    valid = false;
                                                    break;
                                                }
                                            }
                                            Err(e) => {
                                                println!("[RubyAnnotatorAgent] Codec parse error on id {}: {}", corr.id, e);
                                                valid = false;
                                                break;
                                            }
                                        }
                                    }
                                } else {
                                    println!("[RubyAnnotatorAgent] Received correction for unknown id: {}", corr.id);
                                    valid = false;
                                    break;
                                }
                            }

                            if !valid {
                                if retries == 0 {
                                    return Err("Output violated character invariance after retries".to_string());
                                }
                                retries -= 1;
                                continue;
                            }

                            let parsed_val = serde_json::to_value(&corrections).map_err(|e| e.to_string())?;

                            AppLogger::log(
                                self.name(),
                                json!({ "count": corrections.len() }),
                                json!({ "prompt": prompt, "systemPrompt": system_prompt }),
                                parsed_val.clone(),
                            );

                            return Ok(parsed_val);
                        }
                        Err(e) => {
                            println!("[RubyAnnotatorAgent] JSON parse error: {}", e);
                            if retries == 0 {
                                return Err(format!("JSON parse error: {}", e));
                            }
                        }
                    }
                }
                Err(e) => {
                    println!("[RubyAnnotatorAgent] Provider error: {:?}", e);
                    if retries == 0 {
                        return Err(format!("Provider error: {:?}", e));
                    }
                }
            }
            retries -= 1;
        }

        Err("Failed to execute RubyAnnotatorAgent after retries".to_string())
    }
}
