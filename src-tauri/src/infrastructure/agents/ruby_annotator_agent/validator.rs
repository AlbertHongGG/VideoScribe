use crate::domain::language::RubySegment;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RubyCorrectionItem {
    pub id: usize,
    pub ruby: Vec<RubySegment>,
}

/// Validates that the reconstructed string from the ruby segments
/// 100% exactly matches the original text without any character addition,
/// omission, or modification.
pub fn validate_invariance(original_text: &str, segments: &[RubySegment]) -> Result<(), String> {
    let mut reconstructed = String::new();
    for seg in segments {
        match seg {
            RubySegment::Text { text } => reconstructed.push_str(text),
            RubySegment::Ruby { base, .. } => reconstructed.push_str(base),
        }
    }

    if reconstructed == original_text {
        Ok(())
    } else {
        Err(format!(
            "Invariance Violation! Original: '{}', Reconstructed: '{}'",
            original_text, reconstructed
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_invariance() {
        let orig = "一日本にいます";
        let segments = vec![
            RubySegment::Ruby { base: "一日".into(), ruby: "いちにち".into() },
            RubySegment::Ruby { base: "本".into(), ruby: "ほん".into() },
            RubySegment::Text { text: "にいます".into() },
        ];
        assert!(validate_invariance(orig, &segments).is_ok());
    }

    #[test]
    fn test_invalid_invariance_mismatch() {
        let orig = "一日本にいます";
        let segments = vec![
            RubySegment::Ruby { base: "一日".into(), ruby: "いちにち".into() },
            RubySegment::Text { text: "日本にいます".into() }, // duplicated "日"
        ];
        assert!(validate_invariance(orig, &segments).is_err());
    }
}
