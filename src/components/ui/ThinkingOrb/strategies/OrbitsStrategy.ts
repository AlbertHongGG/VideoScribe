import { IOrbStrategy, ScaledOrbOptions, Point3D } from "../types";
import { createProjector, radiusScale, renderPoints, pseudoRandom } from "../math";

export class OrbitsStrategy implements IOrbStrategy {
  name = "orbits";
  defaultSpeed = 1.885;

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
    const projector = createProjector(time * 0.12, 0.3, cx, cy, 1);
    const rScale = radiusScale(size, opts.rsPow ?? 0.6);

    const points: Point3D[] = [];
    const orbitCount = opts.orbitN ?? 12;
    const ghostCount = opts.ghostN ?? 40;
    const particles = opts.particles ?? 3;

    for (let b = 0; b < orbitCount; b++) {
      const rand1 = pseudoRandom(b, 1.7);
      const rand2 = pseudoRandom(b, 5.2);
      const rand3 = pseudoRandom(b, 8.9);

      const orbitRadius = radius * (0.45 + 0.52 * rand1);
      const azimuth = rand1 * 2 * Math.PI;
      const polar = Math.acos(2 * rand2 - 1);

      const kx = Math.sin(polar) * Math.cos(azimuth);
      const ky = Math.cos(polar);
      const kz = Math.sin(polar) * Math.sin(azimuth);

      let px = -ky;
      let py = kx;
      const pz = 0;
      const norm = Math.max(1e-6, Math.sqrt(px * px + py * py));
      px /= norm;
      py /= norm;

      const sx = ky * pz - kz * py;
      const sy = kz * px - kx * pz;
      const sz = kx * py - ky * px;
      const speed = (0.25 + 0.55 * rand3) * (rand3 > 0.5 ? 1 : -1);

      for (let c = 0; c < ghostCount; c++) {
        const theta = (c / ghostCount) * 2 * Math.PI;
        const [tx, ty, tz] = projector(
          (px * Math.cos(theta) + sx * Math.sin(theta)) * orbitRadius,
          (py * Math.cos(theta) + sy * Math.sin(theta)) * orbitRadius,
          (pz * Math.cos(theta) + sz * Math.sin(theta)) * orbitRadius
        );
        const depth = (tz / orbitRadius + 1) / 2;
        points.push({
          x: tx,
          y: ty,
          z: tz,
          r: (opts.ghostR ?? 0.9) * rScale,
          white: 0.72,
          a: (opts.ghostA ?? 0.5) * (0.4 + 0.6 * depth),
        });
      }

      for (let c = 0; c < particles; c++) {
        const theta = time * speed + (c / particles) * 2 * Math.PI + rand2 * 6;
        const [tx, ty, tz] = projector(
          (px * Math.cos(theta) + sx * Math.sin(theta)) * orbitRadius,
          (py * Math.cos(theta) + sy * Math.sin(theta)) * orbitRadius,
          (pz * Math.cos(theta) + sz * Math.sin(theta)) * orbitRadius
        );
        const depth = (tz / orbitRadius + 1) / 2;
        points.push({
          x: tx,
          y: ty,
          z: tz,
          r: ((opts.partR ?? 1.2) + (opts.partRDepth ?? 1.6) * depth) * rScale,
          white: 0.3 - 0.22 * depth,
          a: 1.0,
        });
      }
    }

    renderPoints(ctx, points, isDark, opts.rMin ?? 0.3);
  }
}
