import * as THREE from 'three';

const TOUCH_LOOK_ZONE = 0.4; // touches in the RIGHT (1 - 0.4 = 60%) of screen control look

export interface LookConfig {
  yawLimit?: number; // radians, default ±25°
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

  // Mouse drag state (desktop)
  private dragging = false;
  private canvas: HTMLElement | null = null;

  /** Current yaw angle in radians. Exposed for TourCamera movement direction. */
  get yawAngle(): number {
    return this.yaw;
  }

  constructor(config: LookConfig = {}) {
    this.yawLimit = config.yawLimit ?? THREE.MathUtils.degToRad(25);
    this.pitchLimit = config.pitchLimit ?? THREE.MathUtils.degToRad(15);
    this.sensitivity = config.sensitivity ?? 0.002;
    this.springBack = config.springBack ?? true;
    this.springSpeed = config.springSpeed ?? 0.5;
  }

  attach(canvas: HTMLElement) {
    this.canvas = canvas;
    canvas.addEventListener('mousedown', this._onMouseDown);
    canvas.addEventListener('touchstart', this._onTouchStart, {
      passive: false,
    });
    canvas.addEventListener('touchmove', this._onTouchMove, { passive: false });
    canvas.addEventListener('touchend', this._onTouchEnd);
    canvas.addEventListener('touchcancel', this._onTouchEnd);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mouseup', this._onMouseUp);
  }

  detach() {
    if (!this.canvas) return;
    this.canvas.removeEventListener('mousedown', this._onMouseDown);
    this.canvas.removeEventListener('touchstart', this._onTouchStart);
    this.canvas.removeEventListener('touchmove', this._onTouchMove);
    this.canvas.removeEventListener('touchend', this._onTouchEnd);
    this.canvas.removeEventListener('touchcancel', this._onTouchEnd);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('mouseup', this._onMouseUp);
    this.canvas = null;
  }

  recenter() {
    this.yaw = 0;
    this.pitch = 0;
    this._rebuildQuaternion();
  }

  update(delta: number) {
    if (!this.springBack) return;

    const timeSinceInput = performance.now() / 1000 - this.lastInputTime;
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
    this.pitch = THREE.MathUtils.clamp(
      this.pitch,
      -this.pitchLimit,
      this.pitchLimit,
    );

    this.lastInputTime = performance.now() / 1000;
    this._rebuildQuaternion();
  }

  private _rebuildQuaternion() {
    this._qYaw.setFromAxisAngle(this._axisY, this.yaw);
    this._qPitch.setFromAxisAngle(this._axisX, this.pitch);
    this.offsetQuaternion.multiplyQuaternions(this._qYaw, this._qPitch);
  }

  // ── Click-drag (desktop) ──────────────────────────────────────────────────

  private _onMouseDown = (e: MouseEvent) => {
    if (e.button === 0) this.dragging = true;
  };

  private _onMouseUp = () => {
    this.dragging = false;
  };

  private _onMouseMove = (e: MouseEvent) => {
    if (!this.dragging) return;
    this._applyDelta(e.movementX, e.movementY);
  };

  // ── Touch (mobile) — only right side of screen ────────────────────────────

  private _lookTouchId: number | null = null;
  private _lastTouchX = 0;
  private _lastTouchY = 0;

  private _onTouchStart = (e: TouchEvent) => {
    if (this._lookTouchId !== null) return; // already tracking

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      // Only claim touches in the right zone (outside movement zone)
      if (touch.clientX > window.innerWidth * TOUCH_LOOK_ZONE) {
        this._lookTouchId = touch.identifier;
        this._lastTouchX = touch.clientX;
        this._lastTouchY = touch.clientY;
        return;
      }
    }
  };

  private _onTouchMove = (e: TouchEvent) => {
    if (this._lookTouchId === null) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === this._lookTouchId) {
        const dx = touch.clientX - this._lastTouchX;
        const dy = touch.clientY - this._lastTouchY;
        this._lastTouchX = touch.clientX;
        this._lastTouchY = touch.clientY;
        this._applyDelta(dx, dy);
        e.preventDefault();
        return;
      }
    }
  };

  // Handle touch end (reset tracking)
  private _onTouchEnd = (e: TouchEvent) => {
    if (this._lookTouchId === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === this._lookTouchId) {
        this._lookTouchId = null;
        return;
      }
    }
  };
}
