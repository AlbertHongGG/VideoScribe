import sys
import argparse
from videoscribe.stt.engine import STTEngine

def main():
    parser = argparse.ArgumentParser(description="VideoScribe STT Backend")
    parser.add_argument("video_path", help="Path to the video file")
    parser.add_argument("--model", default="medium", help="Model size to use (e.g. tiny, base, small, medium, large-v3)")
    parser.add_argument("--device", default="auto", help="Device to use (cpu or cuda)")
    parser.add_argument("--compute_type", default="default", help="Compute type (e.g. default, float16, int8_float16)")
    parser.add_argument("--language", default="auto", help="Language code (e.g. en, ja, zh) or auto")
    args = parser.parse_args()

    engine = STTEngine(
        model_size=args.model,
        device=args.device,
        compute_type=args.compute_type
    )
    
    engine.transcribe(args.video_path, language=args.language)

if __name__ == "__main__":
    main()

