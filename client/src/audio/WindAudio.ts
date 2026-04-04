/**
 * LEARNING NOTE: Wind / Speed Ambience (Web Audio API)
 *
 * Wind noise increases with speed — filtered white noise through a
 * low-pass filter that opens as speed increases. This is a subtle but
 * critical audio cue that makes speed "feel" real even without looking
 * at the speedometer.
 *
 * Key concepts: speed-reactive audio, ambient noise layer, filter automation
 */

import type { AudioEngine } from './AudioEngine.js';

export class WindAudio {
  private ctx: AudioContext;
  private source: AudioBufferSourceNode | null = null;
  private gain: GainNode;
  private filter: BiquadFilterNode;
  private started = false;
  private noiseBuffer: AudioBuffer;

  constructor(audioEngine: AudioEngine) {
    this.ctx = audioEngine.getContext();

    // Generate noise buffer
    const length = this.ctx.sampleRate * 3;
    this.noiseBuffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 200;
    this.filter.Q.value = 0.5;

    this.gain = this.ctx.createGain();
    this.gain.gain.value = 0;

    this.filter.connect(this.gain);
    this.gain.connect(audioEngine.getMasterGain());
  }

  private ensureStarted(): void {
    if (this.started) return;
    this.started = true;

    this.source = this.ctx.createBufferSource();
    this.source.buffer = this.noiseBuffer;
    this.source.loop = true;
    this.source.connect(this.filter);
    this.source.start();
  }

  /** Update wind intensity based on speed */
  update(speed: number): void {
    this.ensureStarted();

    const absSpeed = Math.abs(speed);
    const now = this.ctx.currentTime;

    // Wind volume scales with speed
    const vol = Math.min(absSpeed / 50, 1) * 0.06;
    this.gain.gain.setTargetAtTime(vol, now, 0.15);

    // Filter opens with speed — faster = higher frequency wind
    const freq = 200 + Math.min(absSpeed / 40, 1) * 3000;
    this.filter.frequency.setTargetAtTime(freq, now, 0.15);
  }

  dispose(): void {
    try { this.source?.stop(); } catch (_) { /* */ }
    this.gain.disconnect();
    this.filter.disconnect();
  }
}
