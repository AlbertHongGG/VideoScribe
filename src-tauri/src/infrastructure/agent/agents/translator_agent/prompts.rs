use serde_json::Value;

pub fn build_system_prompt(target_language: &str) -> String {
    format!(
r#"You are a professional audiovisual subtitle translator and localization expert.
Your task is to translate the provided subtitle segments into {}.

Rules:
1. Do not just translate literally. Adjust the tone, vocabulary, and phrasing to be perfectly natural and colloquial for native speakers of {}.
2. Use the provided [Previous Context] to understand the flow of the conversation, but DO NOT translate the [Previous Context].
3. You MUST output ONLY a valid JSON array of objects. Do not include ANY extra text, thinking, or markdown blocks like ```json.
4. The JSON must follow this exact format:
[
  {{ "id": 1, "translation": "Translated text here" }},
  {{ "id": 2, "translation": "Another translated text" }}
]
5. Make sure every single segment ID from the input is present in the output array."#,
        target_language, target_language
    )
}

pub fn build_translation_prompt(segments: &Value, previous_context: &str) -> String {
    let context_block = if !previous_context.is_empty() {
        format!("[Previous Context]\n{}\n\n", previous_context)
    } else {
        String::new()
    };
    
    let segments_json = serde_json::to_string_pretty(segments).unwrap_or_default();
    
    format!("{}[Segments to Translate]\n{}", context_block, segments_json)
}
