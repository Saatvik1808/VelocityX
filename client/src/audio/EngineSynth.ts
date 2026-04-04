/**
 * LEARNING NOTE: Procedural Engine Sound Synthesis (Web Audio API)
 *
 * Real engine sounds come from combustion cycles at specific frequencies.
 * We simulate this with multiple oscillators tuned to harmonics of the
 * engine RPM. As RPM increases, the fundamental frequency rises and
 * the harmonic balance shifts — creating that satisfying engine whine.
 *
 * The approach: base frequency = RPM / 60 (cycles per second), then
 * add harmonics at 2x, 3x, 4x with decreasing volume. A low-pass
 * filter simulates the muffled exhaust character.
 *
 * Key concepts: oscillator harmonics, RPM-to-frequency mapping, filters
 * Further reading: https://www.soundonsound.com/techniques/synthesising-engines
 */

import type { AudioEngine } from './AudioEngine.js';

export class EngineSynth {
  private ctx: AudioContext;
  private oscillators: OscillatorNode[] = [];
  private gains: GainNode[] = [];
  private masterGain: GainNode;
  private filter: BiquadFilterNode;
  private distortion: WaveShaperNode;
  private started = false;

  // Harmonic configuration: [frequency multiplier, base gain]
  private readonly harmonics = [
    { mult: 1.0, gain: 0.35 },   // fundamental
    { mult: 2.0, gain: 0.25 },   // 2nd harmonic — adds body
    { mult: 3.0, gain: 0.12 },   // 3rd — adds growl
    { mult: 4.0, gain: 0.06 },   // 4th — adds edge
    { mult: 0.5, gain: 0.20 },   // sub-harmonic — deep bass rumble
  ];

  constructor(audioEngine: AudioEngine) {
    this.ctx = audioEngine.getContext();

    // Master gain for engine volume
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0;

    // Low-pass filter — simulates exhaust muffling
    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 800;
    this.filter.Q.value = 2.5;

    // Subtle distortion for grit
    this.distortion = this.ctx.createWaveShaper();
    this.distortion.curve = this.makeDistortionCurve(8) as Float32Array<ArrayBuffer>;
    this.distortion.oversample = '2x';

    // Chain: oscillators → distortion → filter → masterGain → destination
    this.distortion.connect(this.filter);
    this.filter.connect(this.masterGain);
    this.masterGain.connect(audioEngine.getMasterGain());

    // Create oscillators for each harmonic
    for (const h of this.harmonics) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth'; // sawtooth has all harmonics — sounds engine-like
      osc.frequency.value = 40;

      const gain = this.ctx.createGain();
      gain.gain.value = h.gain;

      osc.connect(gain);
      gain.connect(this.distortion);

      this.oscillators.push(osc);
      this.gains.push(gain);
    }
  }

  private makeDistortionCurve(amount: number): Float32Array {
    const samples = 256;
    const curve = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = (Math.PI + amount) * x / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }

  /** Start the oscillators — call once */
  start(): void {
    if (this.started) return;
    this.started = true;
    for (const osc of this.oscillators) {
      osc.start();
    }
  }

  /**
   * Update engine sound based on vehicle state
   * @param rpm Normalized RPM 0-1 (0 = idle, 1 = redline)
   * @param throttle 0-1 (how much gas)
   * @param speed absolute speed in m/s
   */
  update(rpm: number, throttle: number, speed: number): void {
    if (!this.started) this.start();

    // Map RPM to base frequency: idle ~40Hz, redline ~180Hz
    const baseFreq = 40 + rpm * 140;
    const now = this.ctx.currentTime;

    // Update each harmonic's frequency
    for (let i = 0; i < this.harmonics.length; i++) {
      const h = this.harmonics[i]!;
      const osc = this.oscillators[i]!;
      const gain = this.gains[i]!;

      osc.frequency.setTargetAtTime(baseFreq * h.mult, now, 0.03);

      // Higher harmonics get louder at high RPM (engine screams)
      const rpmBoost = h.mult > 1 ? rpm * 0.5 : 0;
      gain.gain.setTargetAtTime(h.gain + rpmBoost * h.gain, now, 0.05);
    }

    // Filter opens up with RPM — high RPM = brighter, more aggressive
    const filterFreq = 600 + rpm * 2500 + throttle * 800;
    this.filter.frequency.setTargetAtTime(filterFreq, now, 0.04);

    // Master volume: louder with throttle, quieter at idle
    const volume = 0.08 + throttle * 0.25 + rpm * 0.15;
    this.masterGain.gain.setTargetAtTime(Math.min(volume, 0.5), now, 0.05);
  }

  /** Quick volume ramp for on/off throttle pops */
  setThrottle(on: boolean): void {
    const now = this.ctx.currentTime;
    if (!on) {
      // Off-throttle: brief volume spike then drop (exhaust pop feel)
      this.masterGain.gain.setTargetAtTime(0.12, now, 0.02);
    }
  }

  dispose(): void {
    for (const osc of this.oscillators) {
      try { osc.stop(); } catch (_) { /* ignore */ }
      osc.disconnect();
    }
    for (const g of this.gains) g.disconnect();
    this.filter.disconnect();
    this.distortion.disconnect();
    this.masterGain.disconnect();
  }
}
