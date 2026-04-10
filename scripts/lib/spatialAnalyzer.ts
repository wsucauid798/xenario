import type {
  AABB,
  BoundaryInfo,
  CameraPath,
  CorridorSample,
  FloorPlane,
  PCAResult,
  Vec3,
  WalkableCorridor,
} from './types.ts';
import { cross, getPoint, sub, length as vecLength } from './vec3.ts';

// ---------------------------------------------------------------------------
// Bounding box
// ---------------------------------------------------------------------------

export function computeAABB(positions: Float32Array, count: number): AABB {
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];

  for (let i = 0; i < count; i++) {
    const x = positions[i * 3 + 0];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];
    if (x < min[0]) min[0] = x;
    if (y < min[1]) min[1] = y;
    if (z < min[2]) min[2] = z;
    if (x > max[0]) max[0] = x;
    if (y > max[1]) max[1] = y;
    if (z > max[2]) max[2] = z;
  }

  const center: Vec3 = [
    (min[0] + max[0]) / 2,
    (min[1] + max[1]) / 2,
    (min[2] + max[2]) / 2,
  ];
  const size: Vec3 = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];

  return { min, max, center, size };
}

// ---------------------------------------------------------------------------
// PCA — covariance matrix + Jacobi eigendecomposition
// ---------------------------------------------------------------------------

function computeCovariance(
  positions: Float32Array,
  count: number,
): { mean: Vec3; cov: number[] } {
  let mx = 0,
    my = 0,
    mz = 0;
  for (let i = 0; i < count; i++) {
    mx += positions[i * 3 + 0];
    my += positions[i * 3 + 1];
    mz += positions[i * 3 + 2];
  }
  mx /= count;
  my /= count;
  mz /= count;

  let c00 = 0,
    c01 = 0,
    c02 = 0;
  let c11 = 0,
    c12 = 0,
    c22 = 0;

  for (let i = 0; i < count; i++) {
    const dx = positions[i * 3 + 0] - mx;
    const dy = positions[i * 3 + 1] - my;
    const dz = positions[i * 3 + 2] - mz;
    c00 += dx * dx;
    c01 += dx * dy;
    c02 += dx * dz;
    c11 += dy * dy;
    c12 += dy * dz;
    c22 += dz * dz;
  }

  const n = count - 1; // sample covariance
  return {
    mean: [mx, my, mz],
    cov: [
      c00 / n,
      c01 / n,
      c02 / n,
      c01 / n,
      c11 / n,
      c12 / n,
      c02 / n,
      c12 / n,
      c22 / n,
    ],
  };
}

/**
 * Jacobi eigenvalue decomposition for a 3x3 symmetric matrix.
 * Returns eigenvalues sorted descending with corresponding eigenvectors.
 */
function jacobi3x3(cov: number[]): {
  eigenvalues: Vec3;
  eigenvectors: [Vec3, Vec3, Vec3];
} {
  const a = [...cov]; // 9 elements, row-major
  const v = [1, 0, 0, 0, 1, 0, 0, 0, 1]; // eigenvector matrix (identity)

  const idx = (r: number, c: number) => r * 3 + c;

  for (let sweep = 0; sweep < 50; sweep++) {
    // Convergence check: sum of squared off-diagonal elements
    const offDiag = a[idx(0, 1)] ** 2 + a[idx(0, 2)] ** 2 + a[idx(1, 2)] ** 2;
    if (offDiag < 1e-20) break;

    // Sweep through off-diagonal pairs
    for (const [p, q] of [
      [0, 1],
      [0, 2],
      [1, 2],
    ] as [number, number][]) {
      const apq = a[idx(p, q)];
      if (Math.abs(apq) < 1e-15) continue;

      const app = a[idx(p, p)];
      const aqq = a[idx(q, q)];
      const tau = (aqq - app) / (2 * apq);
      const t = Math.sign(tau) / (Math.abs(tau) + Math.sqrt(1 + tau * tau));
      const c = 1 / Math.sqrt(1 + t * t);
      const s = t * c;

      // Apply Givens rotation to a
      a[idx(p, p)] = app - t * apq;
      a[idx(q, q)] = aqq + t * apq;
      a[idx(p, q)] = 0;
      a[idx(q, p)] = 0;

      for (let r = 0; r < 3; r++) {
        if (r === p || r === q) continue;
        const arp = a[idx(r, p)];
        const arq = a[idx(r, q)];
        a[idx(r, p)] = c * arp - s * arq;
        a[idx(p, r)] = a[idx(r, p)];
        a[idx(r, q)] = s * arp + c * arq;
        a[idx(q, r)] = a[idx(r, q)];
      }

      // Accumulate eigenvectors (columns of v)
      for (let r = 0; r < 3; r++) {
        const vrp = v[idx(r, p)];
        const vrq = v[idx(r, q)];
        v[idx(r, p)] = c * vrp - s * vrq;
        v[idx(r, q)] = s * vrp + c * vrq;
      }
    }
  }

  // Extract and sort by eigenvalue descending
  const evals: { val: number; vec: Vec3 }[] = [];
  for (let j = 0; j < 3; j++) {
    evals.push({
      val: a[idx(j, j)],
      vec: [v[idx(0, j)], v[idx(1, j)], v[idx(2, j)]],
    });
  }
  evals.sort((a, b) => b.val - a.val);

  return {
    eigenvalues: [evals[0].val, evals[1].val, evals[2].val],
    eigenvectors: [evals[0].vec, evals[1].vec, evals[2].vec],
  };
}

export function computePCA(positions: Float32Array, count: number): PCAResult {
  const { mean, cov } = computeCovariance(positions, count);
  const { eigenvalues, eigenvectors } = jacobi3x3(cov);
  return { eigenvalues, eigenvectors, mean };
}

// ---------------------------------------------------------------------------
// Adaptive point spacing estimation
// ---------------------------------------------------------------------------

function estimatePointSpacing(
  positions: Float32Array,
  count: number,
  sampleSize = 1000,
): number {
  const stride = Math.max(1, Math.floor(count / sampleSize));
  let totalMinDist = 0;
  let samples = 0;

  for (let i = 0; i < count; i += stride) {
    let minDist = Infinity;
    // Check ~20 random other points for nearest neighbor estimate
    for (let j = 0; j < 20; j++) {
      const k = Math.floor(Math.random() * count);
      if (k === i) continue;
      const dx = positions[i * 3] - positions[k * 3];
      const dy = positions[i * 3 + 1] - positions[k * 3 + 1];
      const dz = positions[i * 3 + 2] - positions[k * 3 + 2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < minDist) minDist = d;
    }
    if (minDist < Infinity) {
      totalMinDist += minDist;
      samples++;
    }
  }

  return samples > 0 ? totalMinDist / samples : 0.05;
}

// ---------------------------------------------------------------------------
// RANSAC floor detection — adaptive threshold, multi-candidate, confidence
// ---------------------------------------------------------------------------

export function detectFloor(
  positions: Float32Array,
  count: number,
  bounds: AABB,
  options: {
    iterations?: number;
    maxSamples?: number;
  } = {},
): FloorPlane {
  const { iterations = 300, maxSamples = 500_000 } = options;

  // Adaptive distance threshold based on point density, capped to avoid being too loose
  const spacing = estimatePointSpacing(positions, count);
  const distanceThreshold = Math.max(0.02, Math.min(0.08, spacing * 3));

  // Auto-detect likely "up" axis: the one with smallest bounding box extent
  const sizeArr = bounds.size;
  const minAxisIdx =
    sizeArr[0] <= sizeArr[1] && sizeArr[0] <= sizeArr[2]
      ? 0
      : sizeArr[1] <= sizeArr[2]
        ? 1
        : 2;

  // Subsample for speed
  const stride = Math.max(1, Math.floor(count / maxSamples));
  const sampleIndices: number[] = [];
  for (let i = 0; i < count; i += stride) sampleIndices.push(i);
  const N = sampleIndices.length;

  // Vertical range for "lower plane" preference
  const verticalMin = bounds.min[minAxisIdx];
  const verticalRange = bounds.size[minAxisIdx];

  // Keep top 3 candidates
  interface FloorCandidate {
    normal: Vec3;
    dist: number;
    inliers: number;
    height: number;
  }
  const candidates: FloorCandidate[] = [];

  for (let iter = 0; iter < iterations; iter++) {
    // Pick 3 random sample points
    const i0 = sampleIndices[Math.floor(Math.random() * N)];
    const i1 = sampleIndices[Math.floor(Math.random() * N)];
    const i2 = sampleIndices[Math.floor(Math.random() * N)];
    if (i0 === i1 || i1 === i2 || i0 === i2) continue;

    const p0 = getPoint(positions, i0);
    const p1 = getPoint(positions, i1);
    const p2 = getPoint(positions, i2);

    const normal = cross(sub(p1, p0), sub(p2, p0));
    const len = vecLength(normal);
    if (len < 1e-10) continue;
    normal[0] /= len;
    normal[1] /= len;
    normal[2] /= len;

    // Floor planes must be nearly perpendicular to the detected "up" axis
    if (Math.abs(normal[minAxisIdx]) < 0.85) continue;

    // Ensure normal points in positive direction of up axis
    if (normal[minAxisIdx] < 0) {
      normal[0] *= -1;
      normal[1] *= -1;
      normal[2] *= -1;
    }

    const d = -(normal[0] * p0[0] + normal[1] * p0[1] + normal[2] * p0[2]);

    // Count inliers
    let inliers = 0;
    for (let j = 0; j < N; j++) {
      const idx = sampleIndices[j];
      const planeDist = Math.abs(
        normal[0] * positions[idx * 3] +
          normal[1] * positions[idx * 3 + 1] +
          normal[2] * positions[idx * 3 + 2] +
          d,
      );
      if (planeDist < distanceThreshold) inliers++;
    }

    // Floor height: evaluate the plane at the bounding box center (not origin)
    // For plane n·p + d = 0, solving for the up-axis at center XZ:
    const otherAxes = [0, 1, 2].filter((a) => a !== minAxisIdx);
    const cx = bounds.center[otherAxes[0]];
    const cz = bounds.center[otherAxes[1]];
    const height =
      -(normal[otherAxes[0]] * cx + normal[otherAxes[1]] * cz + d) /
      normal[minAxisIdx];

    // Insert into candidates if better than worst current candidate
    if (
      candidates.length < 3 ||
      inliers > candidates[candidates.length - 1].inliers
    ) {
      // Check this isn't a near-duplicate of an existing candidate
      const isDuplicate = candidates.some(
        (c) => Math.abs(c.height - height) < distanceThreshold * 2,
      );
      if (!isDuplicate) {
        candidates.push({
          normal: [...normal] as Vec3,
          dist: d,
          inliers,
          height,
        });
        candidates.sort((a, b) => b.inliers - a.inliers);
        if (candidates.length > 3) candidates.pop();
      } else {
        // Update existing candidate if this one has more inliers
        const existing = candidates.find(
          (c) => Math.abs(c.height - height) < distanceThreshold * 2,
        );
        if (existing && inliers > existing.inliers) {
          existing.normal = [...normal] as Vec3;
          existing.dist = d;
          existing.inliers = inliers;
          existing.height = height;
        }
      }
    }
  }

  // Score candidates: inlierRatio + preference for lower planes (floors, not ceilings)
  let bestScore = -Infinity;
  let best: FloorCandidate = candidates[0] ?? {
    normal: [0, 0, 0] as Vec3,
    dist: 0,
    inliers: 0,
    height: bounds.min[minAxisIdx],
  };
  best.normal[minAxisIdx] = best.normal[minAxisIdx] || 1;

  for (const c of candidates) {
    const inlierRatio = c.inliers / N;
    // How low is this plane? 1.0 = at bottom, 0.0 = at top
    const lowness =
      verticalRange > 0 ? 1 - (c.height - verticalMin) / verticalRange : 0.5;
    // Score: mostly inlier ratio, with a small bonus for being lower
    const score = inlierRatio + lowness * 0.15;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }

  const inlierRatio = best.inliers / N;
  const confidence = Math.min(1, inlierRatio / 0.5);

  // Fallback: if no good candidates found, estimate floor from bottom percentile
  if (confidence < 0.15) {
    const upValues = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      upValues[i] = positions[sampleIndices[i] * 3 + minAxisIdx];
    }
    upValues.sort();
    const fallbackHeight = upValues[Math.floor(N * 0.1)]; // 10th percentile

    const fallbackNormal: Vec3 = [0, 0, 0];
    fallbackNormal[minAxisIdx] = 1;
    return {
      normal: fallbackNormal,
      distance: -fallbackHeight,
      height: fallbackHeight,
      inlierRatio: 0.1,
      confidence: 0.1,
    };
  }

  return {
    normal: best.normal,
    distance: best.dist,
    height: best.height,
    inlierRatio,
    confidence,
  };
}

// ---------------------------------------------------------------------------
// Boundary detection along principal axis
// ---------------------------------------------------------------------------

export function detectBoundaries(
  positions: Float32Array,
  count: number,
  principalAxis: Vec3,
  mean: Vec3,
): BoundaryInfo {
  const NUM_BINS = 200;

  // Project all points onto the principal axis
  let minProj = Infinity;
  let maxProj = -Infinity;
  const projections = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const dx = positions[i * 3 + 0] - mean[0];
    const dy = positions[i * 3 + 1] - mean[1];
    const dz = positions[i * 3 + 2] - mean[2];
    const proj =
      dx * principalAxis[0] + dy * principalAxis[1] + dz * principalAxis[2];
    projections[i] = proj;
    if (proj < minProj) minProj = proj;
    if (proj > maxProj) maxProj = proj;
  }

  const range = maxProj - minProj;
  if (range < 1e-10) {
    // Degenerate case: all points at the same position along the axis
    return {
      startPoint: [...mean] as Vec3,
      endPoint: [...mean] as Vec3,
      startDensity: count,
      endDensity: count,
      principalLength: 0,
    };
  }

  const binSize = range / NUM_BINS;
  const bins = new Uint32Array(NUM_BINS);

  for (let i = 0; i < count; i++) {
    const bin = Math.min(
      NUM_BINS - 1,
      Math.floor((projections[i] - minProj) / binSize),
    );
    bins[bin]++;
  }

  // Find median density for threshold
  const sorted = [...bins].sort((a, b) => a - b);
  const medianDensity = sorted[Math.floor(NUM_BINS / 2)];
  const threshold = medianDensity * 0.01;

  let startBin = 0;
  for (let i = 0; i < NUM_BINS; i++) {
    if (bins[i] > threshold) {
      startBin = i;
      break;
    }
  }

  let endBin = NUM_BINS - 1;
  for (let i = NUM_BINS - 1; i >= 0; i--) {
    if (bins[i] > threshold) {
      endBin = i;
      break;
    }
  }

  const startProj = minProj + startBin * binSize;
  const endProj = minProj + (endBin + 1) * binSize;

  const startPoint: Vec3 = [
    mean[0] + principalAxis[0] * startProj,
    mean[1] + principalAxis[1] * startProj,
    mean[2] + principalAxis[2] * startProj,
  ];
  const endPoint: Vec3 = [
    mean[0] + principalAxis[0] * endProj,
    mean[1] + principalAxis[1] * endProj,
    mean[2] + principalAxis[2] * endProj,
  ];

  return {
    startPoint,
    endPoint,
    startDensity: bins[startBin],
    endDensity: bins[endBin],
    principalLength: endProj - startProj,
  };
}

// ---------------------------------------------------------------------------
// Walkable corridor analysis
// ---------------------------------------------------------------------------

/**
 * Interpolate a position along path waypoints at parametric t (0-1).
 */
function interpolatePath(waypoints: Vec3[], t: number): Vec3 {
  if (waypoints.length === 0) return [0, 0, 0];
  if (waypoints.length === 1) return [...waypoints[0]] as Vec3;

  const clamped = Math.max(0, Math.min(1, t));
  const totalSegments = waypoints.length - 1;
  const segment = clamped * totalSegments;
  const idx = Math.min(Math.floor(segment), totalSegments - 1);
  const frac = segment - idx;

  const a = waypoints[idx];
  const b = waypoints[idx + 1];
  return [
    a[0] + (b[0] - a[0]) * frac,
    a[1] + (b[1] - a[1]) * frac,
    a[2] + (b[2] - a[2]) * frac,
  ];
}

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor((sorted.length - 1) * p)),
  );
  return sorted[index];
}

/**
 * Compute walkable corridor: sample slices along the camera path,
 * measure width and local floor height at each slice.
 */
export function computeWalkableCorridor(
  positions: Float32Array,
  count: number,
  cameraPath: CameraPath,
  principalAxis: Vec3,
  secondaryAxis: Vec3,
  floor: FloorPlane,
  bounds: AABB,
  options: {
    numSamples?: number;
    heightBand?: number; // vertical band around floor to consider
    sliceThickness?: number; // thickness of each sampling slice along principal axis
  } = {},
): WalkableCorridor {
  const { numSamples = 20, heightBand = 1.0, sliceThickness = 1.5 } = options;
  const padding = 0.5;

  // Detect the up axis (same logic as floor detection)
  const sizeArr = bounds.size;
  const upAxisIdx =
    sizeArr[0] <= sizeArr[1] && sizeArr[0] <= sizeArr[2]
      ? 0
      : sizeArr[1] <= sizeArr[2]
        ? 1
        : 2;

  const samples: CorridorSample[] = [];
  const walkablePoints: Vec3[] = [];

  for (let i = 0; i < numSamples; i++) {
    const t = i / (numSamples - 1);
    const pathPos = interpolatePath(cameraPath.waypoints, t);

    // Project path position onto principal axis (relative to first waypoint)
    const refPt = cameraPath.waypoints[0];
    const pathProjOnPrincipal =
      (pathPos[0] - refPt[0]) * principalAxis[0] +
      (pathPos[1] - refPt[1]) * principalAxis[1] +
      (pathPos[2] - refPt[2]) * principalAxis[2];

    // Collect points within the slice
    let minSecondary = Infinity;
    let maxSecondary = -Infinity;
    const floorHeights: number[] = [];

    for (let j = 0; j < count; j++) {
      const px = positions[j * 3 + 0];
      const py = positions[j * 3 + 1];
      const pz = positions[j * 3 + 2];

      // Project onto principal axis
      const dx = px - refPt[0];
      const dy = py - refPt[1];
      const dz = pz - refPt[2];
      const projPrincipal =
        dx * principalAxis[0] + dy * principalAxis[1] + dz * principalAxis[2];

      // Is this point within the slice?
      if (Math.abs(projPrincipal - pathProjOnPrincipal) > sliceThickness)
        continue;

      // Check if point is within height band of floor
      const pointUpCoord = [px, py, pz][upAxisIdx];
      if (Math.abs(pointUpCoord - floor.height) > heightBand) continue;

      // Project onto secondary axis for width measurement
      const projSecondary =
        dx * secondaryAxis[0] + dy * secondaryAxis[1] + dz * secondaryAxis[2];

      if (projSecondary < minSecondary) minSecondary = projSecondary;
      if (projSecondary > maxSecondary) maxSecondary = projSecondary;

      floorHeights.push(pointUpCoord);
    }

    const width =
      minSecondary < maxSecondary ? maxSecondary - minSecondary : 2.0;
    const localFloorHeight = percentile(floorHeights, 0.2) ?? floor.height;

    samples.push({
      t,
      center: [...pathPos] as Vec3,
      width,
      floorHeight: localFloorHeight,
    });

    const halfWidth = width / 2 + padding;
    walkablePoints.push(
      [pathPos[0], localFloorHeight, pathPos[2]],
      [
        pathPos[0] - secondaryAxis[0] * halfWidth,
        localFloorHeight,
        pathPos[2] - secondaryAxis[2] * halfWidth,
      ],
      [
        pathPos[0] + secondaryAxis[0] * halfWidth,
        localFloorHeight,
        pathPos[2] + secondaryAxis[2] * halfWidth,
      ],
    );
  }

  const minBound: Vec3 = [...bounds.min] as Vec3;
  const maxBound: Vec3 = [...bounds.max] as Vec3;

  if (walkablePoints.length > 0) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;

    for (const [x, , z] of walkablePoints) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }

    minBound[0] = Math.max(bounds.min[0] + padding, minX - padding);
    maxBound[0] = Math.min(bounds.max[0] - padding, maxX + padding);
    minBound[2] = Math.max(bounds.min[2] + padding, minZ - padding);
    maxBound[2] = Math.min(bounds.max[2] - padding, maxZ + padding);
  } else {
    minBound[0] += padding;
    maxBound[0] -= padding;
    minBound[2] += padding;
    maxBound[2] -= padding;
  }

  minBound[1] += padding;
  maxBound[1] -= padding;

  return { samples, minBound, maxBound };
}
