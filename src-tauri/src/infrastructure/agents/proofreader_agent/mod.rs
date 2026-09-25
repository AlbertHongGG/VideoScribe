pub mod prompts;
pub mod validator;

use crate::infrastructure::agents::Agent;
use crate::infrastructure::providers::AIProvider;
use crate::infrastructure::providers::types::GenerateRequest;
use crate::infrastructure::logger::AppLogger;
use async_trait::async_trait;
use serde_json::{Value, json};
use std::sync::Arc;
use validator::{ProofreadCorrectionItem, validate_correction};

pub struct ProofreaderAgent {
    provider: Arc<dyn AIProvider>,
}

impl ProofreaderAgent {
    pub fn new(provider: Arc<dyn AIProvider>) -> Self {
        Self { provider }
    }
}

#[async_trait]
impl Agent for ProofreaderAgent {
    fn name(&self) -> &'static str {
        "ProofreaderAgent"
    }

    async fn execute(&self, input: Value) -> Result<Value, String> {
        let sentences = input.get("sentences").ok_or("Missing 'sentences' in input")?;
        let sentences_arr = sentences.as_array().ok_or("'sentences' must be an array")?;
        let previous_context = input.get("previousContext").and_then(|v| v.as_str()).unwrap_or("");
        let session_id = input.get("sessionId").and_then(|v| v.as_str()).map(|s| s.to_string());

        let sentences_json = serde_json::to_string_pretty(sentences).map_err(|e| e.to_string())?;
        let system_prompt = prompts::build_system_prompt();
        let prompt = prompts::build_proofread_prompt(&sentences_json, previous_context);

        println!("[ProofreaderAgent] Starting ASR proofreading for {} sentences...", sentences_arr.len());

        let mut retries = 2;
        let mut current_prompt = prompt.clone();

        while retries >= 0 {
            println!("[ProofreaderAgent] Sending proofread request... (Attempt {}/3)", 3 - retries);

            let request = GenerateRequest {
                prompt: current_prompt.clone(),
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

                    match serde_json::from_str::<Vec<ProofreadCorrectionItem>>(text) {
                        Ok(corrections) => {
                            let mut valid_corrections = Vec::new();
                            let mut violation_errors = Vec::new();

                            for corr in corrections {
                                let orig_item = sentences_arr.iter().find(|s| {
                                    s.get("id").and_then(|id| id.as_u64()) == Some(corr.id as u64)
                                });

                                if let Some(orig) = orig_item {
                                    if let Some(orig_text) = orig.get("text").and_then(|t| t.as_str()) {
                                        if let Err(e) = validate_correction(orig_text, &corr.text) {
                                            println!("[ProofreaderAgent] Validation error on id {}: {}", corr.id, e);
                                            violation_errors.push(format!("id {}: {}", corr.id, e));
                                        } else {
                                            valid_corrections.push(corr);
                                        }
                                    }
                                } else {
                                    println!("[ProofreaderAgent] Received correction for unknown id: {}", corr.id);
                                    violation_errors.push(format!("id {}: unknown id", corr.id));
                                }
                            }

                            // Dynamic error feedback retry
                            if !violation_errors.is_empty() && retries > 0 {
                                println!(
                                    "[ProofreaderAgent] {} violations detected on attempt {}/3. Providing dynamic feedback for retry...",
                                    violation_errors.len(),
                                    3 - retries
                                );
                                current_prompt = format!("{}\n{}", prompt, prompts::build_retry_feedback(&violation_errors));
                                retries -= 1;
                                continue;
                            }

                            // Graceful fallback: drop invalid items, preserve valid items
                            if !violation_errors.is_empty() {
                                eprintln!(
                                    "[ProofreaderAgent] Retries exhausted. Graceful fallback: dropping {} invalid corrections ({:?}). Preserving {} valid corrections.",
                                    violation_errors.len(),
                                    violation_errors,
                                    valid_corrections.len()
                                );
                            }

                            let parsed_val = serde_json::to_value(&valid_corrections).map_err(|e| e.to_string())?;

                            AppLogger::log(
                                self.name(),
                                json!({ "validCount": valid_corrections.len(), "droppedCount": violation_errors.len() }),
                                json!({ "prompt": current_prompt, "systemPrompt": system_prompt }),
                                parsed_val.clone(),
                            );

                            return Ok(parsed_val);
                        }
                        Err(e) => {
                            println!("[ProofreaderAgent] JSON parse error: {}", e);
                            if retries > 0 {
                                current_prompt = format!(
                                    "{}\n\n[ERROR]: Your output was not a valid JSON array: {}. Please output strictly a valid JSON array.",
                                    prompt, e
                                );
                            } else {
                                eprintln!("[ProofreaderAgent] JSON parse failed after all retries. Falling back to empty corrections.");
                                return Ok(json!([]));
                            }
                        }
                    }
                }
                Err(e) => {
                    println!("[ProofreaderAgent] Provider error: {:?}", e);
                    if retries == 0 {
                        return Err(format!("Provider error: {:?}", e));
                    }
                }
            }
            retries -= 1;
        }

        Ok(json!([]))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;
    use crate::infrastructure::providers::types::{GenerateRequest, GenerateResponse, GenerateStreamChunk};
    use crate::infrastructure::providers::ProviderError;
    use futures_util::stream::BoxStream;

    struct MockProvider {
        responses: Mutex<Vec<String>>,
    }

    impl MockProvider {
        fn new(responses: Vec<String>) -> Self {
            Self {
                responses: Mutex::new(responses),
            }
        }
    }

    #[async_trait]
    impl AIProvider for MockProvider {
        fn name(&self) -> &'static str {
            "MockProvider"
        }

        async fn generate(&self, _request: &GenerateRequest) -> Result<GenerateResponse, ProviderError> {
            let mut resps = self.responses.lock().unwrap();
            if resps.is_empty() {
                return Ok(GenerateResponse {
                    text: "[]".to_string(),
                    usage: None,
                    metadata: None,
                });
            }
            let text = resps.remove(0);
            Ok(GenerateResponse {
                text,
                usage: None,
                metadata: None,
            })
        }

        async fn generate_stream(
            &self,
            _request: &GenerateRequest,
        ) -> Result<BoxStream<'static, Result<GenerateStreamChunk, ProviderError>>, ProviderError> {
            unimplemented!()
        }
    }

    #[tokio::test]
    async fn test_proofreader_corrects_stt_errors() {
        let input = json!({
            "sentences": [
                { "id": 298, "text": "何千年も昔に地下庫変動があったの" },
                { "id": 299, "text": "鳥山のあたりから今の場所に移動しない予定" },
                { "id": 300, "text": "本当ですか？" }
            ],
            "previousContext": ""
        });

        // Simulate LLM returning delta corrections for 298 and 299, and omitting 300
        let mock_response = r#"[
            {"id": 298, "text": "何千年も昔に地殻変動があったの"},
            {"id": 299, "text": "富山のあたりから今の場所に移動してきたんやで"}
        ]"#.to_string();

        let provider = Arc::new(MockProvider::new(vec![mock_response]));
        let agent = ProofreaderAgent::new(provider);

        let res = agent.execute(input).await.expect("ProofreaderAgent execution should succeed");
        let corrections: Vec<ProofreadCorrectionItem> = serde_json::from_value(res).expect("Should deserialize");

        assert_eq!(corrections.len(), 2);
        assert_eq!(corrections[0].id, 298);
        assert_eq!(corrections[0].text, "何千年も昔に地殻変動があったの");
        assert_eq!(corrections[1].id, 299);
        assert_eq!(corrections[1].text, "富山のあたりから今の場所に移動してきたんやで");
    }

    #[tokio::test]
    async fn test_proofreader_empty_corrections_when_no_errors() {
        let input = json!({
            "sentences": [
                { "id": 1, "text": "おはようございます" }
            ]
        });

        let mock_response = "[]".to_string();
        let provider = Arc::new(MockProvider::new(vec![mock_response]));
        let agent = ProofreaderAgent::new(provider);

        let res = agent.execute(input).await.expect("ProofreaderAgent execution should succeed");
        let corrections: Vec<ProofreadCorrectionItem> = serde_json::from_value(res).expect("Should deserialize");
        assert!(corrections.is_empty());
    }

    #[tokio::test]
    async fn test_proofreader_handles_markdown_and_graceful_fallback() {
        let input = json!({
            "sentences": [
                { "id": 10, "text": "こんにちは" }
            ]
        });

        let mock_response = "```json\n[{\"id\": 10, \"text\": \"こんにちは！\"}]\n```".to_string();
        let provider = Arc::new(MockProvider::new(vec![mock_response]));
        let agent = ProofreaderAgent::new(provider);

        let res = agent.execute(input).await.expect("Execution should succeed");
        let corrections: Vec<ProofreadCorrectionItem> = serde_json::from_value(res).unwrap();
        assert_eq!(corrections.len(), 1);
        assert_eq!(corrections[0].text, "こんにちは！");
    }
}

