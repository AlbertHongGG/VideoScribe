use dotenvy::dotenv;
use std::env;

#[derive(Debug, Clone)]
pub struct AppConfig {
    pub ai_provider: String,
    pub ai_model: String,
    
    // Ollama
    pub ollama_base_url: Option<String>,
    
    // Vertex AI
    pub vertex_project_id: Option<String>,
    pub vertex_region: Option<String>,
    pub vertex_access_token: Option<String>,
    
    // GeminiFlow
    pub geminiflow_base_url: Option<String>,
}

impl AppConfig {
    pub fn load() -> Self {
        // Try loading from .env file
        if let Err(e) = dotenv() {
            println!("Warning: Could not load .env file: {}", e);
        }

        Self {
            ai_provider: env::var("AI_PROVIDER").unwrap_or_else(|_| "GEMINIFLOW".to_string()),
            ai_model: env::var("AI_MODEL").unwrap_or_else(|_| "gemini-3.5-flash".to_string()),
            
            ollama_base_url: env::var("OLLAMA_BASE_URL").ok(),
            
            vertex_project_id: env::var("VERTEX_PROJECT_ID").ok(),
            vertex_region: env::var("VERTEX_REGION").ok(),
            vertex_access_token: env::var("VERTEX_ACCESS_TOKEN").ok(),
            
            geminiflow_base_url: env::var("GEMINIFLOW_BASE_URL").ok(),
        }
    }
}
