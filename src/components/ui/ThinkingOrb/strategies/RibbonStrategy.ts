import { IOrbStrategy, ScaledOrbOptions, Point3D } from "../types";
import { createProjector, fibonacciSphere, radiusScale, renderPoints } from "../math";

export class RibbonStrategy implements IOrbStrategy {
  name = "ribbon";
  defaultSpeed = 2.34;

  paint(
    ctx: CanvasRenderingContext2D,
    size: number,
    time: number,
    isDark: boolean,
    opts: ScaledOrbOptions
  ): void {
    const cx = size / 2;
    const cy = size / 2;
    const radius = (size / 2) * 0.78;
    const spin = opts.spin ?? 1;

    const projector = createProjector(time * 0.1 * spin, 0.3, cx, cy, 1);
    const rScale = radiusScale(size, opts.rsPow ?? 0.6);

    const points: Point3D[] = [];
    const ghostCount = opts.ghostN ?? 150;

    // 1. Ambient ghost sphere particles
    for (let f = 0; f < ghostCount; f++) {
      const spherePt = fibonacciSphere(f, ghostCount);
      const [px, py, pz] = projector(spherePt[0] * radius, spherePt[1] * radius, spherePt[2] * radius);
      const depth = (pz / radius + 1) / 2;
      points.push({
        x: px,
        y: py,
        z: pz,
        r: 0.8 * rScale,
        white: 0.78,
        a: 0.1 + 0.22 * depth,
      });
    }

    // 2. Multi-band undulating ribbon
    const rollAngle = time * 0.24 * spin;
    const tiltAngle = 0.55 + 0.3 * Math.sin(time * 0.18) * spin;

    const cosR = Math.cos(rollAngle);
    const sinR = Math.sin(rollAngle);
    const cosT = Math.cos(tiltAngle);
    const sinT = Math.sin(tiltAngle);

    const yVal = -sinR * sinT;
    const wVal = cosR * sinT;
    const kVal = -sinR * cosT;
    const vVal = sinR * yVal - cosR * wVal;
    const rVal = cosR * cosT;

    const lanes = opts.lanes ?? 5;
    const segs = opts.segs ?? 88;
    const bandCount = Math.max(1, Math.round(lanes * (opts.bandMul ?? 1)));

    for (let f = 0; f < bandCount; f++) {
      const bandOffset = (f - (bandCount - 1) / 2) * 0.075;
      const normalizedBand = Math.abs(f - (bandCount - 1) / 2) / Math.max(1, (bandCount - 1) / 2);

      for (let s = 0; s < segs; s++) {
        const segAngle = (s / segs) * 2 * Math.PI;
        const wobble = (0.16 * Math.sin(segAngle * 3 - time * 1.7 + f * 0.22) + 0.07 * Math.sin(segAngle * 5 + time * 1.1)) * (opts.wobMul ?? 1);
        const wave = bandOffset + wobble;

        const tx = cosR * Math.cos(segAngle) + yVal * Math.sin(segAngle) + kVal * wave;
        const ty = cosT * Math.sin(segAngle) + vVal * wave;
        const tz = sinR * Math.cos(segAngle) + wVal * Math.sin(segAngle) + rVal * wave;

        const norm = Math.sqrt(tx * tx + ty * ty + tz * tz);
        if (norm === 0) continue;

        const [projX, projY, projZ] = projector(
          (tx / norm) * radius,
          (ty / norm) * radius,
          (tz / norm) * radius
        );
        const depth = (projZ / radius + 1) / 2;

        points.push({
          x: projX,
          y: projY,
          z: projZ,
          r: ((opts.rBase ?? 1.1) + (opts.rDepth ?? 1.7) * depth) * (1 - 0.25 * normalizedBand) * rScale,
          white: 0.52 - 0.44 * depth + 0.18 * normalizedBand,
          a: 0.4 + 0.6 * depth,
        });
      }
    }

    renderPoints(ctx, points, isDark, opts.rMin ?? 0.35);
  }
}
