/**
 * LEARNING NOTE: Distance-Based Checkpoint System
 *
 * Simple and reliable: each checkpoint is a ZONE on the track.
 * When the car enters within the trigger radius → checkpoint hit.
 * No complex line-crossing math, no ambiguity.
 *
 * Layout: 3 sector gates at 25%, 50%, 75% of the track.
 * 1 finish line at ~3% (just ahead of spawn on the start/finish straight).
 * Order: sector1 → sector2 → sector3 → FINISH → lap complete!
 *
 * The sequential requirement (must hit in order) prevents shortcutting.
 *
 * Key concepts: trigger radius, sequential checkpoints, lap counting
 */

interface Checkpoint {
  x: number;
  z: number;
  isFinishLine: boolean;
  triggered: boolean;
}

const TRIGGER_RADIUS = 20;
const RESET_RADIUS = 35;

export class CheckpointSystem {
  private checkpoints: Checkpoint[] = [];
  private nextCP = 0;
  private _lap = 1;
  private _totalLaps: number;
  private _finished = false;
  private _finishTime = 0;
  private _startTime = 0;

  onCheckpoint: ((cp: number, lap: number) => void) | null = null;
  onLapDone: ((lap: number) => void) | null = null;
  onFinish: ((time: number) => void) | null = null;

  get lap() { return this._lap; }
  get finished() { return this._finished; }
  get finishTime() { return this._finishTime; }
  get totalCheckpoints() { return this.checkpoints.length; }
  get currentCheckpointIndex() { return this.nextCP; }

  constructor(centerline: { x: number; z: number; nx: number; nz: number }[], totalLaps: number) {
    this._totalLaps = totalLaps;

    // CP0 = Sector 1 (25%)  — first quarter of track
    // CP1 = Sector 2 (50%)  — halfway
    // CP2 = Sector 3 (75%)  — three quarters
    // CP3 = FINISH   (3%)   — just ahead of spawn, on the start/finish straight
    const offsets = [0.25, 0.50, 0.75, 0.03];
    const labels = ['Sector 1', 'Sector 2', 'Sector 3', 'FINISH'];

    for (let i = 0; i < offsets.length; i++) {
      const idx = Math.floor(offsets[i]! * centerline.length) % centerline.length;
      const pt = centerline[idx]!;

      this.checkpoints.push({
        x: pt.x,
        z: pt.z,
        isFinishLine: i === offsets.length - 1,
        triggered: false,
      });

      console.log(`CP${i} [${labels[i]}]: (${pt.x.toFixed(0)}, ${pt.z.toFixed(0)}) @ ${(offsets[i]! * 100).toFixed(0)}%`);
    }
  }

  start(time: number) {
    this._startTime = time;
    this._lap = 1;
    this.nextCP = 0;
    this._finished = false;
    this._finishTime = 0;
    for (const cp of this.checkpoints) cp.triggered = false;
  }

  update(carX: number, carZ: number, time: number): boolean {
    if (this._finished) return false;
    if (this.checkpoints.length === 0) return false;

    const cp = this.checkpoints[this.nextCP]!;
    const dx = carX - cp.x;
    const dz = carZ - cp.z;
    const distSq = dx * dx + dz * dz;

    if (!cp.triggered && distSq < TRIGGER_RADIUS * TRIGGER_RADIUS) {
      cp.triggered = true;
      this.onCheckpoint?.(this.nextCP, this._lap);
      this.nextCP++;

      if (this.nextCP >= this.checkpoints.length) {
        this.onLapDone?.(this._lap);

        if (this._lap >= this._totalLaps) {
          this._finished = true;
          this._finishTime = time - this._startTime;
          this.onFinish?.(this._finishTime);
          return true;
        }

        this._lap++;
        this.nextCP = 0;
      }
    }

    // Reset trigger when car leaves the zone
    if (cp.triggered && distSq > RESET_RADIUS * RESET_RADIUS) {
      cp.triggered = false;
    }

    return false;
  }

  getProgress(carX: number, carZ: number): number {
    if (this._finished) return 999999;
    return (this._lap - 1) * this.checkpoints.length + this.nextCP;
  }
}
