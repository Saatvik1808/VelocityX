/**
 * LEARNING NOTE: Mobile Touch Controls
 *
 * Renders on-screen buttons for mobile devices: left/right steering
 * on the left side, accelerate/brake on the right side, drift button
 * in the center. Uses touch events (not click) for multi-touch support.
 *
 * Key concepts: touch events, multi-touch, mobile input, landscape layout
 */

import { useEffect, useState } from 'react';
import { touchState } from '../engine/InputManager.js';

const btnBase: React.CSSProperties = {
  position: 'absolute',
  borderRadius: 16,
  border: '2px solid rgba(255,255,255,0.15)',
  background: 'rgba(255,255,255,0.08)',
  color: 'rgba(255,255,255,0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  userSelect: 'none',
  WebkitUserSelect: 'none',
  touchAction: 'none',
  fontSize: 14,
  fontWeight: 700,
  fontFamily: "'Segoe UI', system-ui, sans-serif",
  pointerEvents: 'auto',
};

const activeStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.2)',
  border: '2px solid rgba(255,255,255,0.35)',
  color: 'rgba(255,255,255,0.9)',
};

function useTouchButton(key: keyof typeof touchState) {
  const [pressed, setPressed] = useState(false);

  const onDown = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    touchState[key] = true;
    setPressed(true);
  };

  const onUp = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    touchState[key] = false;
    setPressed(false);
  };

  return { pressed, onDown, onUp };
}

export function TouchControls() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => {
      setIsMobile('ontouchstart' in window || navigator.maxTouchPoints > 0);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Clean up touch state when component unmounts or touch ends outside
  useEffect(() => {
    const clearAll = () => {
      touchState.accelerate = false;
      touchState.brake = false;
      touchState.steerLeft = false;
      touchState.steerRight = false;
      touchState.drift = false;
    };
    window.addEventListener('blur', clearAll);
    return () => {
      window.removeEventListener('blur', clearAll);
      clearAll();
    };
  }, []);

  if (!isMobile) return null;

  const left = useTouchButton('steerLeft');
  const right = useTouchButton('steerRight');
  const accel = useTouchButton('accelerate');
  const brake = useTouchButton('brake');
  const drift = useTouchButton('drift');

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 500,
      pointerEvents: 'none',
    }}>
      {/* LEFT SIDE — Steering */}

      {/* Steer Left */}
      <div
        style={{
          ...btnBase,
          left: 16, bottom: 80,
          width: 80, height: 80,
          ...(left.pressed ? activeStyle : {}),
        }}
        onTouchStart={left.onDown}
        onTouchEnd={left.onUp}
        onTouchCancel={left.onUp}
        onMouseDown={left.onDown}
        onMouseUp={left.onUp}
        onMouseLeave={left.onUp}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </div>

      {/* Steer Right */}
      <div
        style={{
          ...btnBase,
          left: 110, bottom: 80,
          width: 80, height: 80,
          ...(right.pressed ? activeStyle : {}),
        }}
        onTouchStart={right.onDown}
        onTouchEnd={right.onUp}
        onTouchCancel={right.onUp}
        onMouseDown={right.onDown}
        onMouseUp={right.onUp}
        onMouseLeave={right.onUp}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>

      {/* RIGHT SIDE — Accelerate / Brake */}

      {/* Accelerate */}
      <div
        style={{
          ...btnBase,
          right: 16, bottom: 100,
          width: 90, height: 90,
          borderRadius: '50%',
          background: accel.pressed ? 'rgba(50,200,80,0.3)' : 'rgba(50,200,80,0.1)',
          border: accel.pressed ? '2px solid rgba(50,200,80,0.5)' : '2px solid rgba(50,200,80,0.2)',
          color: accel.pressed ? '#44dd66' : 'rgba(50,200,80,0.6)',
          fontSize: 11,
          letterSpacing: 1,
        }}
        onTouchStart={accel.onDown}
        onTouchEnd={accel.onUp}
        onTouchCancel={accel.onUp}
        onMouseDown={accel.onDown}
        onMouseUp={accel.onUp}
        onMouseLeave={accel.onUp}
      >
        GAS
      </div>

      {/* Brake */}
      <div
        style={{
          ...btnBase,
          right: 120, bottom: 80,
          width: 70, height: 70,
          borderRadius: '50%',
          background: brake.pressed ? 'rgba(220,50,50,0.3)' : 'rgba(220,50,50,0.1)',
          border: brake.pressed ? '2px solid rgba(220,50,50,0.5)' : '2px solid rgba(220,50,50,0.2)',
          color: brake.pressed ? '#ff6666' : 'rgba(220,50,50,0.6)',
          fontSize: 11,
          letterSpacing: 1,
        }}
        onTouchStart={brake.onDown}
        onTouchEnd={brake.onUp}
        onTouchCancel={brake.onUp}
        onMouseDown={brake.onDown}
        onMouseUp={brake.onUp}
        onMouseLeave={brake.onUp}
      >
        BRK
      </div>

      {/* CENTER — Drift */}
      <div
        style={{
          ...btnBase,
          left: '50%', bottom: 20,
          transform: 'translateX(-50%)',
          width: 100, height: 44,
          borderRadius: 22,
          background: drift.pressed ? 'rgba(255,150,0,0.3)' : 'rgba(255,150,0,0.08)',
          border: drift.pressed ? '2px solid rgba(255,150,0,0.5)' : '2px solid rgba(255,150,0,0.15)',
          color: drift.pressed ? '#ffaa44' : 'rgba(255,150,0,0.5)',
          fontSize: 12,
          letterSpacing: 2,
        }}
        onTouchStart={drift.onDown}
        onTouchEnd={drift.onUp}
        onTouchCancel={drift.onUp}
        onMouseDown={drift.onDown}
        onMouseUp={drift.onUp}
        onMouseLeave={drift.onUp}
      >
        DRIFT
      </div>
    </div>
  );
}
