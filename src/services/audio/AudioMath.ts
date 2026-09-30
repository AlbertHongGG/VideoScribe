/**
 * AudioMath - Acoustic and Perceptual Volume Transformation Utilities.
 * Strictly separates standard linear media volume from psychoacoustic stem balance curves.
 */
export class AudioMath {
  /**
   * Linear gain mapping for native video volume.
   * Clamps strictly to [0.0, 1.0] without polynomial/logarithmic distortion,
   * ensuring 100% 1:1 fidelity with YouTube and native browser playback.
   */
  public static linearGain(volume: number): number {
    if (Number.isNaN(volume)) return 1.0;
    return Math.max(0, Math.min(1, volume));
  }

  /**
   * Psychoacoustic perceptual curve specifically and exclusively for
   * vocal and background stem balance sliders (0 to 100 percentage or 0 to 1.0).
   *
   * Maps a linear fader position to acoustic amplitude gain using a calibrated
   * logarithmic decibel curve (36 dB dynamic range), matching studio DAW fader standards.
   * Guarantees unity gain (1.0 = 0 dB) at 100%, and true silence (0.0 = -inf dB) at 0%.
   */
  public static perceptualStemGain(sliderValue: number): number {
    if (Number.isNaN(sliderValue)) return 1.0;
    const normalized = sliderValue > 1 ? sliderValue / 100 : sliderValue;
    const clamped = Math.max(0, Math.min(1, normalized));
    if (clamped <= 0) return 0.0;
    if (clamped >= 1) return 1.0;

    // 36 dB dynamic range logarithmic curve: 10^(36 * (clamped - 1) / 20)
    return Math.pow(10, (36 * (clamped - 1)) / 20);
  }
}
