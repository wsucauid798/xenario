/**
 * SceneTransition — fog-based fade state machine for seamless scene changes.
 *
 * States: idle → fog_closing → fog_hold → fog_opening → idle
 *
 * During fog_closing, fogNear/fogFar shrink to 0 (everything becomes fog color).
 * During fog_hold, screen is fully fogged — wait for next scene to be loaded.
 * During fog_opening, fogNear/fogFar expand back to the new scene's defaults.
 */

export type TransitionPhase =
  | 'idle'
  | 'fog_closing'
  | 'fog_hold'
  | 'fog_opening';

const CLOSE_DURATION = 1.5; // seconds to fade out
const OPEN_DURATION = 1.5; // seconds to fade in

export class SceneTransition {
  phase: TransitionPhase = 'idle';

  /** 0 = clear, 1 = fully fogged */
  fogDensity = 0;

  private timer = 0;
  private triggered = false;

  /** Start closing fog (begin scene transition). */
  beginClose(): void {
    if (this.phase !== 'idle') return;
    this.phase = 'fog_closing';
    this.timer = 0;
    this.fogDensity = 0;
  }

  /** Start opening fog (after scene swap is complete). */
  beginOpen(): void {
    this.phase = 'fog_opening';
    this.timer = 0;
    this.fogDensity = 1;
  }

  /** Returns true when fog is fully closed and scene swap can happen. */
  isFullyClosed(): boolean {
    return this.phase === 'fog_hold';
  }

  /** Whether the transition was triggered (prevents re-triggering). */
  get isTriggered(): boolean {
    return this.triggered;
  }

  /** Reset for new scene. */
  reset(): void {
    this.phase = 'idle';
    this.fogDensity = 0;
    this.timer = 0;
    this.triggered = false;
  }

  /**
   * Check if transition should begin based on camera progress.
   * Call this each frame from the render loop.
   */
  checkTrigger(guideT: number, threshold = 0.92): void {
    if (this.triggered || this.phase !== 'idle') return;
    if (guideT >= threshold) {
      this.triggered = true;
      this.beginClose();
    }
  }

  /** Advance the transition animation. Call each frame. */
  update(delta: number): void {
    switch (this.phase) {
      case 'fog_closing':
        this.timer += delta;
        this.fogDensity = Math.min(1, this.timer / CLOSE_DURATION);
        if (this.fogDensity >= 1) {
          this.phase = 'fog_hold';
          this.fogDensity = 1;
        }
        break;

      case 'fog_opening':
        this.timer += delta;
        this.fogDensity = Math.max(0, 1 - this.timer / OPEN_DURATION);
        if (this.fogDensity <= 0) {
          this.phase = 'idle';
          this.fogDensity = 0;
          this.triggered = false;
        }
        break;

      // fog_hold and idle: no animation
    }
  }

  /**
   * Compute effective fogNear from the base value and current fog density.
   * At fogDensity=0: returns baseFogNear (normal visibility).
   * At fogDensity=1: returns 0 (everything fogged).
   */
  computeFogNear(baseFogNear: number): number {
    return baseFogNear * (1 - this.fogDensity);
  }

  /**
   * Compute effective fogFar from the base value and current fog density.
   * At fogDensity=0: returns baseFogFar (normal visibility).
   * At fogDensity=1: returns a very small value (everything fogged).
   */
  computeFogFar(baseFogFar: number): number {
    return Math.max(0.01, baseFogFar * (1 - this.fogDensity));
  }
}
