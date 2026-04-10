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

function requireBoundingBox(geometry: THREE.BufferGeometry): THREE.Box3 {
  geometry.computeBoundingBox();

  if (!geometry.boundingBox) {
    throw new Error('Point cloud geometry is missing a bounding box.');
  }

  return geometry.boundingBox;
}

/**
 * Load a PLY from a URL (e.g. /scenes/optimized/scene_1.ply).
 * No centering or scaling — coordinates stay as-is so preprocessed
 * camera paths remain aligned.
 */
export async function loadPLYFromUrl(url: string): Promise<PointCloudAsset> {
  const loader = new PLYLoader();
  const geometry: THREE.BufferGeometry = await new Promise(
    (resolve, reject) => {
      loader.load(url, resolve, undefined, reject);
    },
  );

  const box = requireBoundingBox(geometry);
  const size = new THREE.Vector3();
  box.getSize(size);
  const center = new THREE.Vector3();
  box.getCenter(center);

  const bounds: PointCloudBounds = {
    box,
    center,
    size,
    diagonal: size.length(),
  };

  const hasColors = geometry.hasAttribute('color');
  const pointCount = geometry.attributes.position.count;

  const meta: PointCloudMeta = {
    pointCount,
    hasColors,
    scaleFactor: 1,
    offset: new THREE.Vector3(),
  };

  return { geometry, bounds, meta };
}
