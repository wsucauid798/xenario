import { closeSync, openSync, readSync } from 'node:fs';
import type { PLYFormat, PointCloud } from './types.ts';

interface PLYHeader {
  format: PLYFormat;
  vertexCount: number;
  bytesPerVertex: number;
  colorOffset: number; // byte offset to rgb within a vertex record
  headerBytes: number; // total header size in bytes
}

function parseHeader(fd: number): PLYHeader {
  // Headers are always well under 4KB
  const buf = Buffer.alloc(4096);
  readSync(fd, buf, 0, 4096, 0);
  const text = buf.toString('ascii');

  const endMarker = 'end_header\n';
  const endIdx = text.indexOf(endMarker);
  if (endIdx === -1) throw new Error('Invalid PLY: missing end_header');
  const headerBytes = endIdx + endMarker.length;

  // Must be binary little-endian
  if (!text.includes('format binary_little_endian')) {
    throw new Error('Only binary_little_endian PLY files are supported');
  }

  // Extract vertex count
  const vertexMatch = text.match(/element vertex\s+(\d+)/);
  if (!vertexMatch) throw new Error('Invalid PLY: missing element vertex');
  const vertexCount = parseInt(vertexMatch[1], 10);

  // Detect format by checking for normal properties
  const hasNormals = text.includes('property float nx');
  const hasClassConfidence = text.includes('property uchar class');

  let format: PLYFormat;
  let bytesPerVertex: number;
  let colorOffset: number;

  if (hasNormals && hasClassConfidence) {
    // Scanner format: xyz(12) + normals(12) + rgb(3) + class(1) + confidence(1) = 29
    format = 'scanner';
    bytesPerVertex = 29;
    colorOffset = 24; // after 6 floats
  } else {
    // SiteScape format: xyz(12) + rgb(3) = 15
    format = 'sitescape';
    bytesPerVertex = 15;
    colorOffset = 12; // after 3 floats
  }

  return { format, vertexCount, bytesPerVertex, colorOffset, headerBytes };
}

export function parsePLY(filePath: string): PointCloud & { format: PLYFormat } {
  const fd = openSync(filePath, 'r');
  try {
    const header = parseHeader(fd);
    const { vertexCount, bytesPerVertex, colorOffset, headerBytes } = header;

    const positions = new Float32Array(vertexCount * 3);
    const colors = new Uint8Array(vertexCount * 3);

    // Read in chunks of 1M vertices
    const CHUNK = 1_000_000;
    const chunkBuf = Buffer.alloc(CHUNK * bytesPerVertex);
    let fileOffset = headerBytes;
    let vertexIdx = 0;

    while (vertexIdx < vertexCount) {
      const batch = Math.min(vertexCount - vertexIdx, CHUNK);
      const bytesToRead = batch * bytesPerVertex;
      readSync(fd, chunkBuf, 0, bytesToRead, fileOffset);

      for (let i = 0; i < batch; i++) {
        const base = i * bytesPerVertex;
        const vi = vertexIdx + i;

        // xyz — always the first 12 bytes
        positions[vi * 3 + 0] = chunkBuf.readFloatLE(base + 0);
        positions[vi * 3 + 1] = chunkBuf.readFloatLE(base + 4);
        positions[vi * 3 + 2] = chunkBuf.readFloatLE(base + 8);

        // rgb — at colorOffset within the vertex record
        colors[vi * 3 + 0] = chunkBuf[base + colorOffset + 0];
        colors[vi * 3 + 1] = chunkBuf[base + colorOffset + 1];
        colors[vi * 3 + 2] = chunkBuf[base + colorOffset + 2];
      }

      vertexIdx += batch;
      fileOffset += bytesToRead;
    }

    return { positions, colors, count: vertexCount, format: header.format };
  } finally {
    closeSync(fd);
  }
}

/** Quick header-only parse to get vertex count without reading data */
export function readVertexCount(filePath: string): number {
  const fd = openSync(filePath, 'r');
  try {
    return parseHeader(fd).vertexCount;
  } finally {
    closeSync(fd);
  }
}
