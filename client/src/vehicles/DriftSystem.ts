/**
 * LEARNING NOTE: Drift-Boost Mechanic
 *
 * The drift-boost creates a risk-reward loop: drifting is dangerous
 * (you might spin out) but rewards you with a speed boost. Holding
 * the drift longer gives bigger boosts (3 charge levels).
 *
 * Charge times are fast so the system feels responsive and fun.
 * Boost multipliers are strong so you FEEL the speed kick.
 *
 * Key concepts: charge accumulation, boost levels, speed multiplier, risk-reward
 */

import { DRIFT_BOOST, ENGINE } from '@neon-drift/shared';
import type { InputState } from '@neon-drift/shared';

export class DriftSystem {
  chargeTime = 0;
  boostLevel = 0; // 0 = none, 1 = blue, 2 = orange, 3 = purple
  boostActive = false;
  boostTimeRemaining = 0;
  boostMultiplier = 0;
  boostJustActivated = false;

  /** Vehicle-specific drift charge rate multiplier (default 1.0) */
  driftMult = 1.0;

  private wasDrifting = false;

  /**
   * Update drift charge and boost state.
   * @returns extra engine force to apply (0 if no boost)
   */
  update(input: InputState, speed: number, dt: number): number {
    const absSpeed = Math.abs(speed);
    const isDrifting = input.drift && absSpeed > 2;

    // Accumulate drift charge — faster when actually turning (more fun)
    if (isDrifting) {
      // Charge faster when steering (real drifting, not just holding Space straight)
      // driftMult scales charge rate — cars with high drift stat charge faster
      const steerBonus = (input.steerLeft || input.steerRight) ? 1.5 : 0.8;
      this.chargeTime += dt * steerBonus * this.driftMult;

      // Determine charge level
      if (this.chargeTime >= DRIFT_BOOST.LEVEL_3_TIME) {
        this.boostLevel = 3;
      } else if (this.chargeTime >= DRIFT_BOOST.LEVEL_2_TIME) {
        this.boostLevel = 2;
      } else if (this.chargeTime >= DRIFT_BOOST.LEVEL_1_TIME) {
        this.boostLevel = 1;
      } else {
        this.boostLevel = 0;
      }
    }

    // Release boost when drift button released (and we had charge)
    if (this.wasDrifting && !isDrifting && this.boostLevel > 0) {
      this.activateBoost();
    }

    this.wasDrifting = isDrifting;

    // Reset charge if not drifting and no active boost
    if (!isDrifting && !this.boostActive) {
      this.chargeTime = 0;
      this.boostLevel = 0;
    }

    // Apply active boost
    if (this.boostActive) {
      this.boostTimeRemaining -= dt;
      if (this.boostTimeRemaining <= 0) {
        this.boostActive = false;
        this.boostMultiplier = 0;
        this.boostTimeRemaining = 0;
      }
      return ENGINE.MAX_FORCE * this.boostMultiplier;
    }

    return 0;
  }

  private activateBoost(): void {
    this.boostActive = true;
    this.boostJustActivated = true;

    switch (this.boostLevel) {
      case 1:
        this.boostMultiplier = DRIFT_BOOST.LEVEL_1_MULTIPLIER;
        this.boostTimeRemaining = DRIFT_BOOST.LEVEL_1_DURATION;
        break;
      case 2:
        this.boostMultiplier = DRIFT_BOOST.LEVEL_2_MULTIPLIER;
        this.boostTimeRemaining = DRIFT_BOOST.LEVEL_2_DURATION;
        break;
      case 3:
        this.boostMultiplier = DRIFT_BOOST.LEVEL_3_MULTIPLIER;
        this.boostTimeRemaining = DRIFT_BOOST.LEVEL_3_DURATION;
        break;
    }

    // Reset charge
    this.chargeTime = 0;
    this.boostLevel = 0;
  }

  /** Cancel charge (e.g., when hitting a wall) */
  cancelCharge(): void {
    this.chargeTime = 0;
    this.boostLevel = 0;
  }
}
