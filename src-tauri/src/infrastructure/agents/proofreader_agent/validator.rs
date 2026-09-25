use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ProofreadCorrectionItem {
    pub id: usize,
    pub text: String,
}

/// Validates that the corrected text is non-empty, sane in length ratio,
/// and not an extreme hallucination.
pub fn validate_correction(orig_text: &str, corrected_text: &str) -> Result<(), String> {
    let trimmed = corrected_text.trim();
    if trimmed.is_empty() {
        return Err("Corrected text cannot be empty".to_string());
    }

    let orig_char_count = orig_text.chars().count();
    let corr_char_count = trimmed.chars().count();

    if orig_char_count > 0 {
        let ratio = corr_char_count as f64 / orig_char_count as f64;
        if ratio < 0.2 || ratio > 4.0 {
            return Err(format!(
                "Suspicious length expansion/contraction: original has {} chars, corrected has {} chars (ratio: {:.2})",
                orig_char_count, corr_char_count, ratio
            ));
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_correction() {
        let orig = "何千年も昔に地下庫変動があったの";
        let corr = "何千年も昔に地殻変動があったの";
        assert!(validate_correction(orig, corr).is_ok());
    }

    #[test]
    fn test_empty_correction() {
        let orig = "何千年も昔に地下庫変動があったの";
        let corr = "   ";
        assert!(validate_correction(orig, corr).is_err());
    }

    #[test]
    fn test_extreme_length_expansion() {
        let orig = "はい";
        let corr = "はいそうですこれは非常に長い文章で本来言っていないことを大量に捏造して書いているケースです";
        assert!(validate_correction(orig, corr).is_err());
    }
}
