use crate::domain::project::STTResult;
use crate::domain::stt_job::WordTiming;

pub struct WordAligner;

impl WordAligner {
    /// Re-aligns a continuous stream of original WordTimings into new sentence segments.
    /// It enforces strict character consistency, ignoring whitespace to be robust
    /// against different spacing behaviors of LLMs or STT engines.
    pub fn align(original_words: Vec<WordTiming>, new_sentences: Vec<String>) -> Result<Vec<STTResult>, String> {
        let mut results = Vec::new();
        let mut current_word_idx = 0;
        let mut current_char_idx_in_word = 0;

        for sentence in new_sentences {
            let mut segment_words = Vec::new();
            let mut segment_start = -1.0;
            let mut segment_end = -1.0;
            let mut sentence_char_idx = 0;
            let sentence_chars: Vec<char> = sentence.chars().filter(|c| !c.is_whitespace()).collect();
            
            while sentence_char_idx < sentence_chars.len() {
                if current_word_idx >= original_words.len() {
                    return Err(format!("Consistency Check Failed: The generated sentences contain more characters than the original input."));
                }

                let current_word = &original_words[current_word_idx];
                let word_chars: Vec<char> = current_word.text.chars().filter(|c| !c.is_whitespace()).collect();

                if word_chars.is_empty() {
                    // Skip empty words (e.g. words that were just spaces)
                    segment_words.push(original_words[current_word_idx].clone());
                    current_word_idx += 1;
                    continue;
                }

                if current_char_idx_in_word == 0 && segment_words.is_empty() {
                    // First word of the segment
                    segment_start = current_word.start;
                }

                if sentence_chars[sentence_char_idx] != word_chars[current_char_idx_in_word] {
                    return Err(format!(
                        "Consistency Check Failed: Character mismatch. Expected '{}' but found '{}' at word '{}'",
                        word_chars[current_char_idx_in_word], sentence_chars[sentence_char_idx], current_word.text
                    ));
                }

                sentence_char_idx += 1;
                current_char_idx_in_word += 1;
                segment_end = current_word.end;

                if current_char_idx_in_word >= word_chars.len() {
                    // We finished processing this word
                    segment_words.push(original_words[current_word_idx].clone());
                    current_word_idx += 1;
                    current_char_idx_in_word = 0;
                }
            }
            
            if !segment_words.is_empty() {
                results.push(STTResult {
                    start: segment_start,
                    end: segment_end,
                    text: sentence.clone(),
                    translation: None,
                    words: Some(segment_words),
                });
            }
        }

        // Handle remaining words that might just be whitespace.
        while current_word_idx < original_words.len() {
            let current_word = &original_words[current_word_idx];
            let word_chars: Vec<char> = current_word.text.chars().filter(|c| !c.is_whitespace()).collect();
            if !word_chars.is_empty() {
                 return Err(format!("Consistency Check Failed: The original input contains more non-whitespace characters than the generated sentences. Leftover word: {}", current_word.text));
            }
            current_word_idx += 1;
        }

        Ok(results)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_align_perfect_match() {
        let words = vec![
            WordTiming { text: "This".to_string(), start: 0.0, end: 0.5, probability: 1.0 },
            WordTiming { text: "is".to_string(), start: 0.5, end: 1.0, probability: 1.0 },
            WordTiming { text: "a".to_string(), start: 1.0, end: 1.2, probability: 1.0 },
            WordTiming { text: "test".to_string(), start: 1.2, end: 2.0, probability: 1.0 },
        ];

        let sentences = vec![
            "This is".to_string(),
            "a test".to_string(),
        ];

        let results = WordAligner::align(words, sentences).unwrap();
        assert_eq!(results.len(), 2);
        
        assert_eq!(results[0].text, "This is");
        assert_eq!(results[0].start, 0.0);
        assert_eq!(results[0].end, 1.0);
        assert_eq!(results[0].words.as_ref().unwrap().len(), 2);

        assert_eq!(results[1].text, "a test");
        assert_eq!(results[1].start, 1.0);
        assert_eq!(results[1].end, 2.0);
        assert_eq!(results[1].words.as_ref().unwrap().len(), 2);
    }

    #[test]
    fn test_align_with_whitespaces() {
        let words = vec![
            WordTiming { text: " 這".to_string(), start: 0.0, end: 0.5, probability: 1.0 },
            WordTiming { text: "是".to_string(), start: 0.5, end: 1.0, probability: 1.0 },
            WordTiming { text: " 測 ".to_string(), start: 1.0, end: 1.2, probability: 1.0 },
            WordTiming { text: "試".to_string(), start: 1.2, end: 2.0, probability: 1.0 },
        ];

        let sentences = vec![
            "這是測試".to_string()
        ];

        let results = WordAligner::align(words, sentences).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].text, "這是測試");
        assert_eq!(results[0].start, 0.0);
        assert_eq!(results[0].end, 2.0);
    }

    #[test]
    fn test_align_mismatch() {
         let words = vec![
            WordTiming { text: "This".to_string(), start: 0.0, end: 0.5, probability: 1.0 },
            WordTiming { text: "is".to_string(), start: 0.5, end: 1.0, probability: 1.0 },
        ];
        
        // LLM hallucinated
        let sentences = vec![
            "That is".to_string(),
        ];

        let result = WordAligner::align(words, sentences);
        assert!(result.is_err());
    }
}
