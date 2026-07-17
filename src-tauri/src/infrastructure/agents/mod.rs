use crate::infrastructure::providers::AIProvider;
use serde_json::Value;
use std::sync::Arc;
use async_trait::async_trait;

pub mod translator_agent;

#[async_trait]
pub trait Agent: Send + Sync {
    fn name(&self) -> &'static str;
    async fn execute(&self, input: Value) -> Result<Value, String>;
}

pub struct AgentFactory;

impl AgentFactory {
    pub fn create_agent(
        agent_type: &crate::domain::types::AgentType,
        provider: Arc<dyn AIProvider>,
    ) -> Result<Box<dyn Agent>, String> {
        use crate::domain::types::AgentType;
        match agent_type {
            AgentType::TranslatorAgent => Ok(Box::new(translator_agent::TranslatorAgent::new(provider))),
        }
    }
}
