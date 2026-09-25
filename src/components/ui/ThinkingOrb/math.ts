import { Point3D, ScaledOrbOptions, OrbState } from "./types";

/**
 * Deterministic pseudo-random number generator
 */
export function pseudoRandom(e: number, n: number): number {
  const s = Math.sin(e * 12.9898 + n * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Fibonacci sphere point generation for uniform spherical distribution
 */
export function fibonacciSphere(i: number, n: number): [number, number, number] {
  const phi = Math.PI * (3 - Math.sqrt(5)); // Golden angle
  const y = 1 - 2 * (i + 0.5) / n;
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  const theta = i * phi;
  return [r * Math.cos(theta), y, r * Math.sin(theta)];
}

/**
 * Angular difference wrapped to [-PI, PI]
 */
export function angleDiff(a: number, b: number): number {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

/**
 * Creates a 3D Euler rotation and projection function
 */
export function createProjector(yaw: number, pitch: number, cx: number, cy: number, scale: number) {
  const sinP = Math.sin(pitch);
  const cosP = Math.cos(pitch);
  const sinY = Math.sin(yaw);
  const cosY = Math.cos(yaw);

  return (x: number, y: number, z: number): [number, number, number] => {
    const u = x * cosY + z * sinY;
    const h = -x * sinY + z * cosY;
    const b = y * cosP - h * sinP;
    const projectedZ = y * sinP + h * cosP;
    return [cx + u * scale, cy - b * scale, projectedZ];
  };
}

/**
 * Continuous radius scale power function based on size
 */
export function radiusScale(size: number, power = 0.6): number {
  return Math.pow(size / 300, power);
}

/**
 * Depth sort and render 3D points to the 2D canvas context
 */
export function renderPoints(
  ctx: CanvasRenderingContext2D,
  points: Point3D[],
  isDark: boolean,
  rMin = 0.3
) {
  points.sort((a, b) => a.z - b.z);

  for (const pt of points) {
    const alpha = pt.a ?? 1;
    if (alpha < 0.02) continue;

    const clampedWhite = Math.min(1, Math.max(0, pt.white));
    const intensity = Math.round((isDark ? 1 - clampedWhite : clampedWhite) * 255);

    ctx.fillStyle = `rgba(${intensity}, ${intensity}, ${intensity}, ${alpha})`;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, Math.max(rMin, pt.r), 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Resolves continuous, resolution-adaptive options for any arbitrary canvas size
 */
export function resolveContinuousOptions(state: OrbState, size: number): ScaledOrbOptions {
  const k = Math.max(0.2, size / 64);

  switch (state) {
    case "composing": // Ribbon
      return {
        lanes: 5,
        segs: Math.max(40, Math.round(88 * Math.pow(k, 0.45))),
        ghostN: Math.max(40, Math.round(150 * Math.pow(k, 0.75))),
        bandMul: 3.9,
        wobMul: 1.0,
        spin: 0,
        rBase: 1.1,
        rDepth: 1.7,
        rsPow: 0.6,
        rMin: 0.35,
      };

    case "searching": // Globe
      return {
        latRings: Math.max(8, Math.round(17 * Math.pow(k, 0.5))),
        lonDensity: Math.max(16, Math.round(44 * Math.pow(k, 0.5))),
        rBase: 0.6,
        rDepth: 1.7,
        rBoost: 1,
        inkFar: 0.62,
        inkSpan: 0.54,
        rsPow: 0.6,
        rMin: 0.3,
        scanMul: 4.1,
        dimBase: 0.45,
      };

    case "working": // Orbits
    default:
      return {
        orbitN: Math.max(6, Math.round(12 * Math.pow(k, 0.5))),
        ghostN: Math.max(20, Math.round(40 * Math.pow(k, 0.6))),
        particles: 3,
        partR: 1.2,
        partRDepth: 1.6,
        rsPow: 0.6,
        rMin: 0.3,
      };
  }
}
