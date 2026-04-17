import type { Point2 } from "./fourier";

/** A closed, mildly asymmetric loop — reads as a simplified “portrait” silhouette for the hero. */
export function buildDemoProfessorPath(samples = 320): Point2[] {
  const pts: Point2[] = [];
  for (let i = 0; i < samples; i++) {
    const u = (i / samples) * Math.PI * 2;
    const squash = 1.08;
    const r =
      220 +
      28 * Math.cos(2 * u) +
      18 * Math.sin(3 * u) +
      12 * Math.cos(5 * u + 0.4);
    pts.push({
      x: Math.cos(u) * r * squash,
      y: Math.sin(u) * r * 1.02 - 8 * Math.sin(2 * u),
    });
  }
  return pts;
}
