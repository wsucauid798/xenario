import type {
  BoundaryInfo,
  CameraPath,
  Vec3,
  WalkableCorridor,
} from './types.ts';

/**
 * Generate a camera rail along the principal axis with terrain-following
 * heights from the walkable corridor and a gentle S-curve offset on the
 * secondary axis (constrained to corridor width).
 */
export function generateCameraPath(
  _principalAxis: Vec3,
  secondaryAxis: Vec3,
  boundary: BoundaryInfo,
  floorHeight: number,
  corridor: WalkableCorridor | null,
  options: {
    cameraHeight?: number;
    numWaypoints?: number;
    walkingSpeed?: number;
    lateralSway?: number;
  } = {},
): CameraPath {
  const {
    cameraHeight = 1.6, // meters above floor (eye level)
    numWaypoints = 7,
    walkingSpeed = 2.0, // m/s
    lateralSway = 0.3, // meters of S-curve offset
  } = options;

  const waypoints: Vec3[] = [];

  for (let i = 0; i < numWaypoints; i++) {
    const t = i / (numWaypoints - 1);

    // Interpolate along principal axis from start to end
    const p: Vec3 = [
      boundary.startPoint[0] +
        (boundary.endPoint[0] - boundary.startPoint[0]) * t,
      0, // Y set below
      boundary.startPoint[2] +
        (boundary.endPoint[2] - boundary.startPoint[2]) * t,
    ];

    // Terrain-following: get local floor height from corridor samples
    let localFloor = floorHeight;
    if (corridor && corridor.samples.length > 1) {
      localFloor = interpolateCorridorHeight(corridor, t);
    }
    p[1] = localFloor + cameraHeight;

    // Gentle S-curve offset along secondary axis
    // Constrain sway to corridor width if available
    let maxSway = lateralSway;
    if (corridor && corridor.samples.length > 1) {
      const corridorWidth = interpolateCorridorWidth(corridor, t);
      maxSway = Math.min(lateralSway, corridorWidth * 0.15); // max 15% of corridor width
    }

    const sOffset = Math.sin(t * Math.PI) * maxSway;
    const direction = i % 2 === 0 ? 1 : -1;
    p[0] += secondaryAxis[0] * sOffset * direction;
    p[2] += secondaryAxis[2] * sOffset * direction;

    waypoints.push(p);
  }

  // Duration proportional to path length
  const duration = boundary.principalLength / walkingSpeed;

  return { duration: Math.max(duration, 10), waypoints };
}

/** Interpolate floor height from corridor samples at parametric t (0-1). */
function interpolateCorridorHeight(
  corridor: WalkableCorridor,
  t: number,
): number {
  const samples = corridor.samples;
  if (samples.length === 0) return 0;
  if (samples.length === 1) return samples[0].floorHeight;

  // Find surrounding samples
  for (let i = 0; i < samples.length - 1; i++) {
    if (t >= samples[i].t && t <= samples[i + 1].t) {
      const range = samples[i + 1].t - samples[i].t;
      const frac = range > 0 ? (t - samples[i].t) / range : 0;
      return (
        samples[i].floorHeight +
        (samples[i + 1].floorHeight - samples[i].floorHeight) * frac
      );
    }
  }

  // Clamp to edges
  return t <= samples[0].t
    ? samples[0].floorHeight
    : samples[samples.length - 1].floorHeight;
}

/** Interpolate corridor width at parametric t (0-1). */
function interpolateCorridorWidth(
  corridor: WalkableCorridor,
  t: number,
): number {
  const samples = corridor.samples;
  if (samples.length === 0) return 2.0;
  if (samples.length === 1) return samples[0].width;

  for (let i = 0; i < samples.length - 1; i++) {
    if (t >= samples[i].t && t <= samples[i + 1].t) {
      const range = samples[i + 1].t - samples[i].t;
      const frac = range > 0 ? (t - samples[i].t) / range : 0;
      return (
        samples[i].width + (samples[i + 1].width - samples[i].width) * frac
      );
    }
  }

  return t <= samples[0].t
    ? samples[0].width
    : samples[samples.length - 1].width;
}
