use serde::{Deserialize, Serialize};
use ts_rs::TS;
use specta::Type;


use crate::domain::stt_job::WordTiming;
use crate::domain::language::RubySegment;

#[derive(Debug, Serialize, Deserialize, Clone, TS, Type)]
#[ts(export, export_to = "../../src/types/app_types.ts")]
pub struct STTResult {
    pub start: f64,
    pub end: f64,
    pub text: String,
    pub translation: Option<String>,
    pub words: Option<Vec<WordTiming>>,
    pub ruby: Option<Vec<RubySegment>>,
}

impl STTResult {
    /// Updates the canonical text and synchronizes all dependent representations (words and ruby),
    /// preserving domain invariants across all pipeline tasks and UI layers.
    pub fn set_text_and_sync(
        &mut self,
        new_text: String,
        ruby_provider: Option<&dyn crate::domain::language::RubyAnnotationProvider>,
    ) {
        let trimmed = new_text.trim();
        if trimmed.is_empty() {
            return;
        }

        self.text = trimmed.to_string();

        // 1. Invalidate and re-annotate Ruby if a provider is supplied
        if let Some(provider) = ruby_provider {
            if let Ok(new_ruby) = provider.annotate(&self.text) {
                self.ruby = Some(new_ruby);
            } else {
                self.ruby = None;
            }
        } else {
            self.ruby = None;
        }

        // 2. Project/resynchronize WordTimings if words existed
        if let Some(ref old_words) = self.words {
            self.words = Some(Self::project_word_timings(old_words, &self.text, self.start, self.end, self.ruby.as_deref()));
        }
    }

    /// Projects old word timing bounds across the new text tokens/characters.
    /// Guarantees that:
    /// 1. `words.map(|w| w.text).join("") == new_text`
    /// 2. Word timings strictly span `[start, end]`.
    pub fn project_word_timings(
        old_words: &[WordTiming],
        new_text: &str,
        start: f64,
        end: f64,
        ruby_segments: Option<&[RubySegment]>,
    ) -> Vec<WordTiming> {
        let clean_text = new_text.trim();
        if clean_text.is_empty() {
            return Vec::new();
        }

        let total_chars: usize = clean_text.chars().count().max(1);

        // Determine token units for new_text:
        // Priority 1: If ruby_segments are available, use morphological units (bases & texts)
        // Priority 2: If new_text contains spaces, use whitespace splitting
        // Priority 3: Character-based breakdown for CJK
        let token_strings: Vec<String> = if let Some(segments) = ruby_segments {
            segments.iter().map(|seg| match seg {
                RubySegment::Text { text } => text.clone(),
                RubySegment::Ruby { base, .. } => base.clone(),
            }).filter(|s| !s.is_empty()).collect()
        } else if clean_text.contains(' ') {
            clean_text.split_whitespace().map(|s| s.to_string()).collect()
        } else {
            clean_text.chars().map(|c| c.to_string()).collect()
        };

        if token_strings.is_empty() {
            return vec![WordTiming {
                text: clean_text.to_string(),
                start,
                end,
                probability: 1.0,
            }];
        }

        // Determine effective timing span from old words, clamped to [start, end]
        let span_start = old_words.first().map(|w| w.start).unwrap_or(start).max(start);
        let span_end = old_words.last().map(|w| w.end).unwrap_or(end).min(end);
        let effective_start = span_start.min(end);
        let effective_end = span_end.max(effective_start + 0.05).min(end);
        let span_duration = (effective_end - effective_start).max(0.05);

        let mut projected = Vec::with_capacity(token_strings.len());
        let mut char_acc = 0;

        for (i, token) in token_strings.iter().enumerate() {
            let token_chars = token.chars().count().max(1);
            let t_start = effective_start + (span_duration * (char_acc as f64 / total_chars as f64));
            char_acc += token_chars;
            let t_end = if i == token_strings.len() - 1 {
                effective_end
            } else {
                effective_start + (span_duration * (char_acc as f64 / total_chars as f64))
            };

            projected.push(WordTiming {
                text: token.clone(),
                start: (t_start * 1000.0).round() / 1000.0,
                end: (t_end * 1000.0).round() / 1000.0,
                probability: 1.0,
            });
        }

        projected
    }
}


#[derive(Debug, Serialize, Deserialize, Clone, TS, Type, PartialEq)]
#[ts(export, export_to = "../../src/types/app_types.ts")]
#[serde(rename_all = "snake_case")]
pub enum TaskType {
    Preprocess,
    Mss,
    Vad,
    Stt,
    Proofread,
    ForcedAlignment,
    Segmentation,
    RubyAnnotation,
    Translation,
}

impl TaskType {
    pub fn order_index(&self) -> usize {
        match self {
            TaskType::Preprocess => 0,
            TaskType::Mss => 1,
            TaskType::Vad => 2,
            TaskType::Stt => 3,
            TaskType::Proofread => 4,
            TaskType::ForcedAlignment => 5,
            TaskType::Segmentation => 6,
            TaskType::RubyAnnotation => 7,
            TaskType::Translation => 8,
        }
    }

    pub fn display_label(&self) -> &'static str {
        match self {
            TaskType::Preprocess => "Extracting Audio",
            TaskType::Mss => "Separating Audio Sources",
            TaskType::Vad => "Detecting Voice Activity",
            TaskType::Stt => "Transcribing Speech",
            TaskType::Proofread => "Proofreading Subtitles",
            TaskType::ForcedAlignment => "Aligning Subtitles",
            TaskType::Segmentation => "Segmenting Content",
            TaskType::RubyAnnotation => "Annotating Furigana",
            TaskType::Translation => "Translating Subtitles",
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, TS, Type, PartialEq)]
#[ts(export, export_to = "../../src/types/app_types.ts")]
#[serde(rename_all = "snake_case")]
pub enum TaskStatus {
    Pending,
    Running,
    Completed,
    Error,
    Cancelled,
    Outdated,
}

#[derive(Debug, Serialize, Deserialize, Clone, TS, Type)]
#[ts(export, export_to = "../../src/types/app_types.ts")]
pub struct PipelineTask {
    pub task_type: TaskType,
    pub status: TaskStatus,
    pub progress: f64,
    pub error_message: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, TS, Type)]
#[ts(export, export_to = "../../src/types/app_types.ts")]
pub struct VadSegment {
    pub start: f64,
    pub end: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone, TS, Type)]
#[ts(export, export_to = "../../src/types/app_types.ts")]
pub struct ProjectState {
    pub workspace_dir: Option<String>,
    pub video_path: Option<String>,
    pub extracted_audio_path: Option<String>,
    pub results: Vec<STTResult>,
    pub target_language: String,
    pub source_language: Option<String>,
    pub vocals_audio_path: Option<String>,
    pub background_audio_path: Option<String>,
    pub stt_model_size: Option<String>,
    pub vad_engine: Option<String>,
    pub mss_engine: Option<String>,
    pub mss_model: Option<String>,
    pub fa_engine: Option<String>,
    pub fa_model: Option<String>,
    pub use_batch: bool,
    pub batch_size: i32,
    pub vad_segments: Option<Vec<VadSegment>>,
    pub enable_furigana: bool,
}

impl Default for ProjectState {
    fn default() -> Self {
        Self {
            workspace_dir: None,
            video_path: None,
            extracted_audio_path: None,
            results: Vec::new(),
            target_language: "zh-TW".to_string(),
            source_language: None,
            vocals_audio_path: None,
            background_audio_path: None,
            stt_model_size: None,
            vad_engine: None,
            mss_engine: None,
            mss_model: None,
            fa_engine: None,
            fa_model: None,
            use_batch: false,
            batch_size: 1,
            vad_segments: None,
            enable_furigana: false,
        }
    }
}

impl ProjectState {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn is_results_empty(&self) -> bool {
        self.results.is_empty()
    }

    pub fn get_results_clone(&self) -> Vec<STTResult> {
        self.results.clone()
    }

    pub fn get_target_language(&self) -> &str {
        &self.target_language
    }

    pub fn add_stt_result(&mut self, result: STTResult) {
        self.results.push(result);
    }

    pub fn import_results(&mut self, results: Vec<STTResult>) {
        self.results = results;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_stt_result_set_text_and_sync() {
        let old_words = vec![
            WordTiming { text: "スマホ".to_string(), start: 10.0, end: 10.5, probability: 0.9 },
            WordTiming { text: "も".to_string(), start: 10.5, end: 10.7, probability: 0.9 },
            WordTiming { text: "暖かくて".to_string(), start: 10.7, end: 11.5, probability: 0.9 },
            WordTiming { text: "ポカポカする".to_string(), start: 11.5, end: 12.5, probability: 0.9 },
        ];

        let mut res = STTResult {
            start: 10.0,
            end: 12.5,
            text: "スマホも暖かくてポカポカする".to_string(),
            translation: None,
            words: Some(old_words),
            ruby: None,
        };

        // Update text to corrected version
        res.set_text_and_sync("風も暖かくてポカポカする".to_string(), None);

        assert_eq!(res.text, "風も暖かくてポカポカする");
        assert!(res.words.is_some());

        let new_words = res.words.unwrap();
        // Concatenating new words must reconstruct the new text!
        let reconstructed: String = new_words.iter().map(|w| w.text.as_str()).collect();
        assert_eq!(reconstructed, "風も暖かくてポカポカする");

        // Timings must be monotonic and span [10.0, 12.5]
        assert!(new_words.first().unwrap().start >= 10.0);
        assert!(new_words.last().unwrap().end <= 12.5);
        for w in &new_words {
            assert!(w.start <= w.end);
        }
    }
}

