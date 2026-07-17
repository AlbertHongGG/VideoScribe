use crate::infrastructure::agent::providers::{ProviderFactory, AIProvider};
use crate::domain::types::AgentType;
use crate::domain::project::ProjectState;
use std::sync::{Arc, Mutex};

pub struct AppState {
    pub translator_provider: Arc<dyn AIProvider>,
    pub project: Mutex<ProjectState>,
}

impl AppState {
    pub fn new() -> Result<Self, String> {
        crate::infrastructure::agent::config::init_env();
        
        // Ensure .env has the right vars, or we can fallback if we want.
        // For now, we expect them to be set or we return an error.
        let provider = ProviderFactory::create_provider(&AgentType::TranslatorAgent)
            .map_err(|e| e.to_string())?;
            
        Ok(Self {
            translator_provider: Arc::from(provider),
            project: Mutex::new(ProjectState::default()),
        })
    }
}
