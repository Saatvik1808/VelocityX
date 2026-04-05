/**
 * LEARNING NOTE: Fitness Function — What Makes a "Good" AI Driver?
 *
 * The fitness function is THE most important part of evolutionary AI.
 * It defines what "success" means. A bad fitness function produces
 * degenerate behavior (e.g., the AI learns to spin in circles because
 * that maximizes "distance traveled" without ever reaching checkpoints).
 *
 * Our fitness is dominated by CHECKPOINT PROGRESS (the primary signal),
 * with secondary rewards for speed, drift-boosts, and penalties for
 * wall collisions and getting stuck. The hierarchy ensures the AI first
 * learns to follow the track, then learns to go fast, then learns tricks.
 *
 * Key concepts: reward shaping, fitness hierarchy, degenerate behavior prevention
 */

export interface RacingMetrics {
  /** Number of checkpoints passed (most important signal) */
  checkpointsReached: number;
  /** Distance along the track centerline (provides gradient before first checkpoint) */
  centerlineProgress: number;
  /** Average forward speed in m/s */
  averageSpeed: number;
  /** Peak speed achieved in m/s */
  maxSpeed: number;
  /** Number of drift-boosts successfully fired */
  driftBoostsFired: number;
  /** Seconds of nitro used */
  nitroSecondsUsed: number;
  /** Number of wall collisions (speed drops > threshold) */
  wallCollisions: number;
  /** Frames spent with speed < 1 m/s */
  framesStuck: number;
  /** Total frames evaluated */
  totalFrames: number;
  /** Frames spent spinning (angular velocity > threshold) */
  framesSpinning: number;
  /** Did the AI complete all laps? */
  finished: boolean;
  /** Total race time in seconds (only meaningful if finished) */
  raceTime: number;
  /** Laps completed */
  lapsCompleted: number;
}

export interface FitnessWeights {
  checkpoint: number;
  centerlineProgress: number;
  averageSpeed: number;
  driftBoosts: number;
  nitroEfficiency: number;
  wallCollisionPenalty: number;
  stuckPenalty: number;
  spinPenalty: number;
  completionBonus: number;
  timeBonus: number;
}

export const DEFAULT_FITNESS_WEIGHTS: FitnessWeights = {
  checkpoint: 1000,          // dominant signal: reach checkpoints
  centerlineProgress: 2.0,   // gradient toward first checkpoint
  averageSpeed: 10.0,        // faster is better
  driftBoosts: 200,          // reward skillful drifting
  nitroEfficiency: 50,       // reward using nitro wisely
  wallCollisionPenalty: 500,  // wall hits are very bad
  stuckPenalty: 0.5,         // per frame penalty
  spinPenalty: 0.3,          // per frame penalty
  completionBonus: 50000,    // massive bonus for finishing the race
  timeBonus: 100,            // seconds saved below a reference time
};

/**
 * Calculate fitness score from racing metrics.
 * Higher is better. Typical range: 0 - 200,000+
 */
export function calculateFitness(
  metrics: RacingMetrics,
  weights: FitnessWeights = DEFAULT_FITNESS_WEIGHTS
): number {
  let fitness = 0;

  // Primary: checkpoint progress (this is what gets the AI moving forward)
  fitness += metrics.checkpointsReached * weights.checkpoint;

  // Secondary: centerline distance (gradient signal even before first checkpoint)
  fitness += metrics.centerlineProgress * weights.centerlineProgress;

  // Tertiary: speed (only matters once the AI is on-track)
  fitness += metrics.averageSpeed * weights.averageSpeed;

  // Skill bonuses
  fitness += metrics.driftBoostsFired * weights.driftBoosts;
  fitness += metrics.nitroSecondsUsed * weights.nitroEfficiency;

  // Penalties
  fitness -= metrics.wallCollisions * weights.wallCollisionPenalty;
  fitness -= metrics.framesStuck * weights.stuckPenalty;
  fitness -= metrics.framesSpinning * weights.spinPenalty;

  // Completion mega-bonus (makes finishing the #1 priority once the AI can do laps)
  if (metrics.finished) {
    fitness += weights.completionBonus;
    // Time bonus: reward faster completion (reference: 120 seconds)
    const timeSaved = Math.max(0, 120 - metrics.raceTime);
    fitness += timeSaved * weights.timeBonus;
  }

  // Lap bonuses (intermediate between checkpoints and completion)
  fitness += metrics.lapsCompleted * weights.checkpoint * 5;

  return fitness;
}

/**
 * Create a blank metrics object for accumulation during evaluation.
 */
export function createEmptyMetrics(): RacingMetrics {
  return {
    checkpointsReached: 0,
    centerlineProgress: 0,
    averageSpeed: 0,
    maxSpeed: 0,
    driftBoostsFired: 0,
    nitroSecondsUsed: 0,
    wallCollisions: 0,
    framesStuck: 0,
    totalFrames: 0,
    framesSpinning: 0,
    finished: false,
    raceTime: 0,
    lapsCompleted: 0,
  };
}
