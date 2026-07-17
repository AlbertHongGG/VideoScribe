use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::str::FromStr;
use ts_rs::TS;
use specta::Type;

#[derive(Debug, Clone, PartialEq, Eq, Hash, TS, Type)]
#[ts(export, export_to = "../../src/types/agent_types.ts")]
pub enum AgentType {
    TranslatorAgent,
    // Add other agents here as needed
}

impl AgentType {
    pub fn as_str(&self) -> &'static str {
        match self {
            AgentType::TranslatorAgent => "translator_agent",
        }
    }
}

impl FromStr for AgentType {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "translator_agent" => Ok(AgentType::TranslatorAgent),
            _ => Err(format!("Unknown agent type: '{}'", s)),
        }
    }
}

impl<'de> Deserialize<'de> for AgentType {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        AgentType::from_str(&s).map_err(serde::de::Error::custom)
    }
}

impl Serialize for AgentType {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(self.as_str())
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, TS, Type)]
#[ts(export, export_to = "../../src/types/agent_types.ts")]
pub struct Message {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, TS, Type)]
#[ts(export, export_to = "../../src/types/agent_types.ts")]
pub enum AgentStatus {
    #[serde(rename = "TOOL_CALL")]
    ToolCall,
    #[serde(rename = "REQUIRE_USER_ACTION")]
    RequireUserAction,
    #[serde(rename = "SUCCESS")]
    Success,
    #[serde(rename = "DEAD_END")]
    DeadEnd,
    #[serde(rename = "BRANCHING")]
    Branching,
}

#[derive(Debug, Serialize, Deserialize, Clone, TS, Type)]
#[ts(export, export_to = "../../src/types/agent_types.ts")]
pub struct AgentResponse {
    pub status: AgentStatus,
    pub thought: Option<String>,
    // For TOOL_CALL
    #[serde(rename = "toolName")]
    pub tool_name: Option<String>,
    #[serde(rename = "toolArgs")]
    #[ts(type = "any")]
    pub tool_args: Option<Value>,
    // For REQUIRE_USER_ACTION
    #[serde(rename = "actionPrompt")]
    pub action_prompt: Option<String>,
    // For SUCCESS
    #[serde(rename = "nextAgent")]
    pub next_agent: Option<AgentType>,
    pub task: Option<String>,
    // For DEAD_END
    pub reason: Option<String>,
}
