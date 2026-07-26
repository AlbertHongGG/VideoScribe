pub mod prompts;

use crate::infrastructure::agents::Agent;
use crate::infrastructure::providers::AIProvider;
use crate::infrastructure::providers::types::GenerateRequest;
use crate::infrastructure::logger::AppLogger;
use async_trait::async_trait;
use serde_json::{Value, json};
use std::sync::Arc;

pub struct SegmenterAgent {
    provider: Arc<dyn AIProvider>,
}

impl SegmenterAgent {
    pub fn new(provider: Arc<dyn AIProvider>) -> Self {
        Self { provider }
    }
}

#[async_trait]
impl Agent for SegmenterAgent {
    fn name(&self) -> &'static str {
        "SegmenterAgent"
    }

    async fn execute(&self, input: Value) -> Result<Value, String> {
        let text = input.get("text").and_then(|v| v.as_str()).ok_or("Missing 'text' in input")?;
        let session_id = input.get("sessionId").and_then(|v| v.as_str()).map(|s| s.to_string());

        let system_prompt = prompts::build_system_prompt();
        let prompt = prompts::build_segmentation_prompt(text);

        println!("[SegmenterAgent] Start segmenting text...");

        let mut retries = 2;
        while retries >= 0 {
            println!("[SegmenterAgent] Sending request... (Attempt {}/3)", 3 - retries);
            
            let request = GenerateRequest {
                prompt: prompt.clone(),
                system_prompt: Some(system_prompt.clone()),
                messages: None,
                temperature: Some(0.1), // Low temperature for deterministic behavior
                max_tokens: Some(9192),
                images: None,
                session_id: session_id.clone(),
                stream: Some(false),
            };

            match self.provider.generate(&request).await {
                Ok(response) => {
                    println!("[SegmenterAgent] Received response from provider.");
                    let mut output_text = response.text.trim();
                    if output_text.starts_with("```json") {
                        output_text = &output_text[7..];
                    } else if output_text.starts_with("```") {
                        output_text = &output_text[3..];
                    }
                    if output_text.ends_with("```") {
                        output_text = &output_text[..output_text.len() - 3];
                    }
                    let output_text = output_text.trim();
                    
                    match serde_json::from_str::<Value>(output_text) {
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
                                json!({ "task": "segmentation" }),
                                json!({ "prompt": prompt, "systemPrompt": system_prompt }),
                                parsed.clone(),
                            );
                            
                            return Ok(parsed);
                        },
                        Err(e) => {
                            println!("[SegmenterAgent] JSON parse error: {}", e);
                            if retries == 0 {
                                return Err(format!("JSON parse error: {}", e));
                            }
                        }
                    }
                },
                Err(e) => {
                    println!("[SegmenterAgent] Provider error: {:?}", e);
                    if retries == 0 {
                        return Err(format!("Provider error: {:?}", e));
                    }
                }
            }
            retries -= 1;
        }

        Err("Failed to segment text after retries".to_string())
    }
}
