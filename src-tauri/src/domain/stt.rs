use serde_json::Value;

pub trait STTProvider: Send + Sync {
    fn start_transcription(
        &self,
        video_path: &str,
        model_size: &str,
        on_event: Box<dyn Fn(Value) + Send + Sync>,
    ) -> Result<(), String>;
}
