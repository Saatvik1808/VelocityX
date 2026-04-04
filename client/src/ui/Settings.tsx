/**
 * LEARNING NOTE: Settings Panel (React)
 *
 * A slide-out settings panel for graphics quality and audio volume.
 * Graphics quality changes affect the PostProcessingStack — lower
 * settings disable expensive effects like SSR, SSAO, motion blur.
 * Audio volume adjusts the Web Audio API master gain node.
 *
 * Key concepts: user preferences, quality presets, audio control
 */

import { useState } from 'react';
import { useGameStore } from './store.js';

const QUALITY_LABELS: Record<string, string> = {
  low: 'LOW',
  medium: 'MEDIUM',
  high: 'HIGH',
  ultra: 'ULTRA',
};

const QUALITY_DESCRIPTIONS: Record<string, string> = {
  low: 'No bloom, no post-FX. Best for weak GPUs.',
  medium: 'Bloom + vignette. Good balance.',
  high: 'All effects at medium quality. Recommended.',
  ultra: 'Max quality. All effects cranked up.',
};

export function Settings({ onClose }: { onClose: () => void }) {
  const masterVolume = useGameStore((s) => s.masterVolume);
  const setMasterVolume = useGameStore((s) => s.setMasterVolume);
  const graphicsQuality = useGameStore((s) => s.graphicsQuality);
  const setGraphicsQuality = useGameStore((s) => s.setGraphicsQuality);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0, 0, 0, 0.7)',
      backdropFilter: 'blur(8px)',
    }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'rgba(10, 10, 25, 0.95)',
        border: '1px solid rgba(0, 255, 255, 0.15)',
        borderRadius: 16,
        padding: '28px 32px',
        width: 380,
        color: '#fff',
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        boxShadow: '0 0 40px rgba(0, 255, 255, 0.1)',
      }}>
        {/* Title */}
        <div style={{
          fontSize: 22, fontWeight: 800, letterSpacing: 3, marginBottom: 24,
          textAlign: 'center',
          background: 'linear-gradient(135deg, #00ffff, #ff00ff)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          SETTINGS
        </div>

        {/* Audio Volume */}
        <div style={{ marginBottom: 24 }}>
          <div style={{
            fontSize: 11, opacity: 0.4, marginBottom: 8,
            textTransform: 'uppercase', letterSpacing: 1,
          }}>
            Master Volume — {Math.round(masterVolume * 100)}%
          </div>
          <input
            type="range" min="0" max="1" step="0.05"
            value={masterVolume}
            onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
            style={{
              width: '100%', height: 6, borderRadius: 3,
              appearance: 'none',
              background: `linear-gradient(to right, #00ffff ${masterVolume * 100}%, rgba(255,255,255,0.1) ${masterVolume * 100}%)`,
              cursor: 'pointer',
              outline: 'none',
            }}
          />
        </div>

        {/* Graphics Quality */}
        <div style={{ marginBottom: 24 }}>
          <div style={{
            fontSize: 11, opacity: 0.4, marginBottom: 8,
            textTransform: 'uppercase', letterSpacing: 1,
          }}>
            Graphics Quality
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {(['low', 'medium', 'high', 'ultra'] as const).map((q) => {
              const isActive = graphicsQuality === q;
              return (
                <button
                  key={q}
                  onClick={() => setGraphicsQuality(q)}
                  style={{
                    padding: '10px 8px', borderRadius: 10, border: 'none',
                    background: isActive
                      ? 'linear-gradient(135deg, rgba(0,255,255,0.15), rgba(255,0,255,0.1))'
                      : 'rgba(255,255,255,0.04)',
                    outline: isActive ? '2px solid rgba(0,255,255,0.5)' : '2px solid transparent',
                    cursor: 'pointer', transition: 'all 0.2s',
                    boxShadow: isActive ? '0 0 15px rgba(0,255,255,0.2)' : 'none',
                  }}
                >
                  <div style={{
                    fontSize: 13, fontWeight: 800, letterSpacing: 2,
                    color: isActive ? '#00ffff' : '#888',
                  }}>
                    {QUALITY_LABELS[q]}
                  </div>
                  <div style={{
                    fontSize: 9, opacity: 0.5, color: '#aaa', marginTop: 4, lineHeight: 1.3,
                  }}>
                    {QUALITY_DESCRIPTIONS[q]}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Controls reference */}
        <div style={{ marginBottom: 24 }}>
          <div style={{
            fontSize: 11, opacity: 0.4, marginBottom: 8,
            textTransform: 'uppercase', letterSpacing: 1,
          }}>
            Controls
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 14,
            display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px',
            fontSize: 12,
          }}>
            {[
              ['W / Up', 'Accelerate'],
              ['S / Down', 'Brake / Reverse'],
              ['A / Left', 'Steer Left'],
              ['D / Right', 'Steer Right'],
              ['Space', 'Drift'],
              ['Shift', 'Nitro'],
              ['~ (tilde)', 'Respawn to Track'],
            ].map(([key, action]) => (
              <div key={key} style={{ display: 'contents' }}>
                <div style={{
                  fontWeight: 700, color: '#00ffff',
                  background: 'rgba(0,255,255,0.08)',
                  padding: '2px 8px', borderRadius: 4, textAlign: 'center',
                  fontSize: 11,
                }}>
                  {key}
                </div>
                <div style={{ opacity: 0.6, display: 'flex', alignItems: 'center' }}>
                  {action}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Close button */}
        <button onClick={onClose} style={{
          width: '100%', padding: '12px', borderRadius: 10, border: 'none',
          background: 'rgba(255,255,255,0.06)', color: '#ccc',
          cursor: 'pointer', fontWeight: 700, fontSize: 14,
          letterSpacing: 2, transition: 'all 0.2s',
        }}>
          CLOSE
        </button>
      </div>
    </div>
  );
}
