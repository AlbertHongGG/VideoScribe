import { IOrbStrategy, ScaledOrbOptions, Point3D } from "../types";
import { createProjector, radiusScale, renderPoints, angleDiff } from "../math";

export class GlobeStrategy implements IOrbStrategy {
  name = "globe";
  defaultSpeed = 2.015;

  paint(
    ctx: CanvasRenderingContext2D,
    size: number,
    time: number,
    isDark: boolean,
    opts: ScaledOrbOptions
  ): void {
    const cx = size / 2;
    const cy = size / 2;
    const radius = (size / 2) * 0.82;
    const pitch = 0.4 + 0.06 * Math.sin(time * 0.35);

    const projector = createProjector(time * 0.5, pitch, cx, cy, radius);
    const meridianSpeed = time * (0.5 + (1.7 - 0.5) * (opts.scanMul ?? 1));
    const rScale = radiusScale(size, opts.rsPow ?? 0.6);
    const dimBase = opts.dimBase ?? 1;

    const points: Point3D[] = [];
    const latRings = opts.latRings ?? 17;
    const lonDensity = opts.lonDensity ?? 44;

    for (let p = 0; p <= latRings; p++) {
      const lat = -Math.PI / 2 + (p / latRings) * Math.PI;
      const cosLat = Math.cos(lat);
      const sinLat = Math.sin(lat);
      const ringCount = Math.max(1, Math.round(Math.abs(cosLat) * lonDensity));

      for (let v = 0; v < ringCount; v++) {
        const lon = (v / ringCount) * 2 * Math.PI;
        const [px, py, pz] = projector(cosLat * Math.cos(lon), sinLat, cosLat * Math.sin(lon));
        const depth = (pz + 1) / 2;
        const scanDiff = angleDiff(lon + time * 0.5, meridianSpeed);
        const scanGlow = Math.exp(-(scanDiff * scanDiff) / 0.18) * Math.max(0, pz);

        points.push({
          x: px,
          y: py,
          z: pz,
          r: ((opts.rBase ?? 0.6) + (opts.rDepth ?? 1.7) * depth + (opts.rBoost ?? 1) * scanGlow) * rScale,
          white: (opts.inkFar ?? 0.62) - (opts.inkSpan ?? 0.54) * depth,
          a: dimBase + (1 - dimBase) * Math.min(1, scanGlow),
        });
      }
    }

    renderPoints(ctx, points, isDark, opts.rMin ?? 0.3);
  }
}
