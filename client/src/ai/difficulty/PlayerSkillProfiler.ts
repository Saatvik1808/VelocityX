/**
 * LEARNING NOTE: Player Skill Profiling — Adaptive Difficulty Foundation
 *
 * To make AI opponents fun for EVERY player, we need to know how skilled
 * the player is. A new player who crashes every corner needs easy AI.
 * A pro who drifts perfectly needs hard AI. We track metrics over multiple
 * races and compute a composite skill score (0-1).
 *
 * This is similar to how Forza Horizon's "Drivatar" system works —
 * it builds a profile of your driving style and uses it to calibrate AI.
 *
 * Key concepts: skill assessment, rolling averages, composite scoring
 */

import type { RaceSessionSummary } from '../telemetry/TelemetryCollector.js';

export interface SkillProfile {
  /** Rolling average lap time (seconds). Lower = more skilled. */
  avgLapTime: number;
  /** % of drift attempts that produced a boost (0-1) */
  driftSuccessRate: number;
  /** Wall hits per minute of racing */
  wallHitsPerMinute: number;
  /** Average speed in m/s */
  avgSpeed: number;
  /** Nitro efficiency: % of nitro used during straights vs. total */
  nitroEfficiency: number;
  /** Standard deviation of lap times (lower = more consistent) */
  lapTimeConsistency: number;
  /** Composite skill score (0-1). This is what the difficulty system uses. */
  overallSkill: number;
  /** Number of races analyzed */
  racesAnalyzed: number;
}

const STORAGE_KEY = 'neon_drift_skill_profile';
const MAX_HISTORY = 10; // rolling window of last N races

export class PlayerSkillProfiler {
  private raceHistory: RaceSessionSummary[] = [];
  private profile: SkillProfile;

  constructor() {
    this.profile = this.createDefaultProfile();
    this.loadFromStorage();
  }

  /** Feed a completed race session into the profiler */
  addRaceResult(summary: RaceSessionSummary): void {
    this.raceHistory.push(summary);

    // Keep only the last N races
    while (this.raceHistory.length > MAX_HISTORY) {
      this.raceHistory.shift();
    }

    this.recalculate();
    this.saveToStorage();
  }

  /** Recalculate the skill profile from race history */
  private recalculate(): void {
    const races = this.raceHistory;
    if (races.length === 0) {
      this.profile = this.createDefaultProfile();
      return;
    }

    // Average lap time (use totalTime / laps as proxy)
    const lapTimes = races
      .filter(r => r.lapsCompleted > 0)
      .map(r => r.totalTime / r.lapsCompleted);
    const avgLapTime = lapTimes.length > 0
      ? lapTimes.reduce((a, b) => a + b, 0) / lapTimes.length
      : 120; // default assumption

    // Lap time consistency (standard deviation)
    const lapTimeConsistency = lapTimes.length > 1
      ? Math.sqrt(lapTimes.reduce((sum, t) => sum + (t - avgLapTime) ** 2, 0) / lapTimes.length)
      : 30; // high uncertainty

    // Drift success rate
    const totalDriftAttempts = races.reduce((s, r) => s + r.driftAttempts, 0);
    const totalDriftSuccesses = races.reduce((s, r) => s + r.driftSuccesses, 0);
    const driftSuccessRate = totalDriftAttempts > 0
      ? totalDriftSuccesses / totalDriftAttempts
      : 0;

    // Wall hits per minute
    const totalRaceMinutes = races.reduce((s, r) => s + r.totalTime, 0) / 60;
    const totalWallHits = races.reduce((s, r) => s + r.wallCollisionCount, 0);
    const wallHitsPerMinute = totalRaceMinutes > 0
      ? totalWallHits / totalRaceMinutes
      : 10; // assume bad

    // Average speed
    const avgSpeed = races.reduce((s, r) => s + r.avgSpeed, 0) / races.length;

    // Nitro efficiency (ratio of nitro usage to race time — higher = better usage)
    const totalNitroSeconds = races.reduce((s, r) => s + r.nitroUsageSeconds, 0);
    const totalRaceSeconds = races.reduce((s, r) => s + r.totalTime, 0);
    const nitroEfficiency = totalRaceSeconds > 0
      ? Math.min(1, totalNitroSeconds / (totalRaceSeconds * 0.3)) // cap at 30% nitro time = perfect
      : 0;

    // ── Composite skill score (0-1) ──
    // Each component maps to [0, 1] and is weighted
    const speedScore = clamp(avgSpeed / 50, 0, 1);                    // 50 m/s = excellent
    const lapScore = clamp(1 - (avgLapTime - 30) / 90, 0, 1);        // 30s = godlike, 120s = beginner
    const driftScore = clamp(driftSuccessRate, 0, 1);
    const wallScore = clamp(1 - wallHitsPerMinute / 10, 0, 1);       // 10+ hits/min = terrible
    const consistencyScore = clamp(1 - lapTimeConsistency / 30, 0, 1);
    const nitroScore = clamp(nitroEfficiency, 0, 1);

    const overallSkill = clamp(
      speedScore * 0.20 +
      lapScore * 0.25 +
      driftScore * 0.15 +
      wallScore * 0.15 +
      consistencyScore * 0.15 +
      nitroScore * 0.10,
      0, 1
    );

    this.profile = {
      avgLapTime,
      driftSuccessRate,
      wallHitsPerMinute,
      avgSpeed,
      nitroEfficiency,
      lapTimeConsistency,
      overallSkill,
      racesAnalyzed: races.length,
    };
  }

  /** Get the current skill profile */
  getProfile(): SkillProfile {
    return { ...this.profile };
  }

  /** Get just the overall skill score (0-1) */
  getSkillLevel(): number {
    return this.profile.overallSkill;
  }

  private createDefaultProfile(): SkillProfile {
    return {
      avgLapTime: 90,
      driftSuccessRate: 0.3,
      wallHitsPerMinute: 5,
      avgSpeed: 20,
      nitroEfficiency: 0.2,
      lapTimeConsistency: 20,
      overallSkill: 0.3, // assume slightly below average
      racesAnalyzed: 0,
    };
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        profile: this.profile,
        history: this.raceHistory,
      }));
    } catch { /* ignore */ }
  }

  private loadFromStorage(): void {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const data = JSON.parse(saved) as {
        profile: SkillProfile;
        history: RaceSessionSummary[];
      };
      this.profile = data.profile;
      this.raceHistory = data.history || [];
    } catch { /* ignore */ }
  }
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
