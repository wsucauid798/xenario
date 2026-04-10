import * as THREE from 'three';
import type { InputState } from './InputManager';

/** Configuration for the tour camera, derived from scene metadata. */
export interface TourCameraConfig {
  /** Guide path waypoints (from cameraPath in meta) */
  guidePath: THREE.Vector3[];
  /** Intended duration of the scene traversal in seconds */
  pathDuration: number;
  /** Floor height samples for terrain following */
  heightSamples: { t: number; height: number }[];
  /** Default floor height as fallback */
  baseFloorHeight: number;
  /** Detected floor plane normal */
  floorNormal: THREE.Vector3;
  /** Detected floor plane distance from origin */
  floorDistance: number;
  /** Confidence in the detected floor plane */
  floorConfidence: number;
  /** Eye level above floor (meters) */
  eyeHeight: number;
  /** Manual move speed in m/s */
  moveSpeed: number;
  /** Walkable area bounds (min) */
  walkableMin: THREE.Vector3;
  /** Walkable area bounds (max) */
  walkableMax: THREE.Vector3;
}

const DEFAULT_EYE_HEIGHT = 1.6;
const DEFAULT_PATH_DURATION = 10;
const DEFAULT_DRIFT_SPEED = 0.4;
const DEFAULT_MOVE_SPEED = 0.7;
const Y_LERP_SPEED = 5;
const MIN_FLOOR_CONFIDENCE_FOR_PLANE = 0.35;
const MAX_SAMPLE_PLANE_DELTA = 0.85;
const MAX_HEIGHT_SAMPLE_DEVIATION = 1;
const OFFSET_DECAY_SPEED = 1.2; // how fast the user offset blends back to zero (per second)

export class TourCamera {
  readonly position = new THREE.Vector3();
  readonly baseQuaternion = new THREE.Quaternion();

  /** Progress along the guide path, 0-1 */
  guideT = 0;

  private spline: THREE.CatmullRomCurve3;
  private splineLength: number;
  private hasUsableSpline: boolean;
  private pathDuration: number;
  private fallbackGuidePoint = new THREE.Vector3();
  private heightSamples: { t: number; height: number }[];
  private baseFloorHeight: number;
  private floorNormal: THREE.Vector3;
  private floorDistance: number;
  private floorConfidence: number;
  private eyeHeight: number;
  private moveSpeed: number;
  private walkableMin: THREE.Vector3;
  private walkableMax: THREE.Vector3;

  /** User offset from the guide path (XZ only). Decays to zero when idle. */
  private offsetX = 0;
  private offsetZ = 0;

  // Reusable temporaries
  private _forward = new THREE.Vector3();
  private _right = new THREE.Vector3();
  private _up = new THREE.Vector3(0, 1, 0);
  private _lookTarget = new THREE.Vector3();
  private _lookMatrix = new THREE.Matrix4();
  private _guidePos = new THREE.Vector3();

  constructor(config: TourCameraConfig) {
    this.spline = new THREE.CatmullRomCurve3([], false, 'catmullrom', 0.5);
    this.splineLength = 0;
    this.hasUsableSpline = false;
    this.pathDuration = DEFAULT_PATH_DURATION;
    this.baseFloorHeight = Number.isFinite(config.baseFloorHeight)
      ? config.baseFloorHeight
      : 0;
    this.floorNormal = config.floorNormal.clone();
    this.floorDistance = Number.isFinite(config.floorDistance)
      ? config.floorDistance
      : -this.baseFloorHeight;
    this.floorConfidence = Number.isFinite(config.floorConfidence)
      ? THREE.MathUtils.clamp(config.floorConfidence, 0, 1)
      : 0;
    this.heightSamples = this.normalizeHeightSamples(config.heightSamples);
    this.eyeHeight = config.eyeHeight ?? DEFAULT_EYE_HEIGHT;
    this.moveSpeed = config.moveSpeed ?? DEFAULT_MOVE_SPEED;
    this.walkableMin = config.walkableMin.clone();
    this.walkableMax = config.walkableMax.clone();

    this.resetPath(config.guidePath, config.pathDuration);
  }

  /** Reconfigure for a new scene (called during scene swap). */
  configure(config: TourCameraConfig): void {
    this.baseFloorHeight = Number.isFinite(config.baseFloorHeight)
      ? config.baseFloorHeight
      : this.baseFloorHeight;
    this.floorNormal.copy(config.floorNormal);
    this.floorDistance = Number.isFinite(config.floorDistance)
      ? config.floorDistance
      : -this.baseFloorHeight;
    this.floorConfidence = Number.isFinite(config.floorConfidence)
      ? THREE.MathUtils.clamp(config.floorConfidence, 0, 1)
      : 0;
    this.heightSamples = this.normalizeHeightSamples(config.heightSamples);
    this.eyeHeight = config.eyeHeight ?? DEFAULT_EYE_HEIGHT;
    this.moveSpeed = config.moveSpeed ?? DEFAULT_MOVE_SPEED;
    this.walkableMin.copy(config.walkableMin);
    this.walkableMax.copy(config.walkableMax);

    this.resetPath(config.guidePath, config.pathDuration);
  }

  private resetPath(guidePath: THREE.Vector3[], pathDuration: number): void {
    const validPoints = guidePath.filter(
      (point) =>
        Number.isFinite(point.x) &&
        Number.isFinite(point.y) &&
        Number.isFinite(point.z),
    );

    this.fallbackGuidePoint.copy(validPoints[0] ?? new THREE.Vector3());
    this.spline = new THREE.CatmullRomCurve3(
      validPoints,
      false,
      'catmullrom',
      0.5,
    );
    this.splineLength = validPoints.length >= 2 ? this.spline.getLength() : 0;
    this.hasUsableSpline =
      validPoints.length >= 2 && Number.isFinite(this.splineLength);
    const fallbackDuration =
      this.splineLength > 0
        ? this.splineLength / DEFAULT_DRIFT_SPEED
        : DEFAULT_PATH_DURATION;
    this.pathDuration =
      Number.isFinite(pathDuration) && pathDuration > 0
        ? pathDuration
        : fallbackDuration;

    this.guideT = 0;
    this.offsetX = 0;
    this.offsetZ = 0;

    this.sampleGuidePoint(0, this.position);
    this.position.y =
      this.computeFloorHeight(0, this.fallbackGuidePoint) + this.eyeHeight;
  }

  private normalizeHeightSamples(
    samples: { t: number; height: number }[],
  ): { t: number; height: number }[] {
    const fallbackHeight = Number.isFinite(this.baseFloorHeight)
      ? this.baseFloorHeight
      : 0;

    return samples
      .filter(
        (sample) => Number.isFinite(sample.t) && Number.isFinite(sample.height),
      )
      .map((sample) => {
        const delta = sample.height - fallbackHeight;
        const height =
          Math.abs(delta) > MAX_HEIGHT_SAMPLE_DEVIATION
            ? fallbackHeight + Math.sign(delta) * MAX_HEIGHT_SAMPLE_DEVIATION
            : sample.height;

        return {
          t: THREE.MathUtils.clamp(sample.t, 0, 1),
          height,
        };
      })
      .sort((a, b) => a.t - b.t);
  }

  private sampleGuidePoint(t: number, target: THREE.Vector3): void {
    if (!this.hasUsableSpline) {
      target.copy(this.fallbackGuidePoint);
      return;
    }

    const clampedT = THREE.MathUtils.clamp(Number.isFinite(t) ? t : 0, 0, 1);

    this.spline.getPointAt(clampedT, target);

    if (
      !Number.isFinite(target.x) ||
      !Number.isFinite(target.y) ||
      !Number.isFinite(target.z)
    ) {
      target.copy(this.fallbackGuidePoint);
    }
  }

  private computePlaneHeight(point: THREE.Vector3): number | null {
    if (
      this.floorConfidence < MIN_FLOOR_CONFIDENCE_FOR_PLANE ||
      Math.abs(this.floorNormal.y) < 0.35 ||
      !Number.isFinite(this.floorNormal.x) ||
      !Number.isFinite(this.floorNormal.y) ||
      !Number.isFinite(this.floorNormal.z) ||
      !Number.isFinite(this.floorDistance)
    ) {
      return null;
    }

    return (
      -(
        this.floorNormal.x * point.x +
        this.floorNormal.z * point.z +
        this.floorDistance
      ) / this.floorNormal.y
    );
  }

  private computeFloorHeight(t: number, guidePoint: THREE.Vector3): number {
    const sampleHeight = this.interpolateHeight(t);
    const planeHeight = this.computePlaneHeight(guidePoint);

    if (planeHeight === null || !Number.isFinite(planeHeight)) {
      return sampleHeight;
    }

    if (Math.abs(sampleHeight - planeHeight) > MAX_SAMPLE_PLANE_DELTA) {
      return planeHeight;
    }

    return sampleHeight * 0.65 + planeHeight * 0.35;
  }

  /**
   * Update camera position for one frame.
   *
   * Model: position = guidePathPosition(guideT) + userOffset
   *
   * The drift ALWAYS advances guideT forward along the spline.
   * User input adds to the offset. On release, the offset smoothly
   * decays back to zero — giving a buttery return to the guided rail.
   */
  update(
    delta: number,
    input: InputState,
    yawAngle: number,
    autoSpeedMultiplier = 1,
    paused = false,
  ): void {
    const safeDelta = Number.isFinite(delta) ? Math.max(0, delta) : 0;
    const speedMultiplier = Number.isFinite(autoSpeedMultiplier)
      ? THREE.MathUtils.clamp(autoSpeedMultiplier, 0, 2)
      : 1;
    const tourDelta = paused ? 0 : safeDelta * speedMultiplier;
    const currentT = THREE.MathUtils.clamp(
      Number.isFinite(this.guideT) ? this.guideT : 0,
      0,
      1,
    );

    this.guideT = currentT;

    // 1. Always advance the guide point forward (drift never stops)
    if (this.guideT < 1 && !paused) {
      const dtPerSecond =
        this.hasUsableSpline && this.pathDuration > 0
          ? 1 / this.pathDuration
          : 0;
      const nextT = this.guideT + dtPerSecond * tourDelta;
      this.guideT = THREE.MathUtils.clamp(
        Number.isFinite(nextT) ? nextT : this.guideT,
        0,
        1,
      );
    }

    // 2. Get the current guide position on the spline
    this.sampleGuidePoint(this.guideT, this._guidePos);

    // 3. Process user input as offset changes
    if (input.isMoving && !paused) {
      this._forward.set(-Math.sin(yawAngle), 0, -Math.cos(yawAngle));
      this._right.set(this._forward.z, 0, -this._forward.x);

      const vx = this._right.x * input.move.x + this._forward.x * input.move.z;
      const vz = this._right.z * input.move.x + this._forward.z * input.move.z;

      // Normalize diagonal movement
      const len = Math.sqrt(vx * vx + vz * vz);
      if (len > 0.001) {
        this.offsetX += (vx / len) * this.moveSpeed * safeDelta;
        this.offsetZ += (vz / len) * this.moveSpeed * safeDelta;
      }
    } else if (!paused) {
      // 4. Smoothly decay offset back to zero (buttery return to rail)
      const decay = Math.min(1, OFFSET_DECAY_SPEED * safeDelta);
      this.offsetX *= 1 - decay;
      this.offsetZ *= 1 - decay;

      // Snap to zero when close enough to avoid endless micro-drift
      if (Math.abs(this.offsetX) < 0.001) this.offsetX = 0;
      if (Math.abs(this.offsetZ) < 0.001) this.offsetZ = 0;
    }

    // 5. Combine: position = guide + offset
    this.position.x = this._guidePos.x + this.offsetX;
    this.position.z = this._guidePos.z + this.offsetZ;

    // 6. Terrain follow: lerp Y toward floor + eye height
    const targetY =
      this.computeFloorHeight(this.guideT, this._guidePos) + this.eyeHeight;
    this.position.y +=
      (targetY - this.position.y) * Math.min(1, Y_LERP_SPEED * safeDelta);

    // 7. Clamp to walkable bounds (and limit offset if it pushes out of bounds)
    this.position.x = Math.max(
      this.walkableMin.x,
      Math.min(this.walkableMax.x, this.position.x),
    );
    this.position.z = Math.max(
      this.walkableMin.z,
      Math.min(this.walkableMax.z, this.position.z),
    );

    // Recalculate effective offset after clamping
    this.offsetX = this.position.x - this._guidePos.x;
    this.offsetZ = this.position.z - this._guidePos.z;

    // 8. Compute base quaternion: look ahead along the spline
    const lookT = Math.min(1, this.guideT + 0.02);
    this.sampleGuidePoint(lookT, this._lookTarget);
    this._lookTarget.y = this.position.y; // keep look direction horizontal

    if (this._lookTarget.distanceToSquared(this.position) > 0.0001) {
      this._lookMatrix.lookAt(this.position, this._lookTarget, this._up);
      this.baseQuaternion.setFromRotationMatrix(this._lookMatrix);
    }
  }

  /** Interpolate floor height from samples at parametric t. */
  private interpolateHeight(t: number): number {
    const samples = this.heightSamples;
    if (samples.length === 0) return this.baseFloorHeight;
    if (samples.length === 1) return samples[0].height;

    const clamped = Math.max(0, Math.min(1, t));

    for (let i = 0; i < samples.length - 1; i++) {
      if (clamped >= samples[i].t && clamped <= samples[i + 1].t) {
        const range = samples[i + 1].t - samples[i].t;
        const frac = range > 0 ? (clamped - samples[i].t) / range : 0;
        return (
          samples[i].height + (samples[i + 1].height - samples[i].height) * frac
        );
      }
    }

    return clamped <= samples[0].t
      ? samples[0].height
      : samples[samples.length - 1].height;
  }
}
