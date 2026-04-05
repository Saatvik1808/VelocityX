/**
 * LEARNING NOTE: Adaptive Difficulty — Keeping Races Fun for Everyone
 *
 * The best racing games feel challenging but never unfair. This is achieved
 * by dynamically adjusting AI difficulty based on the player's skill.
 *
 * We use two techniques:
 * 1. **Baseline calibration**: Set AI parameters based on overall skill profile
 * 2. **Rubber-banding**: During a race, AI ahead of player slows slightly,
 *    AI behind speeds up. This keeps races close without feeling artificial.
 *
 * Mario Kart does aggressive rubber-banding (blue shells). We do subtle
 * parameter adjustments that are invisible to the player.
 *
 * Key concepts: adaptive difficulty, rubber-banding, flow state, lerp
 */

import type { DifficultyParams } from '../AIDriver.js';
import type { PlayerSkillProfiler, SkillProfile } from './PlayerSkillProfiler.js';

export interface RaceDifficultyState {
  /** Player's current race position (1 = first) */
  playerPosition: number;
  /** Total racers */
  totalRacers: number;
  /** Player's progress fraction (0-1 through the race) */
  playerProgress: number;
  /** AI opponent's progress fraction (0-1) */
  aiProgress: number;
  /** Seconds since race started */
  raceTime: number;
}

/**
 * Creates DifficultyParams for an AI opponent based on player skill.
 *
 * @param skill Player skill level (0 = beginner, 1 = expert)
 * @param aiIndex Which AI opponent (0-7), used to spread difficulty
 * @param totalAI Total number of AI opponents
 */
export function createBaseDifficulty(
  skill: number,
  aiIndex: number,
  totalAI: number,
): DifficultyParams {
  // Spread AI difficulty around the player's skill level
  // One AI is slightly better, one is at player level, rest are slightly worse
  const spread = totalAI > 1
    ? (aiIndex / (totalAI - 1)) * 0.4 - 0.2  // range: -0.2 to +0.2
    : 0;
  const adjustedSkill = clamp(skill + spread, 0, 1);

  return {
    // Higher skill = less reaction delay (0-6 frames)
    reactionDelay: Math.round(lerp(6, 0, adjustedSkill)),

    // Higher skill = less steering noise
    steeringNoise: lerp(0.15, 0, adjustedSkill),

    // Higher skill = faster AI (0.85x to 1.05x)
    topSpeedMultiplier: lerp(0.85, 1.05, adjustedSkill),

    // Higher skill = more drift attempts
    driftProbability: lerp(0.3, 0.95, adjustedSkill),

    // Higher skill = fewer mistakes
    mistakeRate: lerp(0.10, 0.005, adjustedSkill),
  };
}

/**
 * Apply rubber-banding adjustment during a race.
 * Returns a speed multiplier (0.9 - 1.1) to apply to the AI.
 */
export function getRubberBandMultiplier(
  state: RaceDifficultyState,
  playerSkill: number,
): number {
  const progressDiff = state.aiProgress - state.playerProgress;

  // Rubber-banding intensity scales inversely with skill
  // Experts get less rubber-banding (they can handle unfair races)
  const intensity = lerp(0.15, 0.03, playerSkill);

  if (progressDiff > 0.05) {
    // AI is ahead of player → slow AI down
    return 1.0 - intensity * clamp(progressDiff * 5, 0, 1);
  } else if (progressDiff < -0.05) {
    // AI is behind player → speed AI up (less aggressively)
    return 1.0 + intensity * 0.5 * clamp(-progressDiff * 5, 0, 1);
  }

  return 1.0; // close race, no adjustment
}

/**
 * Compute a "fun factor" estimate for the current race.
 * Used by the physics evolver to evaluate if tuning produces enjoyable races.
 * Range: 0 (boring) to 1 (exciting).
 */
export function estimateFunFactor(state: {
  positionChanges: number;        // how many times positions swapped
  closeCalls: number;             // near-misses with walls or other cars
  driftBoostsFired: number;
  avgPositionSpread: number;      // avg gap between first and last (in progress)
  playerFinished: boolean;
}): number {
  // Close races are fun
  const closenessScore = clamp(1 - state.avgPositionSpread * 10, 0, 1);

  // Position changes are fun (lead swaps)
  const dramaScore = clamp(state.positionChanges / 10, 0, 1);

  // Using game mechanics is fun
  const mechanicScore = clamp(state.driftBoostsFired / 20, 0, 1);

  // Near-misses are exciting
  const thrillScore = clamp(state.closeCalls / 15, 0, 1);

  // Finishing is satisfying
  const completionScore = state.playerFinished ? 1 : 0.3;

  return (
    closenessScore * 0.30 +
    dramaScore * 0.20 +
    mechanicScore * 0.15 +
    thrillScore * 0.15 +
    completionScore * 0.20
  );
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
