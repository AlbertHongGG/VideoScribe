use crate::infrastructure::providers::{ProviderFactory, AIProvider};
use crate::infrastructure::config::AppConfig;
use crate::domain::types::AgentType;
use crate::domain::project::ProjectState;
use std::sync::{Arc, Mutex};

pub struct AppState {
    pub config: AppConfig,
    pub translator_provider: Arc<dyn AIProvider>,
    pub project: Mutex<ProjectState>,
}

impl AppState {
    pub fn new() -> Result<Self, String> {
        let config = AppConfig::load();
        
        let provider = ProviderFactory::create_provider(&AgentType::TranslatorAgent, &config)
            .map_err(|e| e.to_string())?;
            
        Ok(Self {
            config,
            translator_provider: Arc::from(provider),
            project: Mutex::new(ProjectState::default()),
        })
    }
}
