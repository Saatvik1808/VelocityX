/**
 * LEARNING NOTE: Race Results Screen — Premium Design
 */

import { useState } from 'react';
import type { RaceResult } from '@neon-drift/shared';
import { Leaderboard } from './Leaderboard.js';

const medals = ['1st', '2nd', '3rd'];
const posColors = ['#FFD700', '#C0C0C0', '#CD7F32'];

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(2).padStart(5, '0')}`;
}

interface Props {
  results: RaceResult[];
  onPlayAgain: () => void;
  onLeave: () => void;
}

export function RaceResults({ results, onPlayAgain, onLeave }: Props) {
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const myTime = results[0]?.time;

  if (showLeaderboard) {
    return <Leaderboard onClose={() => setShowLeaderboard(false)} highlightTime={myTime} />;
  }

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 2000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0, 0, 0, 0.7)',
      backdropFilter: 'blur(8px)',
      pointerEvents: 'auto',
    }}>
      <div style={{
        background: 'rgba(10, 10, 20, 0.9)',
        backdropFilter: 'blur(20px)',
        borderRadius: 20,
        border: '1px solid rgba(255,255,255,0.08)',
        padding: '36px 40px',
        width: 460,
        color: '#fff',
        fontFamily: "'Segoe UI', system-ui, sans-serif",
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 14, opacity: 0.4, textTransform: 'uppercase', letterSpacing: 3 }}>
            Race Complete
          </div>
          <div style={{
            fontSize: 32, fontWeight: 900, marginTop: 4,
            background: 'linear-gradient(135deg, #FFD700, #FFA500)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            RESULTS
          </div>
        </div>

        {/* Results list */}
        {results.map((r, i) => (
          <div key={r.id} style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '14px 18px', margin: '8px 0', borderRadius: 12,
            background: i === 0 ? 'rgba(255, 215, 0, 0.08)' :
              i === 1 ? 'rgba(192, 192, 192, 0.06)' :
              i === 2 ? 'rgba(205, 127, 50, 0.06)' :
              'rgba(255, 255, 255, 0.02)',
            border: `1px solid ${i < 3 ? (posColors[i] ?? 'transparent') + '22' : 'rgba(255,255,255,0.04)'}`,
          }}>
            {/* Position */}
            <div style={{
              width: 44, height: 44, borderRadius: 10,
              background: i < 3 ? `linear-gradient(135deg, ${posColors[i]}44, ${posColors[i]}22)` : 'rgba(255,255,255,0.04)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: i < 3 ? 24 : 18, fontWeight: 800,
              color: posColors[i] ?? '#666',
            }}>
              {medals[i] ?? `${i + 1}`}
            </div>

            {/* Name */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{r.name}</div>
              <div style={{ fontSize: 11, opacity: 0.4 }}>
                {i === 0 ? 'Winner!' : `+${((r.time - results[0]!.time)).toFixed(2)}s`}
              </div>
            </div>

            {/* Time */}
            <div style={{
              fontFamily: 'monospace', fontSize: 18, fontWeight: 700,
              color: i === 0 ? '#FFD700' : '#aaa',
            }}>
              {formatTime(r.time)}
            </div>
          </div>
        ))}

        {/* Leaderboard button */}
        <button onClick={() => setShowLeaderboard(true)} style={{
          width: '100%', padding: '12px', borderRadius: 10, border: 'none',
          background: 'linear-gradient(135deg, rgba(255,215,0,0.12), rgba(0,255,255,0.08))',
          color: '#FFD700', cursor: 'pointer', fontWeight: 700, fontSize: 13,
          letterSpacing: 2, marginTop: 20, marginBottom: 8,
          boxShadow: '0 0 15px rgba(255,215,0,0.1)',
          transition: 'all 0.2s',
        }}>
          &#127942; VIEW LEADERBOARD
        </button>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <button onClick={onLeave} style={{
            flex: 1, padding: '14px', borderRadius: 12, border: 'none',
            background: 'rgba(255,255,255,0.06)', color: '#999',
            cursor: 'pointer', fontWeight: 600, fontSize: 14,
          }}>
            LEAVE
          </button>
          <button onClick={onPlayAgain} style={{
            flex: 2, padding: '14px', borderRadius: 12, border: 'none',
            background: 'linear-gradient(135deg, #22cc55, #18aa44)',
            color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 16,
            boxShadow: '0 4px 20px rgba(34,204,85,0.3)',
          }}>
            PLAY AGAIN
          </button>
        </div>
      </div>
    </div>
  );
}
