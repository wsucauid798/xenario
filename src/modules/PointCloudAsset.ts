import * as THREE from 'three';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';

export interface PointCloudBounds {
  box: THREE.Box3;
  center: THREE.Vector3;
  size: THREE.Vector3;
  diagonal: number;
}

export interface PointCloudMeta {
  pointCount: number;
  hasColors: boolean;
  scaleFactor: number;
  offset: THREE.Vector3;
}

export interface PointCloudAsset {
  geometry: THREE.BufferGeometry;
  bounds: PointCloudBounds;
  meta: PointCloudMeta;
}

const TARGET_EXTENT = 10; // normalise max axis to this many world units

export async function loadPLY(file: File): Promise<PointCloudAsset> {
  const url = URL.createObjectURL(file);
  try {
    const loader = new PLYLoader();
    const geometry: THREE.BufferGeometry = await new Promise((resolve, reject) => {
      loader.load(url, resolve, undefined, reject);
    });

    // centre and normalise scale
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    const center = new THREE.Vector3();
    box.getCenter(center);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxExtent = Math.max(size.x, size.y, size.z);
    const scaleFactor = TARGET_EXTENT / maxExtent;
    const offset = center.clone();

    geometry.translate(-center.x, -center.y, -center.z);
    geometry.scale(scaleFactor, scaleFactor, scaleFactor);
    geometry.computeBoundingBox();

    const normBox = geometry.boundingBox!;
    const normSize = new THREE.Vector3();
    normBox.getSize(normSize);
    const normCenter = new THREE.Vector3();
    normBox.getCenter(normCenter);

    const bounds: PointCloudBounds = {
      box: normBox,
      center: normCenter,
      size: normSize,
      diagonal: normSize.length(),
    };

    const hasColors = geometry.hasAttribute('color');
    const pointCount = geometry.attributes.position.count;

    const meta: PointCloudMeta = {
      pointCount,
      hasColors,
      scaleFactor,
      offset,
    };

    return { geometry, bounds, meta };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Return a new geometry keeping every nth point.
 * Original geometry is not modified.
 */
export function downsample(geometry: THREE.BufferGeometry, n: number): THREE.BufferGeometry {
  if (n <= 1) return geometry;

  const positions = geometry.attributes.position;
  const colors = geometry.attributes.color;
  const count = Math.ceil(positions.count / n);

  const posArray = new Float32Array(count * 3);
  const colArray = colors ? new Float32Array(count * 3) : null;

  for (let i = 0, j = 0; i < positions.count; i += n, j++) {
    posArray[j * 3 + 0] = positions.getX(i);
    posArray[j * 3 + 1] = positions.getY(i);
    posArray[j * 3 + 2] = positions.getZ(i);
    if (colors && colArray) {
      colArray[j * 3 + 0] = colors.getX(i);
      colArray[j * 3 + 1] = colors.getY(i);
      colArray[j * 3 + 2] = colors.getZ(i);
    }
  }

  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
  if (colArray) out.setAttribute('color', new THREE.BufferAttribute(colArray, 3));
  out.computeBoundingBox();
  return out;
}

/**
 * Suggest a downsample factor based on point count and a target max.
 */
export function suggestDownsampleFactor(pointCount: number, targetMax: number): number {
  if (pointCount <= targetMax) return 1;
  return Math.ceil(pointCount / targetMax);
}
