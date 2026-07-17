use crate::infrastructure::agent::providers::{AIProvider, ProviderError};
use crate::infrastructure::agent::types::{GenerateRequest, GenerateResponse, GenerateStreamChunk};
use async_trait::async_trait;
use eventsource_stream::Eventsource;
use futures_util::stream::{BoxStream, StreamExt};
use reqwest::Client;
use serde_json::json;

pub struct VertexAIProvider {
    model: String,
    project_id: String,
    region: String,
    access_token: String,
    client: Client,
}

impl VertexAIProvider {
    pub fn new(model: String, project_id: String, region: String, access_token: String) -> Self {
        Self {
            model,
            project_id,
            region,
            access_token,
            client: Client::new(),
        }
    }

    fn build_endpoint(&self, stream: bool) -> String {
        let action = if stream {
            "streamGenerateContent?alt=sse"
        } else {
            "generateContent"
        };
        format!(
            "https://{}-aiplatform.googleapis.com/v1/projects/{}/locations/{}/publishers/google/models/{}:{}",
            self.region, self.project_id, self.region, self.model, action
        )
    }
}

#[async_trait]
impl AIProvider for VertexAIProvider {
    fn name(&self) -> &'static str {
        "VertexAI"
    }

    async fn generate(&self, request: &GenerateRequest) -> Result<GenerateResponse, ProviderError> {
        let endpoint = self.build_endpoint(false);

        let mut contents = Vec::new();
        if let Some(sys) = &request.system_prompt {
            // Vertex uses systemInstruction differently, but for simplicity we merge or use standard format
            contents.push(json!({
                "role": "user",
                "parts": [{"text": format!("System: {}\n\nUser: {}", sys, request.prompt)}]
            }));
        } else {
            contents.push(json!({
                "role": "user",
                "parts": [{"text": request.prompt}]
            }));
        }

        let body = json!({
            "contents": contents,
            "generationConfig": {
                "temperature": request.temperature.unwrap_or(0.7),
                "maxOutputTokens": request.max_tokens.unwrap_or(2048)
            }
        });

        let res = self
            .client
            .post(&endpoint)
            .bearer_auth(&self.access_token)
            .json(&body)
            .send()
            .await?;

        if !res.status().is_success() {
            let status = res.status();
            let err_text = res.text().await.unwrap_or_default();
            return Err(ProviderError::ApiError(format!(
                "{} - {}",
                status, err_text
            )));
        }

        let json_res: serde_json::Value = res.json().await?;
        let text = json_res["candidates"][0]["content"]["parts"][0]["text"]
            .as_str()
            .unwrap_or("")
            .to_string();

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
        let endpoint = self.build_endpoint(true);

        let mut contents = Vec::new();
        if let Some(sys) = &request.system_prompt {
            contents.push(json!({
                "role": "user",
                "parts": [{"text": format!("System: {}\n\nUser: {}", sys, request.prompt)}]
            }));
        } else {
            contents.push(json!({
                "role": "user",
                "parts": [{"text": request.prompt}]
            }));
        }

        let body = json!({
            "contents": contents,
            "generationConfig": {
                "temperature": request.temperature.unwrap_or(0.7),
                "maxOutputTokens": request.max_tokens.unwrap_or(2048)
            }
        });

        let res = self
            .client
            .post(&endpoint)
            .bearer_auth(&self.access_token)
            .json(&body)
            .send()
            .await?;

        if !res.status().is_success() {
            let status = res.status();
            let err_text = res.text().await.unwrap_or_default();
            return Err(ProviderError::ApiError(format!(
                "{} - {}",
                status, err_text
            )));
        }

        let stream = res.bytes_stream().eventsource().map(|event| {
            match event {
                Ok(ev) => {
                    if let Ok(json_res) = serde_json::from_str::<serde_json::Value>(&ev.data) {
                        let text = json_res["candidates"][0]["content"]["parts"][0]["text"]
                            .as_str()
                            .unwrap_or("")
                            .to_string();
                        // Vertex SSE doesn't explicitly send [DONE], we just track finishReason
                        let finish_reason = json_res["candidates"][0]["finishReason"].as_str();
                        let is_finished = finish_reason.is_some() && finish_reason != Some("STOP");

                        Ok(GenerateStreamChunk {
                            text,
                            is_finished: Some(is_finished),
                            usage: None,
                            metadata: Some(json_res),
                        })
                    } else {
                        Err(ProviderError::ApiError(
                            "Failed to parse Vertex SSE JSON".to_string(),
                        ))
                    }
                }
                Err(e) => Err(ProviderError::ApiError(e.to_string())),
            }
        });

        Ok(Box::pin(stream))
    }
}
