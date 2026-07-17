pub mod sdk;

use self::sdk::client::GeminiFlowClient;
use self::sdk::types::GeminiFlowChatPayload;
use crate::infrastructure::providers::{AIProvider, ProviderError};
use crate::infrastructure::providers::types::{GenerateRequest, GenerateResponse, GenerateStreamChunk};
use async_trait::async_trait;
use futures_util::stream::{BoxStream, StreamExt};
use lazy_static::lazy_static;
use serde_json::json;

lazy_static! {
    static ref GLOBAL_SESSION_ID: String =
        format!("session_{}", chrono::Local::now().timestamp_millis()) ;
}

pub struct GeminiFlowProvider {
    model: String,
    client: GeminiFlowClient,
}

impl GeminiFlowProvider {
    pub fn new(model: String, url: String) -> Self {
        Self {
            model,
            client: GeminiFlowClient::new(url.trim_end_matches('/').to_string()),
        }
    }
}

#[async_trait]
impl AIProvider for GeminiFlowProvider {
    fn name(&self) -> &'static str {
        "GeminiFlow"
    }

    async fn generate(&self, request: &GenerateRequest) -> Result<GenerateResponse, ProviderError> {
        crate::infrastructure::logger::AppLogger::log(
            self.name(),
            json!({ "model": self.model, "type": "generate" }),
            json!(request),
            json!("Pending"),
        );

        let payload = GeminiFlowChatPayload {
            prompt: request.prompt.clone(),
            model: self.model.clone(),
            language: "zh-TW".to_string(),
            save_images: true,
            system_prompt: request.system_prompt.clone(),
            images: request.images.clone(),
            messages: request.messages.clone(),
            session_id: Some(
                request
                    .session_id
                    .clone()
                    .unwrap_or_else(|| GLOBAL_SESSION_ID.clone()),
            ),
        };

        let (api_response, raw_json) = self.client.chat(payload).await?;

        let response = GenerateResponse {
            text: api_response.text.clone(),
            usage: None,
            metadata: Some(json!({
                "provider": self.name(),
                "model": self.model,
                "images": api_response.images,
                "raw_response": raw_json
            })),
        };

        crate::infrastructure::logger::AppLogger::log(
            self.name(),
            json!({ "model": self.model, "type": "generate" }),
            json!(request),
            json!(&response.text),
        );

        Ok(response)
    }

    async fn generate_stream(
        &self,
        request: &GenerateRequest,
    ) -> Result<BoxStream<'static, Result<GenerateStreamChunk, ProviderError>>, ProviderError> {
        let payload = GeminiFlowChatPayload {
            prompt: request.prompt.clone(),
            model: self.model.clone(),
            language: "zh-TW".to_string(),
            save_images: true,
            system_prompt: request.system_prompt.clone(),
            images: request.images.clone(),
            messages: request.messages.clone(),
            session_id: Some(
                request
                    .session_id
                    .clone()
                    .unwrap_or_else(|| GLOBAL_SESSION_ID.clone()),
            ),
        };

        let stream = self.client.stream(payload).await?;

        let mapped_stream = stream.map(move |res| match res {
            Ok((Some(data), raw_json, is_done)) => Ok(GenerateStreamChunk {
                text: data.text,
                is_finished: Some(is_done),
                usage: None,
                metadata: Some(json!({
                    "images": data.images,
                    "raw_response": raw_json
                })),
            }),
            Ok((None, raw_json, is_done)) => Ok(GenerateStreamChunk {
                text: String::new(),
                is_finished: Some(is_done),
                usage: None,
                metadata: if is_done { None } else { Some(raw_json) },
            }),
            Err(e) => Err(e),
        });

        Ok(Box::pin(mapped_stream))
    }
}
