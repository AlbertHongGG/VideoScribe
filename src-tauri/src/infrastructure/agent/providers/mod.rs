use crate::infrastructure::agent::types::{GenerateRequest, GenerateResponse, GenerateStreamChunk};
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
    pub fn create_provider(agent_type: &crate::domain::types::AgentType) -> Result<Box<dyn AIProvider>, ProviderError> {
        let env_prefix = format!("AGENT_{}_", agent_type.as_str().to_uppercase());

        let provider_type = crate::infrastructure::agent::config::get_env_required(
            &(env_prefix.clone() + "PROVIDER"),
        )
        .map_err(|e| {
            ProviderError::ConfigError(format!(
                "Failed to get provider type for {:?}: {}",
                agent_type, e
            ))
        })?;
        let model =
            crate::infrastructure::agent::config::get_env_required(&(env_prefix.clone() + "MODEL"))
                .map_err(|e| ProviderError::ConfigError(e))?;

        match provider_type.to_lowercase().as_str() {
            "geminiflow" => {
                let url = crate::infrastructure::agent::config::get_env_required(
                    "PROVIDER_GEMINIFLOW_URL",
                )
                .map_err(|e| ProviderError::ConfigError(e))?;
                Ok(Box::new(geminiflow::GeminiFlowProvider::new(model, url)))
            }
            "ollama" => {
                let url =
                    crate::infrastructure::agent::config::get_env_required("PROVIDER_OLLAMA_URL")
                        .map_err(|e| ProviderError::ConfigError(e))?;
                Ok(Box::new(ollama::OllamaProvider::new(model, url)))
            }
            "vertexai" => {
                let project_id = crate::infrastructure::agent::config::get_env_required(
                    "PROVIDER_VERTEX_PROJECT_ID",
                )
                .map_err(|e| ProviderError::ConfigError(e))?;
                let region = crate::infrastructure::agent::config::get_env_required(
                    "PROVIDER_VERTEX_REGION",
                )
                .map_err(|e| ProviderError::ConfigError(e))?;
                let access_token = crate::infrastructure::agent::config::get_env_required(
                    "PROVIDER_VERTEX_ACCESS_TOKEN",
                )
                .map_err(|e| ProviderError::ConfigError(e))?;
                Ok(Box::new(vertexai::VertexAIProvider::new(
                    model,
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
