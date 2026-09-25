use tauri::State;
use serde_json::Value;

use crate::infrastructure::state::AppState;
use crate::infrastructure::agents::AgentFactory;
use crate::domain::agent::AgentType;

#[tauri::command]
#[specta::specta]
pub async fn run_agent_task(
    agent_type: AgentType,
    payload_json: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let provider = match agent_type {
        AgentType::TranslatorAgent => state.translator_provider.clone(),
        AgentType::SegmenterAgent => state.segmenter_provider.clone(),
        AgentType::RubyAnnotatorAgent => state.ruby_annotator_provider.clone(),
        AgentType::ProofreaderAgent => state.proofreader_provider.clone(),
    };
    
    let payload: Value = serde_json::from_str(&payload_json).map_err(|e| e.to_string())?;
    let agent = AgentFactory::create_agent(&agent_type, provider)?;
    let result = agent.execute(payload).await?;
    
    serde_json::to_string(&result).map_err(|e| e.to_string())
}
