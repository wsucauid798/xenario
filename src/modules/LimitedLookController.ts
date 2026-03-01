import * as THREE from 'three';

export interface LookConfig {
  yawLimit?: number;   // radians, default ±25°
  pitchLimit?: number; // radians, default ±15°
  sensitivity?: number;
  springBack?: boolean;
  springSpeed?: number; // lerp speed per second when returning to centre
}

export class LimitedLookController {
  private yaw = 0;
  private pitch = 0;

  private yawLimit: number;
  private pitchLimit: number;
  private sensitivity: number;
  private springBack: boolean;
  private springSpeed: number;

  private lastInputTime = 0;
  private readonly springDelay = 0.5; // seconds before spring kicks in

  readonly offsetQuaternion = new THREE.Quaternion();

  private _qYaw = new THREE.Quaternion();
  private _qPitch = new THREE.Quaternion();
  private _axisY = new THREE.Vector3(0, 1, 0);
  private _axisX = new THREE.Vector3(1, 0, 0);

  // Pointer lock state
  private pointerLocked = false;
  private canvas: HTMLElement | null = null;

  constructor(config: LookConfig = {}) {
    this.yawLimit = config.yawLimit ?? THREE.MathUtils.degToRad(25);
    this.pitchLimit = config.pitchLimit ?? THREE.MathUtils.degToRad(15);
    this.sensitivity = config.sensitivity ?? 0.002;
    this.springBack = config.springBack ?? true;
    this.springSpeed = config.springSpeed ?? 2.0;
  }

  attach(canvas: HTMLElement) {
    this.canvas = canvas;
    canvas.addEventListener('click', this._onCanvasClick);
    canvas.addEventListener('touchstart', this._onTouchStart, { passive: true });
    canvas.addEventListener('touchmove', this._onTouchMove, { passive: true });
    document.addEventListener('pointerlockchange', this._onPointerLockChange);
    document.addEventListener('mousemove', this._onMouseMove);
  }

  detach() {
    if (!this.canvas) return;
    this.canvas.removeEventListener('click', this._onCanvasClick);
    this.canvas.removeEventListener('touchstart', this._onTouchStart);
    this.canvas.removeEventListener('touchmove', this._onTouchMove);
    document.removeEventListener('pointerlockchange', this._onPointerLockChange);
    document.removeEventListener('mousemove', this._onMouseMove);
    this.canvas = null;
  }

  recenter() {
    this.yaw = 0;
    this.pitch = 0;
    this._rebuildQuaternion();
  }

  update(delta: number) {
    if (!this.springBack) return;

    const timeSinceInput = (performance.now() / 1000) - this.lastInputTime;
    if (timeSinceInput < this.springDelay) return;

    const speed = this.springSpeed * delta;
    this.yaw = THREE.MathUtils.lerp(this.yaw, 0, Math.min(1, speed));
    this.pitch = THREE.MathUtils.lerp(this.pitch, 0, Math.min(1, speed));

    if (Math.abs(this.yaw) < 0.0001) this.yaw = 0;
    if (Math.abs(this.pitch) < 0.0001) this.pitch = 0;

    this._rebuildQuaternion();
  }

  private _applyDelta(dx: number, dy: number) {
    this.yaw -= dx * this.sensitivity;
    this.pitch -= dy * this.sensitivity;

    this.yaw = THREE.MathUtils.clamp(this.yaw, -this.yawLimit, this.yawLimit);
    this.pitch = THREE.MathUtils.clamp(this.pitch, -this.pitchLimit, this.pitchLimit);

    this.lastInputTime = performance.now() / 1000;
    this._rebuildQuaternion();
  }

  private _rebuildQuaternion() {
    this._qYaw.setFromAxisAngle(this._axisY, this.yaw);
    this._qPitch.setFromAxisAngle(this._axisX, this.pitch);
    this.offsetQuaternion.multiplyQuaternions(this._qYaw, this._qPitch);
  }

  // ── Pointer lock (desktop) ────────────────────────────────────────────────

  private _onCanvasClick = () => {
    if (!this.pointerLocked && this.canvas) {
      this.canvas.requestPointerLock();
    }
  };

  private _onPointerLockChange = () => {
    this.pointerLocked = document.pointerLockElement === this.canvas;
  };

  private _onMouseMove = (e: MouseEvent) => {
    if (!this.pointerLocked) return;
    this._applyDelta(e.movementX, e.movementY);
  };

  // ── Touch (mobile) ────────────────────────────────────────────────────────

  private _lastTouchX = 0;
  private _lastTouchY = 0;

  private _onTouchStart = (e: TouchEvent) => {
    this._lastTouchX = e.touches[0].clientX;
    this._lastTouchY = e.touches[0].clientY;
  };

  private _onTouchMove = (e: TouchEvent) => {
    const dx = e.touches[0].clientX - this._lastTouchX;
    const dy = e.touches[0].clientY - this._lastTouchY;
    this._lastTouchX = e.touches[0].clientX;
    this._lastTouchY = e.touches[0].clientY;
    this._applyDelta(dx, dy);
  };
}
