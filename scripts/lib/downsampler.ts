import type { AABB, PointCloud } from './types.ts';

/**
 * Voxel-grid downsample: divide space into a 3D grid, keep one averaged
 * point per occupied voxel. Preserves spatial distribution far better than
 * every-nth-point sampling.
 */
export function voxelDownsample(
  positions: Float32Array,
  colors: Uint8Array,
  count: number,
  targetCount: number,
  bounds: AABB,
): PointCloud {
  const volume = bounds.size[0] * bounds.size[1] * bounds.size[2];
  let voxelSize = Math.cbrt(volume / targetCount);

  // Iteratively refine voxel size to land near the target count
  let result: PointCloud = doVoxelGrid(
    positions,
    colors,
    count,
    voxelSize,
    bounds,
  );

  for (let attempt = 0; attempt < 5; attempt++) {
    const ratio = result.count / targetCount;
    if (ratio >= 0.8 && ratio <= 1.2) break; // within 20% — good enough
    voxelSize *= Math.cbrt(ratio);
    result = doVoxelGrid(positions, colors, count, voxelSize, bounds);
  }

  return result;
}

function doVoxelGrid(
  positions: Float32Array,
  colors: Uint8Array,
  count: number,
  voxelSize: number,
  bounds: AABB,
): PointCloud {
  const nx = Math.ceil(bounds.size[0] / voxelSize) + 1;
  const ny = Math.ceil(bounds.size[1] / voxelSize) + 1;

  // Map<linearVoxelKey, accumulator>
  const voxels = new Map<
    number,
    {
      sx: number;
      sy: number;
      sz: number;
      sr: number;
      sg: number;
      sb: number;
      n: number;
    }
  >();

  for (let i = 0; i < count; i++) {
    const x = positions[i * 3 + 0];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];

    const ix = Math.floor((x - bounds.min[0]) / voxelSize);
    const iy = Math.floor((y - bounds.min[1]) / voxelSize);
    const iz = Math.floor((z - bounds.min[2]) / voxelSize);
    const key = ix + iy * nx + iz * nx * ny;

    let v = voxels.get(key);
    if (!v) {
      v = { sx: 0, sy: 0, sz: 0, sr: 0, sg: 0, sb: 0, n: 0 };
      voxels.set(key, v);
    }

    v.sx += x;
    v.sy += y;
    v.sz += z;
    v.sr += colors[i * 3 + 0];
    v.sg += colors[i * 3 + 1];
    v.sb += colors[i * 3 + 2];
    v.n++;
  }

  const outCount = voxels.size;
  const outPos = new Float32Array(outCount * 3);
  const outCol = new Uint8Array(outCount * 3);

  let j = 0;
  for (const v of voxels.values()) {
    outPos[j * 3 + 0] = v.sx / v.n;
    outPos[j * 3 + 1] = v.sy / v.n;
    outPos[j * 3 + 2] = v.sz / v.n;
    outCol[j * 3 + 0] = Math.round(v.sr / v.n);
    outCol[j * 3 + 1] = Math.round(v.sg / v.n);
    outCol[j * 3 + 2] = Math.round(v.sb / v.n);
    j++;
  }

  return { positions: outPos, colors: outCol, count: outCount };
}
