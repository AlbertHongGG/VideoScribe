use serde_json::Value;

pub trait EventDispatcher: Send + Sync {
    fn emit(&self, event: &str, payload: Value) -> Result<(), String>;
}
