/**
 * InputManager — keyboard (WASD / arrows) + split-zone touch input.
 * Pure imperative class, no React dependency.
 *
 * Desktop: WASD or arrow keys for movement.
 * Mobile: left 40% of screen is an invisible virtual joystick for movement.
 * (Right 60% is handled by LimitedLookController for look.)
 */

export interface InputState {
  /** Normalized movement: x = strafe (right+), z = forward/back (forward+). Each in [-1, 1]. */
  move: { x: number; z: number };
  /** Whether any movement input is active right now */
  isMoving: boolean;
}

const TOUCH_ZONE_RATIO = 0.4; // left 40% of screen for movement

export class InputManager {
  private keys = new Set<string>();
  private touchOrigin: { x: number; y: number; id: number } | null = null;
  private touchDelta = { x: 0, z: 0 };
  private element: HTMLElement | null = null;

  // Bound handlers for cleanup
  private _onKeyDown = (e: KeyboardEvent) => this.onKeyDown(e);
  private _onKeyUp = (e: KeyboardEvent) => this.onKeyUp(e);
  private _onTouchStart = (e: TouchEvent) => this.onTouchStart(e);
  private _onTouchMove = (e: TouchEvent) => this.onTouchMove(e);
  private _onTouchEnd = (e: TouchEvent) => this.onTouchEnd(e);

  attach(element: HTMLElement): void {
    this.element = element;
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    element.addEventListener('touchstart', this._onTouchStart, {
      passive: false,
    });
    element.addEventListener('touchmove', this._onTouchMove, {
      passive: false,
    });
    element.addEventListener('touchend', this._onTouchEnd);
    element.addEventListener('touchcancel', this._onTouchEnd);
  }

  detach(): void {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    if (this.element) {
      this.element.removeEventListener('touchstart', this._onTouchStart);
      this.element.removeEventListener('touchmove', this._onTouchMove);
      this.element.removeEventListener('touchend', this._onTouchEnd);
      this.element.removeEventListener('touchcancel', this._onTouchEnd);
    }
    this.keys.clear();
    this.touchOrigin = null;
    this.touchDelta = { x: 0, z: 0 };
    this.element = null;
  }

  getState(): InputState {
    let mx = 0;
    let mz = 0;

    // Keyboard input
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) mz += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) mz -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) mx += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) mx -= 1;

    // Touch input (additive)
    mx += this.touchDelta.x;
    mz += this.touchDelta.z;

    // Clamp
    mx = Math.max(-1, Math.min(1, mx));
    mz = Math.max(-1, Math.min(1, mz));

    const isMoving = Math.abs(mx) > 0.05 || Math.abs(mz) > 0.05;

    return { move: { x: mx, z: mz }, isMoving };
  }

  private onKeyDown(e: KeyboardEvent): void {
    // Don't capture input when focused on form elements
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement
    )
      return;
    if (
      [
        'KeyW',
        'KeyA',
        'KeyS',
        'KeyD',
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
      ].includes(e.code)
    ) {
      e.preventDefault();
      this.keys.add(e.code);
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    this.keys.delete(e.code);
  }

  private onTouchStart(e: TouchEvent): void {
    if (this.touchOrigin) return; // already tracking a movement touch

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      // Only claim touches in the left zone
      if (touch.clientX < window.innerWidth * TOUCH_ZONE_RATIO) {
        this.touchOrigin = {
          x: touch.clientX,
          y: touch.clientY,
          id: touch.identifier,
        };
        this.touchDelta = { x: 0, z: 0 };
        e.preventDefault(); // prevent scroll
        return;
      }
    }
  }

  private onTouchMove(e: TouchEvent): void {
    if (!this.touchOrigin) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === this.touchOrigin.id) {
        const dx = touch.clientX - this.touchOrigin.x;
        const dy = touch.clientY - this.touchOrigin.y;
        // Normalize to [-1, 1] with a 60px dead zone radius
        const maxDrag = 80;
        this.touchDelta = {
          x: Math.max(-1, Math.min(1, dx / maxDrag)),
          z: Math.max(-1, Math.min(1, -dy / maxDrag)), // up = forward
        };
        e.preventDefault();
        return;
      }
    }
  }

  private onTouchEnd(e: TouchEvent): void {
    if (!this.touchOrigin) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === this.touchOrigin.id) {
        this.touchOrigin = null;
        this.touchDelta = { x: 0, z: 0 };
        return;
      }
    }
  }
}
