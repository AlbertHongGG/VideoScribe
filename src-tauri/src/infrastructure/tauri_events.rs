use crate::domain::events::EventDispatcher;
use serde_json::Value;
use tauri::{AppHandle, Emitter};

pub struct TauriEventDispatcher {
    app: AppHandle,
}

impl TauriEventDispatcher {
    pub fn new(app: AppHandle) -> Self {
        Self { app }
    }
}

impl EventDispatcher for TauriEventDispatcher {
    fn emit(&self, event: &str, payload: Value) -> Result<(), String> {
        self.app.emit(event, payload).map_err(|e| e.to_string())
    }
}
