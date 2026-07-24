import logging
from typing import Optional
from videoscribe.domain.models import TaskType, TaskStatus
from videoscribe.application.pipeline import PipelineStep, PipelineContext
from videoscribe.application.segment_refiner import SegmentRefiner

logger = logging.getLogger(__name__)

class MssStep(PipelineStep):
    @property
    def task_type(self) -> TaskType:
        return TaskType.MSS

    def execute(self, context: PipelineContext) -> None:
        if not context.mss_analyzer:
            logger.info("MSS Engine is disabled or not provided.")
            return

        logger.info("Starting MSS preprocessing...")
        mss_result = context.mss_analyzer.separate(context.audio_path, context.options)
        
        # Save results into context for downstream steps
        context.vocals_path = mss_result.vocals_path
        context.instrumental_path = mss_result.instrumental_path
        
        # The audio_path used for transcription should now be the vocals
        context.audio_path = mss_result.vocals_path
        logger.info(f"MSS preprocessing completed. Vocals: {context.vocals_path}")


class VadStep(PipelineStep):
    @property
    def task_type(self) -> TaskType:
        return TaskType.VAD

    def execute(self, context: PipelineContext) -> None:
        if not context.vad_analyzer:
            logger.info("External VAD Engine is disabled or not provided.")
            return

        logger.info("Starting external VAD analysis...")
        vad_result = context.vad_analyzer.analyze(context.audio_path, context.options)
        
        # Save VAD result into context for SttStep
        context.vad_result = vad_result
        logger.info("External VAD analysis completed.")


class SttStep(PipelineStep):
    @property
    def task_type(self) -> TaskType:
        return TaskType.STT

    def execute(self, context: PipelineContext) -> None:
        if not context.stt_recognizer:
            raise RuntimeError("SpeechRecognizer is required for SttStep.")

        logger.info("Loading STT model...")
        context.stt_recognizer.load_model(context.options)
        
        # Get duration for progress tracking (on the current audio path which might be vocals)
        # Note: audio_path might have been updated by MssStep
        # We need an AudioAnalyzer here, but for simplicity, we pass it via context or just use decode_audio.
        # Actually, let's keep the get_duration logic here if we pass AudioAnalyzer, but let's assume we can pass total_duration inside STT or compute it there.
        # Wait, the previous code had self._analyzer.get_duration(audio_path).
        # We can add audio_duration to PipelineContext.
        # Let's just fetch it in STT Engine, but to report progress here, we need it.
        # We will add audio_duration to PipelineContext in worker.py before running.

        logger.info("Starting speech transcription...")
        
        # We inject the vad_result from context into the options or we pass it to the recognizer.
        # The recognizer's transcribe_file signature doesn't take vad_result directly. 
        # But wait! If we rewrite FasterWhisperEngine, it can just take vad_result via options or context.
        # Let's pass the context directly to transcribe_file, or just let transcribe_file take vad_result as a kwarg!
        
        segments_iter, info = context.stt_recognizer.transcribe_file(
            context.audio_path,
            context.options,
            context.cancel_token,
            vad_result=context.vad_result # Passed explicitly!
        )
        
        if info:
            context.detected_language = info.language
            context.reporter.report_task_progress(TaskType.STT, TaskStatus.RUNNING, language=info.language)
            
        refiner = SegmentRefiner(context.options.cue_policy)
        
        # We need duration to report percentage. We will use info.duration if available.
        duration = info.duration if info else 0.0
        
        for segment in segments_iter:
            refined_segments = refiner.process(segment)
            for domain_segment in refined_segments:
                context.stt_segments.append(domain_segment)
                context.reporter.report_result(domain_segment)
                
            if duration > 0:
                progress_pct = min(100, int((segment.end / duration) * 100))
                context.reporter.report_task_progress(TaskType.STT, TaskStatus.RUNNING, progress_pct)

class ForcedAlignmentStep(PipelineStep):
    @property
    def task_type(self) -> TaskType:
        return TaskType.FORCED_ALIGNMENT

    def execute(self, context: PipelineContext) -> None:
        if not context.fa_analyzer:
            logger.info("Forced Alignment Engine is disabled or not provided.")
            return

        logger.info("Starting forced alignment on STT segments...")
        
        # We need to notify the frontend that forced alignment is starting
        context.reporter.report_task_progress(TaskType.FORCED_ALIGNMENT, TaskStatus.RUNNING, 0.0)
        
        try:
            # Align the segments
            updated_segments = context.fa_analyzer.align(context.audio_path, context.stt_segments, context.options)
            
            context.stt_segments = updated_segments
            
            # Update the frontend with the newly aligned segments by replacing the STT ones
            context.reporter.report_result_replace_all(updated_segments)
            # For now, let's just send a TaskStatus.COMPLETED event with the aligned status.
            context.reporter.report_task_progress(TaskType.FORCED_ALIGNMENT, TaskStatus.COMPLETED, 100.0)
            
        except Exception as e:
            logger.error(f"Forced alignment failed: {e}")
            context.reporter.report_task_progress(TaskType.FORCED_ALIGNMENT, TaskStatus.ERROR, error_message=str(e))
            raise e
