use crate::infrastructure::providers::{ProviderFactory, AIProvider};
use crate::infrastructure::config::AppConfig;
use crate::infrastructure::plugins::PluginManager;
use crate::domain::agent::AgentType;
use crate::domain::project::ProjectState;
use crate::application::job_manager::JobManager;
use std::sync::{Arc, Mutex};

pub struct AppState {
    pub config: AppConfig,
    pub translator_provider: Arc<dyn AIProvider>,
    pub segmenter_provider: Arc<dyn AIProvider>,
    pub ruby_annotator_provider: Arc<dyn AIProvider>,
    pub proofreader_provider: Arc<dyn AIProvider>,
    pub project: Arc<Mutex<ProjectState>>,
    pub job_manager: Arc<JobManager>,
    pub plugin_manager: Arc<PluginManager>,
}

impl AppState {
    pub fn new(plugin_manager: PluginManager) -> Result<Self, String> {
        let config = AppConfig::load();
        
        let translator_provider = ProviderFactory::create_provider(&AgentType::TranslatorAgent, &config)
            .map_err(|e| e.to_string())?;
            
        let segmenter_provider = ProviderFactory::create_provider(&AgentType::SegmenterAgent, &config)
            .map_err(|e| e.to_string())?;

        let ruby_annotator_provider = ProviderFactory::create_provider(&AgentType::RubyAnnotatorAgent, &config)
            .map_err(|e| e.to_string())?;
            
        let proofreader_provider = ProviderFactory::create_provider(&AgentType::ProofreaderAgent, &config)
            .map_err(|e| e.to_string())?;

        Ok(Self {
            config,
            translator_provider: Arc::from(translator_provider),
            segmenter_provider: Arc::from(segmenter_provider),
            ruby_annotator_provider: Arc::from(ruby_annotator_provider),
            proofreader_provider: Arc::from(proofreader_provider),
            project: Arc::new(Mutex::new(ProjectState::default())),
            job_manager: Arc::new(JobManager::new()),
            plugin_manager: Arc::new(plugin_manager),
        })
    }
}
