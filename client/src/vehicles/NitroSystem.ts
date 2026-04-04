/**
 * LEARNING NOTE: NFS-Style Nitro Boost System
 *
 * A limited boost resource the player can activate on demand (like NFS).
 * - Press Shift/N to activate nitro — gives a big speed boost
 * - Nitro tank drains while held (lasts ~4 seconds at full)
 * - Tank refills from: drifting, drift-boosts, and driving fast
 * - Creates a strategic choice: save nitro for straights vs use early
 *
 * Key concepts: resource management, risk-reward, NFS-style nitro
 */

import { ENGINE } from '@neon-drift/shared';

/** Nitro force multiplier (percentage of MAX_FORCE added as extra thrust) */
const NITRO_FORCE_MULTIPLIER = 0.8;

/** Max tank capacity (seconds of boost) */
const TANK_MAX = 4.0;

/** Drain rate while active (seconds per second) */
const DRAIN_RATE = 1.0;

/** Refill rates (tank seconds per real second) */
const REFILL_DRIFT = 0.6;       // refill while drifting
const REFILL_DRIFT_BOOST = 1.2; // bonus refill when drift-boost fires
const REFILL_SPEED = 0.15;      // slow refill when driving fast (>80 km/h)

export class NitroSystem {
  /** Current tank level (0 to TANK_MAX seconds) */
  tank = TANK_MAX;

  /** Is nitro currently firing? */
  active = false;

  /** Was nitro just activated this frame? (for camera effects) */
  justActivated = false;

  /** Tank percentage (0-1) for HUD */
  get tankPercent(): number {
    return this.tank / TANK_MAX;
  }

  /**
   * Update nitro state.
   * @returns extra engine force to apply (0 if nitro not active)
   */
  update(nitroInput: boolean, isDrifting: boolean, driftBoostJustFired: boolean, speed: number, dt: number): number {
    this.justActivated = false;

    // Refill from various sources
    if (isDrifting) {
      this.tank = Math.min(TANK_MAX, this.tank + REFILL_DRIFT * dt);
    }
    if (driftBoostJustFired) {
      this.tank = Math.min(TANK_MAX, this.tank + REFILL_DRIFT_BOOST);
    }
    if (Math.abs(speed) > 22) { // ~80 km/h
      this.tank = Math.min(TANK_MAX, this.tank + REFILL_SPEED * dt);
    }

    // Activate/deactivate
    const wantsNitro = nitroInput && this.tank > 0.05;

    if (wantsNitro && !this.active) {
      this.active = true;
      this.justActivated = true;
    }

    if (!wantsNitro || this.tank <= 0) {
      this.active = false;
    }

    // Drain tank while active
    if (this.active) {
      this.tank = Math.max(0, this.tank - DRAIN_RATE * dt);
      if (this.tank <= 0) {
        this.active = false;
      }
      return ENGINE.MAX_FORCE * NITRO_FORCE_MULTIPLIER;
    }

    return 0;
  }
}
