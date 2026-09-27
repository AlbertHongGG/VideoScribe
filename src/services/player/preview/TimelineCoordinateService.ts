export interface CoordinateCalculationInput {
  clientX: number;
  trackRect: DOMRect;
  containerRect?: DOMRect | null;
  duration: number;
  previewWidth?: number;
  safeMargin?: number;
}

export interface CoordinateCalculationResult {
  targetTime: number;
  clampedAnchorX: number;
  ratio: number;
}

/**
 * Pure Mathematical Domain Service for timeline coordinate translation,
 * timestamp conversion, and viewport-aware boundary clamping.
 */
export class TimelineCoordinateService {
  public static calculate(input: CoordinateCalculationInput): CoordinateCalculationResult {
    const {
      clientX,
      trackRect,
      containerRect,
      duration,
      previewWidth = 160,
      safeMargin = 12,
    } = input;

    // 1. Calculate raw offset and bounded ratio along the scrubber track
    const rawTrackX = clientX - trackRect.left;
    const clampedTrackX = Math.max(0, Math.min(trackRect.width, rawTrackX));
    const ratio = trackRect.width > 0 ? clampedTrackX / trackRect.width : 0;
    const targetTime = Math.max(0, Math.min(duration, ratio * duration));

    // 2. Compute viewport safe boundaries for clamping
    const halfWidth = previewWidth / 2;

    let minCenter: number;
    let maxCenter: number;

    if (containerRect && containerRect.width > 0) {
      const leftPadding = Math.max(0, trackRect.left - containerRect.left);
      const rightPadding = Math.max(0, containerRect.right - trackRect.right);

      minCenter = halfWidth + safeMargin - leftPadding;
      maxCenter = trackRect.width - halfWidth - safeMargin + rightPadding;
    } else {
      minCenter = halfWidth + safeMargin;
      maxCenter = trackRect.width - halfWidth - safeMargin;
    }

    // Ensure minCenter does not exceed maxCenter in extremely constrained viewports
    if (minCenter > maxCenter) {
      minCenter = (minCenter + maxCenter) / 2;
      maxCenter = minCenter;
    }

    const clampedAnchorX = Math.max(minCenter, Math.min(maxCenter, rawTrackX));

    return {
      targetTime,
      clampedAnchorX,
      ratio,
    };
  }
}
