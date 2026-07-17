use dotenvy::dotenv;
use std::env;

pub struct AgentConfig {
    // You can parse specific settings here if needed
}

pub fn init_env() {
    // Try loading from .env file
    if let Err(e) = dotenv() {
        println!("Warning: Could not load .env file: {}", e);
    }
}

pub fn get_env(key: &str) -> Option<String> {
    env::var(key).ok()
}

pub fn get_env_required(key: &str) -> Result<String, String> {
    env::var(key).map_err(|_| format!("Configuration Error: Missing {} in .env", key))
}
