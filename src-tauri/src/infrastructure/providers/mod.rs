use crate::domain::provider_types::{GenerateRequest, GenerateResponse, GenerateStreamChunk};
use crate::infrastructure::config::AppConfig;
use async_trait::async_trait;
use futures_util::stream::BoxStream;

pub mod geminiflow;
pub mod ollama;
pub mod vertexai;

#[derive(Debug, thiserror::Error)]
pub enum ProviderError {
    #[error("Configuration Error: {0}")]
    ConfigError(String),
    #[error("Network Error: {0}")]
    NetworkError(#[from] reqwest::Error),
    #[error("API Error: {0}")]
    ApiError(String),
    #[error("JSON Error: {0}")]
    JsonError(#[from] serde_json::Error),
}

#[async_trait]
pub trait AIProvider: Send + Sync {
    fn name(&self) -> &'static str;
    async fn generate(&self, request: &GenerateRequest) -> Result<GenerateResponse, ProviderError>;
    async fn generate_stream(
        &self,
        request: &GenerateRequest,
    ) -> Result<BoxStream<'static, Result<GenerateStreamChunk, ProviderError>>, ProviderError>;
}

pub struct ProviderFactory;

impl ProviderFactory {
    pub fn create_provider(agent_type: &crate::domain::types::AgentType, config: &AppConfig) -> Result<Box<dyn AIProvider>, ProviderError> {
        let provider_type = &config.ai_provider;
        let model = &config.ai_model;

        match provider_type.to_lowercase().as_str() {
            "geminiflow" => {
                let url = config.geminiflow_base_url.clone()
                    .ok_or_else(|| ProviderError::ConfigError("Missing GEMINIFLOW_BASE_URL".into()))?;
                Ok(Box::new(geminiflow::GeminiFlowProvider::new(model.clone(), url)))
            }
            "ollama" => {
                let url = config.ollama_base_url.clone()
                    .ok_or_else(|| ProviderError::ConfigError("Missing OLLAMA_BASE_URL".into()))?;
                Ok(Box::new(ollama::OllamaProvider::new(model.clone(), url)))
            }
            "vertexai" => {
                let project_id = config.vertex_project_id.clone()
                    .ok_or_else(|| ProviderError::ConfigError("Missing VERTEX_PROJECT_ID".into()))?;
                let region = config.vertex_region.clone()
                    .ok_or_else(|| ProviderError::ConfigError("Missing VERTEX_REGION".into()))?;
                let access_token = config.vertex_access_token.clone()
                    .ok_or_else(|| ProviderError::ConfigError("Missing VERTEX_ACCESS_TOKEN".into()))?;
                Ok(Box::new(vertexai::VertexAIProvider::new(
                    model.clone(),
                    project_id,
                    region,
                    access_token,
                )))
            }
            _ => Err(ProviderError::ConfigError(format!(
                "Unsupported provider type '{}' for agent '{:?}'",
                provider_type, agent_type
            ))),
        }
    }
}
