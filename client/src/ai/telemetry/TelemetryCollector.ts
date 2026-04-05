/**
 * LEARNING NOTE: Telemetry — The Data Pipeline for Self-Improving AI
 *
 * Every racing game studio collects telemetry: detailed recordings of what
 * happened during each race. This data feeds THREE AI systems:
 * 1. Physics evolution (which constants produce the most fun races?)
 * 2. Difficulty adjustment (how skilled is this player?)
 * 3. Training data for future ML models
 *
 * We record at 20Hz (every 6th physics frame) — enough detail for analysis
 * without bloating storage. A 90-second race produces ~72KB of data.
 *
 * Key concepts: telemetry, data collection, session summarization
 */

export interface TelemetryFrame {
  /** Timestamp within race (seconds) */
  t: number;
  /** Forward speed (m/s) */
  spd: number;
  /** Position x, z */
  px: number;
  pz: number;
  /** Is drifting */
  dft: boolean;
  /** Drift charge level 0-3 */
  dcl: number;
  /** Nitro active */
  nit: boolean;
  /** Nitro tank 0-1 */
  ntk: number;
  /** Wall collision this frame */
  wc: boolean;
  /** Current checkpoint index */
  cp: number;
  /** Current lap */
  lap: number;
  /** Input bitfield (6 bools packed) */
  inp: number;
}

export interface RaceSessionSummary {
  totalTime: number;
  avgSpeed: number;
  maxSpeed: number;
  wallCollisionCount: number;
  driftAttempts: number;
  driftSuccesses: number;
  nitroUsageSeconds: number;
  checkpointsReached: number;
  lapsCompleted: number;
  offTrackSeconds: number;
  topSpeedKmh: number;
  avgDriftDuration: number;
}

export interface RaceSessionTelemetry {
  sessionId: string;
  vehicleId: string;
  trackId: string;
  startTime: number;
  frames: TelemetryFrame[];
  summary: RaceSessionSummary;
}

export class TelemetryCollector {
  private frames: TelemetryFrame[] = [];
  private vehicleId = '';
  private trackId = '';
  private startTime = 0;
  private sessionId = '';
  private isRecording = false;

  // Running metrics for summary
  private speedSum = 0;
  private maxSpeed = 0;
  private frameCount = 0;
  private wallCollisions = 0;
  private driftAttempts = 0;
  private driftSuccesses = 0;
  private nitroFrames = 0;
  private lastCheckpoint = 0;
  private maxCheckpoint = 0;
  private maxLap = 0;
  private wasDrifting = false;
  private driftStartTime = 0;
  private driftDurations: number[] = [];
  private lastSpeed = 0;

  // Sampling: record every Nth physics frame
  private physicsFrameCounter = 0;
  private readonly sampleRate = 6; // every 6 frames at 120Hz = 20Hz

  startSession(vehicleId: string, trackId: string = 'default'): void {
    this.frames = [];
    this.vehicleId = vehicleId;
    this.trackId = trackId;
    this.startTime = performance.now();
    this.sessionId = `race_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.isRecording = true;

    // Reset metrics
    this.speedSum = 0;
    this.maxSpeed = 0;
    this.frameCount = 0;
    this.wallCollisions = 0;
    this.driftAttempts = 0;
    this.driftSuccesses = 0;
    this.nitroFrames = 0;
    this.lastCheckpoint = 0;
    this.maxCheckpoint = 0;
    this.maxLap = 0;
    this.wasDrifting = false;
    this.driftStartTime = 0;
    this.driftDurations = [];
    this.lastSpeed = 0;
    this.physicsFrameCounter = 0;
  }

  /**
   * Called every physics frame. Only records every Nth frame.
   */
  recordFrame(data: {
    raceTime: number;
    speed: number;
    posX: number;
    posZ: number;
    isDrifting: boolean;
    driftChargeLevel: number;
    isNitroActive: boolean;
    nitroTank: number;
    checkpointIndex: number;
    lap: number;
    input: {
      accelerate: boolean;
      brake: boolean;
      steerLeft: boolean;
      steerRight: boolean;
      drift: boolean;
      nitro: boolean;
    };
  }): void {
    if (!this.isRecording) return;

    this.physicsFrameCounter++;

    // Always update running metrics (every frame, not just sampled ones)
    this.speedSum += data.speed;
    this.frameCount++;
    if (data.speed > this.maxSpeed) this.maxSpeed = data.speed;

    // Wall collision detection: sudden large speed drop
    const speedDelta = this.lastSpeed - data.speed;
    const wallHit = speedDelta > 8;
    if (wallHit) this.wallCollisions++;
    this.lastSpeed = data.speed;

    // Drift tracking
    if (data.isDrifting && !this.wasDrifting) {
      this.driftAttempts++;
      this.driftStartTime = data.raceTime;
    }
    if (!data.isDrifting && this.wasDrifting) {
      const driftDuration = data.raceTime - this.driftStartTime;
      this.driftDurations.push(driftDuration);
      // If drift charge level was > 0, it was a successful drift
      if (data.driftChargeLevel > 0) {
        this.driftSuccesses++;
      }
    }
    this.wasDrifting = data.isDrifting;

    // Nitro usage
    if (data.isNitroActive) this.nitroFrames++;

    // Checkpoint/lap tracking
    if (data.checkpointIndex > this.maxCheckpoint || data.lap > this.maxLap) {
      this.maxCheckpoint = data.checkpointIndex;
    }
    this.lastCheckpoint = data.checkpointIndex;
    if (data.lap > this.maxLap) this.maxLap = data.lap;

    // Only store frames at sample rate
    if (this.physicsFrameCounter % this.sampleRate !== 0) return;

    // Pack input booleans into a single byte
    const inp =
      (data.input.accelerate ? 1 : 0) |
      (data.input.brake ? 2 : 0) |
      (data.input.steerLeft ? 4 : 0) |
      (data.input.steerRight ? 8 : 0) |
      (data.input.drift ? 16 : 0) |
      (data.input.nitro ? 32 : 0);

    this.frames.push({
      t: data.raceTime,
      spd: Math.round(data.speed * 10) / 10,
      px: Math.round(data.posX * 10) / 10,
      pz: Math.round(data.posZ * 10) / 10,
      dft: data.isDrifting,
      dcl: data.driftChargeLevel,
      nit: data.isNitroActive,
      ntk: Math.round(data.nitroTank * 100) / 100,
      wc: wallHit,
      cp: data.checkpointIndex,
      lap: data.lap,
      inp,
    });
  }

  /** Finalize session and return complete telemetry with summary */
  endSession(): RaceSessionTelemetry | null {
    if (!this.isRecording) return null;
    this.isRecording = false;

    const totalTime = (performance.now() - this.startTime) / 1000;
    const avgSpeed = this.frameCount > 0 ? this.speedSum / this.frameCount : 0;
    const avgDriftDuration = this.driftDurations.length > 0
      ? this.driftDurations.reduce((a, b) => a + b, 0) / this.driftDurations.length
      : 0;

    const summary: RaceSessionSummary = {
      totalTime,
      avgSpeed,
      maxSpeed: this.maxSpeed,
      wallCollisionCount: this.wallCollisions,
      driftAttempts: this.driftAttempts,
      driftSuccesses: this.driftSuccesses,
      nitroUsageSeconds: this.nitroFrames / 120, // 120Hz physics
      checkpointsReached: this.maxCheckpoint,
      lapsCompleted: this.maxLap,
      offTrackSeconds: 0, // TODO: track with distance from centerline
      topSpeedKmh: this.maxSpeed * 3.6,
      avgDriftDuration,
    };

    return {
      sessionId: this.sessionId,
      vehicleId: this.vehicleId,
      trackId: this.trackId,
      startTime: this.startTime,
      frames: this.frames,
      summary,
    };
  }

  /** Save the last N sessions to localStorage */
  static saveSession(session: RaceSessionTelemetry, maxSessions: number = 20): void {
    try {
      const key = 'neon_drift_telemetry';
      const existing = JSON.parse(localStorage.getItem(key) || '[]') as RaceSessionTelemetry[];

      // Only save summary + lightweight frame data (drop raw frames for storage efficiency)
      const lightSession = {
        ...session,
        frames: session.frames.length > 500
          ? session.frames.filter((_, i) => i % 3 === 0) // downsample long races
          : session.frames,
      };

      existing.push(lightSession);

      // Keep only last N sessions (ring buffer)
      while (existing.length > maxSessions) {
        existing.shift();
      }

      localStorage.setItem(key, JSON.stringify(existing));
    } catch {
      // localStorage full or unavailable — silently skip
    }
  }

  /** Load saved sessions from localStorage */
  static loadSessions(): RaceSessionTelemetry[] {
    try {
      const key = 'neon_drift_telemetry';
      return JSON.parse(localStorage.getItem(key) || '[]') as RaceSessionTelemetry[];
    } catch {
      return [];
    }
  }

  get recording(): boolean {
    return this.isRecording;
  }
}
