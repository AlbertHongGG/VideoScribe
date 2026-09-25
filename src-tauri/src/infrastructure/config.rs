use dotenvy::dotenv;
use std::env;

#[derive(Debug, Clone)]
pub struct AppConfig {
    pub translator_ai_provider: String,
    pub translator_ai_model: String,
    pub translator_batch_size: usize,
    
    pub segmenter_ai_provider: String,
    pub segmenter_ai_model: String,
    pub segmenter_batch_size: usize,
    
    pub ruby_annotator_ai_provider: String,
    pub ruby_annotator_ai_model: String,
    pub ruby_annotator_batch_size: usize,
    
    // Backend Server

    
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
        // 1. Prioritize loading .env placed directly next to the running .exe
        if let Ok(exe_path) = env::current_exe() {
            if let Some(exe_dir) = exe_path.parent() {
                let exe_env = exe_dir.join(".env");
                if exe_env.exists() {
                    let _ = dotenvy::from_path(&exe_env);
                }
            }
        }

        // 2. Fallback to CWD and parent directories (for dev / cargo run)
        let _ = dotenv();

        Self {
            translator_ai_provider: env::var("TRANSLATOR_AI_PROVIDER").unwrap_or_else(|_| "GEMINIFLOW".to_string()),
            translator_ai_model: env::var("TRANSLATOR_AI_MODEL").unwrap_or_else(|_| "gemini-3.5-flash".to_string()),
            translator_batch_size: env::var("TRANSLATOR_BATCH_SIZE").unwrap_or_else(|_| "15".to_string()).parse().unwrap_or(15),
            
            segmenter_ai_provider: env::var("SEGMENTER_AI_PROVIDER").unwrap_or_else(|_| "GEMINIFLOW".to_string()),
            segmenter_ai_model: env::var("SEGMENTER_AI_MODEL").unwrap_or_else(|_| "gemini-3.5-flash".to_string()),
            segmenter_batch_size: env::var("SEGMENTER_BATCH_SIZE").unwrap_or_else(|_| "40".to_string()).parse().unwrap_or(40),
            
            ruby_annotator_ai_provider: env::var("RUBY_ANNOTATOR_AI_PROVIDER").unwrap_or_else(|_| "GEMINIFLOW".to_string()),
            ruby_annotator_ai_model: env::var("RUBY_ANNOTATOR_AI_MODEL").unwrap_or_else(|_| "gemini-3.5-flash".to_string()),
            ruby_annotator_batch_size: env::var("RUBY_ANNOTATOR_BATCH_SIZE").unwrap_or_else(|_| "15".to_string()).parse().unwrap_or(15),
            
            ollama_base_url: env::var("OLLAMA_BASE_URL").ok(),
            
            vertex_project_id: env::var("VERTEX_PROJECT_ID").ok(),
            vertex_region: env::var("VERTEX_REGION").ok(),
            vertex_access_token: env::var("VERTEX_ACCESS_TOKEN").ok(),
            
            geminiflow_base_url: env::var("GEMINIFLOW_BASE_URL").ok(),
        }
    }
}
