import { useState, useEffect, useRef, useCallback } from "react";
import { TimelinePreviewService, ThumbnailFrame, TimelineCoordinateService } from "../services/player/preview";
import { usePlayerPreferencesStore } from "../store/playerPreferencesStore";

interface UseTimelinePreviewOptions {
  videoUrl: string | null;
  duration: number;
}

/**
 * YouTube-style Frame-Hold Timeline Hover Hook.
 * Implements persistent frame buffering to eliminate loading indicators and flicker during scrubbing.
 */
export function useTimelinePreview({ videoUrl, duration }: UseTimelinePreviewOptions) {
  const isEnabled = usePlayerPreferencesStore((state) => state.enableTimelineHoverPreview);

  const [isHovering, setIsHovering] = useState(false);
  const [hoverTime, setHoverTime] = useState(0);
  const [anchorX, setAnchorX] = useState(0);
  // Holds the active frame across moves; atomically swaps when new frame arrives
  const [previewFrame, setPreviewFrame] = useState<ThumbnailFrame | null>(null);

  const trackRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const service = TimelinePreviewService.getInstance();

  // Load video into preview engine when URL changes & reset frame buffer
  useEffect(() => {
    setPreviewFrame(null);
    if (videoUrl && isEnabled) {
      service.loadVideo(videoUrl).catch(console.error);
    }
  }, [videoUrl, isEnabled]);

  // Clean up pending requests on unmount
  useEffect(() => {
    return () => {
      service.cancelPending();
    };
  }, []);

  const updateCoordinates = useCallback(
    (clientX: number) => {
      if (!trackRef.current || !duration || duration <= 0) return;

      const trackRect = trackRef.current.getBoundingClientRect();
      const containerRect = containerRef.current
        ? containerRef.current.getBoundingClientRect()
        : null;

      const { targetTime, clampedAnchorX } = TimelineCoordinateService.calculate({
        clientX,
        trackRect,
        containerRect,
        duration,
        previewWidth: isEnabled ? 160 : 70,
        safeMargin: 12,
      });

      // Synchronous 60fps telemetry update for time and position
      setAnchorX(clampedAnchorX);
      setHoverTime(targetTime);

      if (isEnabled && videoUrl) {
        service.requestFrame(targetTime, (frame) => {
          setPreviewFrame(frame);
        });
      }
    },
    [duration, isEnabled, videoUrl]
  );

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!duration || duration <= 0) return;
      setIsHovering(true);
      updateCoordinates(e.clientX);
    },
    [duration, updateCoordinates]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!duration || duration <= 0) return;
      updateCoordinates(e.clientX);
    },
    [duration, updateCoordinates]
  );

  const handleMouseLeave = useCallback(() => {
    setIsHovering(false);
    service.cancelPending();
  }, []);

  return {
    trackRef,
    containerRef,
    isHovering,
    hoverTime,
    anchorX,
    previewFrame,
    isEnabled,
    handlers: {
      onMouseEnter: handleMouseEnter,
      onMouseMove: handleMouseMove,
      onMouseLeave: handleMouseLeave,
    },
  };
}
