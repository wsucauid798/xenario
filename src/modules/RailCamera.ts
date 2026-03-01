import * as THREE from 'three';
import type { PointCloudBounds } from './PointCloudAsset';

export interface PathConfig {
  duration: number;
  waypoints: { x: number; y: number; z: number }[];
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Generate a gentle S-curve sweep through the scene bounds.
 * Works for outdoor or indoor scenes as a sensible default.
 */
export function generateAutoPath(bounds: PointCloudBounds): PathConfig {
  const { box, size } = bounds;

  // Walk at ~15% height from the bottom of the cloud
  const walkY = box.min.y + size.y * 0.15;

  // Sweep along the longest horizontal axis
  const useZ = size.z > size.x;
  const primary = useZ ? 'z' : 'x';

  const pMin = useZ ? box.min.z : box.min.x;
  const pMax = useZ ? box.max.z : box.max.x;
  const sMin = useZ ? box.min.x : box.min.z;
  const sMax = useZ ? box.max.x : box.max.z;
  const sCenter = (sMin + sMax) / 2;
  const sRange = (sMax - sMin) * 0.25; // S-curve offset

  const steps = 5;
  const waypoints: { x: number; y: number; z: number }[] = [];

  for (let i = 0; i < steps; i++) {
    const pFrac = i / (steps - 1);
    const p = pMin + (pMax - pMin) * pFrac;
    // Gentle S-curve offset on the secondary axis
    const sOffset = Math.sin(pFrac * Math.PI) * sRange;
    const s = sCenter + sOffset * (i % 2 === 0 ? 1 : -1);

    const pt = { x: 0, y: walkY, z: 0 };
    if (primary === 'z') { pt.z = p; pt.x = s; }
    else { pt.x = p; pt.z = s; }
    waypoints.push(pt);
  }

  return { duration: 60, waypoints };
}

export class RailCamera {
  private curve: THREE.CatmullRomCurve3;
  private _t: number = 0;
  private _playing: boolean = false;
  readonly duration: number;

  readonly position = new THREE.Vector3();
  readonly baseQuaternion = new THREE.Quaternion();

  private _up = new THREE.Vector3(0, 1, 0);
  private _lookTarget = new THREE.Vector3();
  private _mat = new THREE.Matrix4();

  constructor(config: PathConfig) {
    this.duration = config.duration;
    const points = config.waypoints.map(w => new THREE.Vector3(w.x, w.y, w.z));
    this.curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5);
    this._updateState();
  }

  get t() { return this._t; }
  get playing() { return this._playing; }

  play() { this._playing = true; }
  pause() { this._playing = false; }

  reset() {
    this._t = 0;
    this._updateState();
  }

  seek(t: number) {
    this._t = Math.max(0, Math.min(1, t));
    this._updateState();
  }

  /**
   * Advance the camera along the path.
   * @param delta seconds since last frame
   * @param speedMultiplier playback speed (1 = normal)
   */
  advance(delta: number, speedMultiplier = 1.0) {
    if (!this._playing) return;

    const dt = (delta * speedMultiplier) / this.duration;
    this._t = Math.min(1, this._t + dt);

    if (this._t >= 1) {
      this._t = 1;
      this._playing = false;
    }

    this._updateState();
  }

  private _updateState() {
    // Ease in/out: remap t through smoothstep
    const easedT = smoothstep(0, 1, this._t);
    this.curve.getPoint(easedT, this.position);

    // Look toward next point on curve, with slight look-ahead
    const lookT = Math.min(1, easedT + 0.01);
    this.curve.getPoint(lookT, this._lookTarget);

    // Build a look-at quaternion
    this._mat.lookAt(this.position, this._lookTarget, this._up);
    this.baseQuaternion.setFromRotationMatrix(this._mat);
  }
}
