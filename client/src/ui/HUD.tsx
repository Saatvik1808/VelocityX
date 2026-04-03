/**
 * LEARNING NOTE: Premium Racing HUD
 */

import { useGameStore } from './store.js';
import { HUD_CONFIG } from '@neon-drift/shared';

const panel: React.CSSProperties = {
  background: 'rgba(8, 8, 16, 0.65)',
  backdropFilter: 'blur(8px)',
  borderRadius: 10,
  border: '1px solid rgba(255, 255, 255, 0.06)',
  padding: '10px 14px',
  color: '#ffffff',
  fontFamily: "'Segoe UI', system-ui, sans-serif",
};

const containerStyle: React.CSSProperties = {
  position: 'absolute', inset: 0, pointerEvents: 'none', userSelect: 'none',
};

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(2).padStart(5, '0')}`;
}

export function HUD() {
  const speed = useGameStore((s) => s.speed);
  const fps = useGameStore((s) => s.fps);
  const gamePhase = useGameStore((s) => s.gamePhase);
  const lap = useGameStore((s) => s.lap);
  const totalLaps = useGameStore((s) => s.totalLaps);
  const position = useGameStore((s) => s.position);
  const totalRacers = useGameStore((s) => s.totalRacers);
  const raceTime = useGameStore((s) => s.raceTime);
  const playerPos = useGameStore((s) => s.playerWorldPos);
  const trackSVG = useGameStore((s) => s.trackCenterlineSVG);
  const isDrifting = useGameStore((s) => s.isDrifting);
  const boostLevel = useGameStore((s) => s.boostLevel);
  const boostActive = useGameStore((s) => s.boostActive);
  const countdownSeconds = useGameStore((s) => s.countdownSeconds);
  const currentCheckpoint = useGameStore((s) => s.currentCheckpoint);
  const totalCheckpoints = useGameStore((s) => s.totalCheckpoints);

  if (gamePhase === 'LOADING') {
    return (
      <div style={containerStyle}>
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)', fontSize: 22, opacity: 0.5, color: '#fff',
        }}>
          Loading...
        </div>
      </div>
    );
  }

  const absSpeed = Math.round(Math.abs(speed));
  const speedPct = Math.min(absSpeed / HUD_CONFIG.MAX_SPEED_KMH * 100, 100);
  const suffix = position === 1 ? 'st' : position === 2 ? 'nd' : position === 3 ? 'rd' : 'th';

  return (
    <div style={containerStyle}>
      {/* Speed lines */}
      {absSpeed > 40 && (
        <div style={{
          position: 'absolute', inset: 0,
          background: `radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,${Math.min(absSpeed / 200, 0.2)}) 100%)`,
        }} />
      )}

      {/* Drift indicator */}
      {isDrifting && (
        <div style={{
          position: 'absolute', top: '38%', left: '50%', transform: 'translateX(-50%)',
          fontSize: 26, fontWeight: 800, letterSpacing: 6,
          color: '#ff6600', textShadow: '0 0 20px rgba(255,102,0,0.6)',
        }}>
          DRIFT!
        </div>
      )}

      {/* Countdown */}
      {countdownSeconds > 0 && (
        <div style={{
          position: 'absolute', top: '30%', left: '50%', transform: 'translateX(-50%)',
          fontSize: 140, fontWeight: 900, color: '#fff',
          textShadow: '0 0 60px rgba(255,200,0,0.5)',
        }}>
          {countdownSeconds}
        </div>
      )}

      {/* FPS */}
      <div style={{
        position: 'absolute', top: 8, right: 12,
        fontSize: 11, opacity: 0.25, fontFamily: 'monospace', color: '#fff',
      }}>
        {fps} FPS
      </div>

      {/* Minimap */}
      <div style={{ ...panel, position: 'absolute', top: 14, left: 14, padding: '6px 8px' }}>
        <svg width="140" height="100" viewBox="-10 -10 160 130" style={{ display: 'block' }}>
          {trackSVG && (
            <path d={trackSVG} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinejoin="round" />
          )}
          <circle cx={playerPos.x * 0.3 + 70} cy={-playerPos.z * 0.3 + 55} r="3.5" fill="#00ccff" />
        </svg>
      </div>

      {/* Position + Lap — top right */}
      <div style={{
        ...panel, position: 'absolute', top: 14, right: 14,
        textAlign: 'right', minWidth: 100,
      }}>
        <div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1 }}>
          {position}<span style={{ fontSize: 14, opacity: 0.5 }}>{suffix}</span>
          <span style={{ fontSize: 14, opacity: 0.3 }}> / {totalRacers}</span>
        </div>
        <div style={{
          fontSize: 12, opacity: 0.4, letterSpacing: 2, marginTop: 4,
          borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 6,
        }}>
          LAP <span style={{ fontSize: 16, fontWeight: 700, opacity: 1 }}>{lap}</span>
          <span style={{ opacity: 0.4 }}> / {totalLaps}</span>
        </div>
        <div style={{ fontSize: 10, opacity: 0.3, marginTop: 2 }}>
          CP {currentCheckpoint}/{totalCheckpoints}
        </div>
      </div>

      {/* Speedometer — bottom right */}
      <div style={{
        ...panel, position: 'absolute', bottom: 20, right: 14,
        textAlign: 'right', minWidth: 130, padding: '12px 16px',
      }}>
        <div style={{ fontSize: 48, fontWeight: 800, lineHeight: 1 }}>{absSpeed}</div>
        <div style={{ fontSize: 11, opacity: 0.4, letterSpacing: 3, marginBottom: 8 }}>KM/H</div>
        {/* Speed bar */}
        <div style={{ width: '100%', height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)' }}>
          <div style={{
            width: `${speedPct}%`, height: '100%', borderRadius: 2, transition: 'width 0.1s',
            background: speedPct < 40 ? '#44cc44' : speedPct < 70 ? '#cccc44' : '#cc4444',
          }} />
        </div>
      </div>

      {/* Boost meter */}
      {(boostLevel > 0 || boostActive) && (
        <div style={{
          ...panel, position: 'absolute', bottom: 100, right: 14,
          width: 130, padding: '8px 12px',
        }}>
          <div style={{ fontSize: 10, opacity: 0.4, letterSpacing: 1, marginBottom: 4 }}>BOOST</div>
          <div style={{ width: '100%', height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)' }}>
            <div style={{
              width: boostActive ? '100%' : `${Math.min((boostLevel / 3) * 100, 100)}%`,
              height: '100%', borderRadius: 3, transition: 'width 0.15s',
              background: boostActive ? '#ff4400' :
                boostLevel === 3 ? 'linear-gradient(90deg, #8800ff, #cc00ff)' :
                boostLevel === 2 ? 'linear-gradient(90deg, #ff6600, #ffaa00)' :
                'linear-gradient(90deg, #0066ff, #00aaff)',
            }} />
          </div>
          <div style={{ fontSize: 10, textAlign: 'center', marginTop: 3, opacity: 0.5, fontWeight: 700 }}>
            {boostActive ? 'BOOST!' :
              boostLevel === 3 ? 'MAX' :
              boostLevel === 2 ? 'LVL 2' :
              boostLevel === 1 ? 'LVL 1' : ''}
          </div>
        </div>
      )}

      {/* Timer — bottom center */}
      <div style={{
        ...panel, position: 'absolute', bottom: 20,
        left: '50%', transform: 'translateX(-50%)',
        padding: '8px 20px',
      }}>
        <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'monospace', letterSpacing: 2 }}>
          {formatTime(raceTime)}
        </div>
      </div>

      {/* Controls — bottom left */}
      <div style={{
        ...panel, position: 'absolute', bottom: 20, left: 14,
        fontSize: 11, opacity: 0.5, lineHeight: 1.8, padding: '8px 12px',
      }}>
        <div><b>W</b> / <b>S</b> accelerate / brake</div>
        <div><b>A</b> / <b>D</b> steer</div>
        <div><b>SPACE</b> drift</div>
      </div>

      {/* Leave room button */}
      <button
        onClick={() => {
          const nm = (window as any).__networkManager;
          if (nm) nm.leaveRoom();
          window.location.reload();
        }}
        style={{
          position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)',
          padding: '6px 16px', borderRadius: 8, border: 'none',
          background: 'rgba(200, 50, 50, 0.4)', color: '#ff8888',
          cursor: 'pointer', fontSize: 11, pointerEvents: 'auto',
          fontWeight: 600, letterSpacing: 1,
        }}
      >
        LEAVE ROOM
      </button>
    </div>
  );
}
