pub mod prompts;

use crate::infrastructure::agents::Agent;
use crate::infrastructure::providers::AIProvider;
use crate::infrastructure::providers::types::GenerateRequest;
use crate::infrastructure::logger::AppLogger;
use async_trait::async_trait;
use serde_json::{Value, json};
use std::sync::Arc;

pub struct TranslatorAgent {
    provider: Arc<dyn AIProvider>,
}

impl TranslatorAgent {
    pub fn new(provider: Arc<dyn AIProvider>) -> Self {
        Self { provider }
    }
}

#[async_trait]
impl Agent for TranslatorAgent {
    fn name(&self) -> &'static str {
        "TranslatorAgent"
    }

    async fn execute(&self, input: Value) -> Result<Value, String> {
        let segments = input.get("segments").ok_or("Missing 'segments' in input")?;
        let target_language = input.get("targetLanguage").and_then(|v| v.as_str()).unwrap_or("zh-TW");
        let previous_context = input.get("previousContext").and_then(|v| v.as_str()).unwrap_or("");
        let session_id = input.get("sessionId").and_then(|v| v.as_str()).map(|s| s.to_string());

        let system_prompt = prompts::build_system_prompt(target_language);
        let prompt = prompts::build_translation_prompt(segments, previous_context);

        println!("[TranslatorAgent] Start translating segments to {}...", target_language);

        let mut retries = 2;
        while retries >= 0 {
            println!("[TranslatorAgent] Sending chunk... (Attempt {}/3)", 3 - retries);
            
            let request = GenerateRequest {
                prompt: prompt.clone(),
                system_prompt: Some(system_prompt.clone()),
                messages: None,
                temperature: Some(0.2),
                max_tokens: Some(9192),
                images: None,
                session_id: session_id.clone(),
                stream: Some(false),
            };

            match self.provider.generate(&request).await {
                Ok(response) => {
                    println!("[TranslatorAgent] Received response from provider.");
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
                    
                    match serde_json::from_str::<Value>(text) {
                        Ok(parsed) => {
                            if !parsed.is_array() {
                                if retries == 0 {
                                    return Err("Output is not an array".to_string());
                                }
                                retries -= 1;
                                continue;
                            }
                            
                            AppLogger::log(
                                self.name(),
                                json!({ "targetLanguage": target_language }),
                                json!({ "prompt": prompt, "systemPrompt": system_prompt }),
                                parsed.clone(),
                            );
                            
                            return Ok(parsed);
                        },
                        Err(e) => {
                            println!("[TranslatorAgent] JSON parse error: {}", e);
                            if retries == 0 {
                                return Err(format!("JSON parse error: {}", e));
                            }
                        }
                    }
                },
                Err(e) => {
                    println!("[TranslatorAgent] Provider error: {:?}", e);
                    if retries == 0 {
                        return Err(format!("Provider error: {:?}", e));
                    }
                }
            }
            retries -= 1;
        }

        Err("Failed to translate segments after retries".to_string())
    }
}
