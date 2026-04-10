import { parsePLY, readVertexCount } from './plyParser.ts';
import type { PLYFormat, PointCloud } from './types.ts';

/**
 * Parse multiple PLY files and merge them into a single point cloud.
 * Files are loaded one at a time and copied into pre-allocated arrays
 * to keep peak memory usage manageable.
 */
export function compositeScene(
  files: string[],
  _format: PLYFormat,
): PointCloud {
  // First pass: get total count from headers only
  const counts = files.map((f) => readVertexCount(f));
  const totalCount = counts.reduce((a, b) => a + b, 0);

  // Pre-allocate output
  const positions = new Float32Array(totalCount * 3);
  const colors = new Uint8Array(totalCount * 3);

  // Second pass: parse each file and copy into output arrays
  let offset = 0;
  for (const file of files) {
    const parsed = parsePLY(file);
    positions.set(parsed.positions, offset * 3);
    colors.set(parsed.colors, offset * 3);
    offset += parsed.count;
    // parsed arrays become eligible for GC immediately
  }

  return { positions, colors, count: totalCount };
}
