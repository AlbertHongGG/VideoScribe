use crate::infrastructure::agent::providers::{AIProvider, ProviderError};
use crate::infrastructure::agent::types::{GenerateRequest, GenerateResponse, GenerateStreamChunk};
use async_trait::async_trait;
use futures_util::stream::{BoxStream, StreamExt};
use reqwest::Client;
use serde_json::json;

pub struct OllamaProvider {
    model: String,
    url: String,
    client: Client,
}

impl OllamaProvider {
    pub fn new(model: String, url: String) -> Self {
        Self {
            model,
            url: url.trim_end_matches('/').to_string(),
            client: Client::new(),
        }
    }
}

#[async_trait]
impl AIProvider for OllamaProvider {
    fn name(&self) -> &'static str {
        "Ollama"
    }

    async fn generate(&self, request: &GenerateRequest) -> Result<GenerateResponse, ProviderError> {
        let endpoint = format!("{}/api/generate", self.url);

        let prompt = if let Some(sys) = &request.system_prompt {
            format!("{}\n\n{}", sys, request.prompt)
        } else {
            request.prompt.clone()
        };

        let body = json!({
            "model": self.model,
            "prompt": prompt,
            "stream": false,
            "options": {
                "temperature": request.temperature.unwrap_or(0.7),
                "num_predict": request.max_tokens.unwrap_or(2048)
            }
        });

        let res = self.client.post(&endpoint).json(&body).send().await?;

        if !res.status().is_success() {
            let status = res.status();
            let err_text = res.text().await.unwrap_or_default();
            return Err(ProviderError::ApiError(format!(
                "{} - {}",
                status, err_text
            )));
        }

        let json_res: serde_json::Value = res.json().await?;
        let text = json_res["response"].as_str().unwrap_or("").to_string();

        Ok(GenerateResponse {
            text,
            usage: None,
            metadata: Some(json_res),
        })
    }

    async fn generate_stream(
        &self,
        request: &GenerateRequest,
    ) -> Result<BoxStream<'static, Result<GenerateStreamChunk, ProviderError>>, ProviderError> {
        let endpoint = format!("{}/api/generate", self.url);

        let prompt = if let Some(sys) = &request.system_prompt {
            format!("{}\n\n{}", sys, request.prompt)
        } else {
            request.prompt.clone()
        };

        let body = json!({
            "model": self.model,
            "prompt": prompt,
            "stream": true,
            "options": {
                "temperature": request.temperature.unwrap_or(0.7),
                "num_predict": request.max_tokens.unwrap_or(2048)
            }
        });

        let res = self.client.post(&endpoint).json(&body).send().await?;

        if !res.status().is_success() {
            let status = res.status();
            let err_text = res.text().await.unwrap_or_default();
            return Err(ProviderError::ApiError(format!(
                "{} - {}",
                status, err_text
            )));
        }

        let stream = futures_util::stream::unfold(
            (res.bytes_stream(), String::new()),
            |(mut byte_stream, mut buffer)| async move {
                loop {
                    if let Some(pos) = buffer.find('\n') {
                        let line = buffer[..pos].to_string();
                        buffer = buffer[pos + 1..].to_string();
                        let trimmed = line.trim();
                        if trimmed.is_empty() {
                            continue;
                        }

                        if let Ok(json_res) = serde_json::from_str::<serde_json::Value>(trimmed) {
                            let response_text =
                                json_res["response"].as_str().unwrap_or("").to_string();
                            let done = json_res["done"].as_bool().unwrap_or(false);
                            return Some((
                                Ok(GenerateStreamChunk {
                                    text: response_text,
                                    is_finished: Some(done),
                                    usage: None,
                                    metadata: Some(json_res),
                                }),
                                (byte_stream, buffer),
                            ));
                        } else {
                            return Some((
                                Err(ProviderError::ApiError(
                                    "Failed to parse Ollama JSON Line".to_string(),
                                )),
                                (byte_stream, buffer),
                            ));
                        }
                    }

                    match byte_stream.next().await {
                        Some(Ok(bytes)) => {
                            if let Ok(text) = std::str::from_utf8(&bytes) {
                                buffer.push_str(text);
                            } else {
                                return Some((
                                    Err(ProviderError::ApiError(
                                        "Invalid UTF-8 chunk".to_string(),
                                    )),
                                    (byte_stream, buffer),
                                ));
                            }
                        }
                        Some(Err(e)) => {
                            return Some((
                                Err(ProviderError::NetworkError(e)),
                                (byte_stream, buffer),
                            ));
                        }
                        None => {
                            let trimmed = buffer.trim();
                            if !trimmed.is_empty() {
                                let line = trimmed.to_string();
                                buffer.clear();
                                if let Ok(json_res) =
                                    serde_json::from_str::<serde_json::Value>(&line)
                                {
                                    let response_text =
                                        json_res["response"].as_str().unwrap_or("").to_string();
                                    let done = json_res["done"].as_bool().unwrap_or(false);
                                    return Some((
                                        Ok(GenerateStreamChunk {
                                            text: response_text,
                                            is_finished: Some(done),
                                            usage: None,
                                            metadata: Some(json_res),
                                        }),
                                        (byte_stream, buffer),
                                    ));
                                } else {
                                    return Some((
                                        Err(ProviderError::ApiError(
                                            "Failed to parse Ollama JSON Line".to_string(),
                                        )),
                                        (byte_stream, buffer),
                                    ));
                                }
                            }
                            return None;
                        }
                    }
                }
            },
        );

        Ok(Box::pin(stream))
    }
}
