import { CSSProperties, CanvasHTMLAttributes } from "react";

export type OrbState = "composing" | "searching" | "working" | "listening" | "solving" | "shaping";

export type OrbTheme = "auto" | "dark" | "light";

export interface Point3D {
  x: number;
  y: number;
  z: number;
  r: number;
  white: number;
  a?: number;
}

export interface ScaledOrbOptions {
  [key: string]: number | undefined;
  rMin?: number;
  rBase?: number;
  rDepth?: number;
  rsPow?: number;
  ghostN?: number;
  lanes?: number;
  segs?: number;
  bandMul?: number;
  wobMul?: number;
  spin?: number;
  orbitN?: number;
  particles?: number;
  latRings?: number;
  lonDensity?: number;
  scanMul?: number;
  dimBase?: number;
}

export interface IOrbStrategy {
  name: string;
  defaultSpeed: number;
  paint(
    ctx: CanvasRenderingContext2D,
    size: number,
    time: number,
    isDark: boolean,
    opts: ScaledOrbOptions
  ): void;
}

export interface ThinkingOrbProps extends Omit<CanvasHTMLAttributes<HTMLCanvasElement>, "style"> {
  /** Animation state / visual archetype. @default 'composing' */
  state?: OrbState;
  /** Arbitrary size in CSS pixels (e.g. 64, 96, 120, 140, 160). @default 120 */
  size?: number;
  /** Theme mode. @default 'dark' */
  theme?: OrbTheme;
  /** Animation speed multiplier. @default 1 */
  speed?: number;
  /** Freeze the animation on current frame. @default false */
  paused?: boolean;
  style?: CSSProperties;
  className?: string;
}
