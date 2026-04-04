/**
 * LEARNING NOTE: Countdown & UI Sound Effects (Web Audio API)
 *
 * Simple tone beeps for the race countdown (3-2-1-GO). Low beeps for
 * the count, high beep for GO. These are pure sine wave tones with
 * quick exponential decay — clean and punchy.
 *
 * Key concepts: tone generation, pitch mapping, UI audio feedback
 */

import type { AudioEngine } from './AudioEngine.js';

export class CountdownAudio {
  private ctx: AudioContext;
  private masterOutput: GainNode;

  constructor(audioEngine: AudioEngine) {
    this.ctx = audioEngine.getContext();
    this.masterOutput = audioEngine.getMasterGain();
  }

  /** Play countdown beep (3, 2, 1) */
  beepCount(): void {
    this.playTone(440, 0.15, 0.15);  // A4 — standard beep
  }

  /** Play GO beep (higher pitch, longer) */
  beepGo(): void {
    this.playTone(880, 0.3, 0.2);    // A5 — one octave up
  }

  /** Play race finish fanfare */
  playFinish(): void {
    const now = this.ctx.currentTime;
    // Quick ascending arpeggio: C5 → E5 → G5 → C6
    const notes = [523, 659, 784, 1047];
    for (let i = 0; i < notes.length; i++) {
      this.playTone(notes[i]!, 0.15, 0.12, now + i * 0.12);
    }
  }

  private playTone(freq: number, duration: number, volume: number, startTime?: number): void {
    const now = startTime ?? this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.masterOutput);
    osc.start(now);
    osc.stop(now + duration + 0.01);

    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  dispose(): void {
    // No persistent nodes
  }
}
