import { writeFileSync } from 'node:fs';

/**
 * Write a point cloud as a binary little-endian PLY file (SiteScape format).
 * 15 bytes per vertex: xyz (3 x float32) + rgb (3 x uint8).
 */
export function writePLY(
  filePath: string,
  positions: Float32Array,
  colors: Uint8Array,
  count: number,
): void {
  const header =
    'ply\n' +
    'format binary_little_endian 1.0\n' +
    `element vertex ${count}\n` +
    'property float x\n' +
    'property float y\n' +
    'property float z\n' +
    'property uchar red\n' +
    'property uchar green\n' +
    'property uchar blue\n' +
    'end_header\n';

  const headerBuf = Buffer.from(header, 'ascii');
  const dataBuf = Buffer.alloc(count * 15);

  for (let i = 0; i < count; i++) {
    const offset = i * 15;
    dataBuf.writeFloatLE(positions[i * 3 + 0], offset + 0);
    dataBuf.writeFloatLE(positions[i * 3 + 1], offset + 4);
    dataBuf.writeFloatLE(positions[i * 3 + 2], offset + 8);
    dataBuf[offset + 12] = colors[i * 3 + 0];
    dataBuf[offset + 13] = colors[i * 3 + 1];
    dataBuf[offset + 14] = colors[i * 3 + 2];
  }

  writeFileSync(filePath, Buffer.concat([headerBuf, dataBuf]));
}
