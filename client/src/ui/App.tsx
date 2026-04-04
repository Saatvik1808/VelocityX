/**
 * LEARNING NOTE: React App with Lobby + Game States
 *
 * The lobby overlay renders on top of the 3D canvas with high z-index.
 * The game initializes in the background so the 3D scene is visible
 * behind the semi-transparent lobby panel.
 *
 * Key concepts: overlay UI, z-index layering, network lifecycle
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { HUD } from './HUD.js';
import { Lobby } from './Lobby.js';
import { RaceResults } from './RaceResults.js';
import { TouchControls } from './TouchControls.js';
import { Settings } from './Settings.js';
import { Leaderboard } from './Leaderboard.js';
import { useGameStore } from './store.js';
import { Game } from '../engine/Game.js';
import { NetworkManager } from '../network/NetworkManager.js';

function ResultsOverlay({ onPlayAgain, onLeave }: { onPlayAgain: () => void; onLeave: () => void }) {
  const gamePhase = useGameStore((s) => s.gamePhase);
  const raceResults = useGameStore((s) => s.raceResults);

  if (gamePhase !== 'RESULTS' || raceResults.length === 0) return null;

  return <RaceResults results={raceResults} onPlayAgain={onPlayAgain} onLeave={onLeave} />;
}

export function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [network] = useState(() => new NetworkManager());
  const [showLobby, setShowLobby] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [networkReady, setNetworkReady] = useState(false);

  // Connect network on mount and expose globally for Game.ts
  useEffect(() => {
    network.connect();
    (window as any).__networkManager = network;
    const timer = setTimeout(() => setNetworkReady(true), 500);
    return () => {
      clearTimeout(timer);
      network.disconnect();
      delete (window as any).__networkManager;
    };
  }, [network]);

  // Init game engine
  useEffect(() => {
    const container = containerRef.current;
    if (!container || gameRef.current) return;

    const game = new Game();
    gameRef.current = game;
    game.init(container).catch(console.error);

    return () => {
      game.dispose();
      gameRef.current = null;
    };
  }, []);

  const handleGameStart = useCallback(() => {
    setShowLobby(false);
    // Trigger resize after lobby overlay is removed — fixes mobile black screen
    setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
    setTimeout(() => window.dispatchEvent(new Event('resize')), 200);
    setTimeout(() => window.dispatchEvent(new Event('resize')), 500);
  }, []);
  const handleSkipLobby = useCallback(() => {
    setShowLobby(false);
    setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
    setTimeout(() => window.dispatchEvent(new Event('resize')), 200);
    setTimeout(() => window.dispatchEvent(new Event('resize')), 500);
  }, []);

  return (
    <div ref={containerRef} style={{
      width: '100vw', height: '100dvh', position: 'relative', overflow: 'hidden',
      background: '#000',
    }}>
      {/* Lobby overlay — renders ON TOP of the 3D canvas */}
      {showLobby && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1000,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0, 0, 0, 0.55)',
          pointerEvents: 'auto',
          overflowY: 'auto',
          padding: '40px 16px',
        }}>
          <div style={{ flex: '0 0 auto', width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {networkReady ? (
              <Lobby network={network} onGameStart={handleGameStart} />
            ) : (
              <div style={{ color: '#fff', fontSize: 18, opacity: 0.6 }}>
                Connecting to server...
              </div>
            )}

            <button
              onClick={handleSkipLobby}
              style={{
                marginTop: 16,
                padding: '12px 40px', borderRadius: 10, border: '1px solid rgba(0,255,255,0.2)',
                background: 'rgba(0, 255, 255, 0.06)', color: '#00cccc',
                cursor: 'pointer', fontSize: 14, backdropFilter: 'blur(4px)',
                fontWeight: 700, letterSpacing: 2,
                boxShadow: '0 0 15px rgba(0,255,255,0.08)',
                transition: 'all 0.2s',
              }}
            >
              SOLO MODE
            </button>
          </div>
        </div>
      )}

      {/* HUD shows only when not in lobby */}
      {!showLobby && <HUD />}

      {/* Touch controls for mobile */}
      {!showLobby && <TouchControls />}

      {/* Top-right toolbar — Leaderboard + Settings */}
      <div style={{
        position: 'absolute', top: 10, right: 14, zIndex: 1500,
        display: 'flex', gap: 6, pointerEvents: 'auto',
      }}>
        <button
          onClick={() => setShowLeaderboard(true)}
          style={{
            width: 36, height: 36, borderRadius: 8, border: 'none',
            background: 'rgba(0, 0, 0, 0.5)', color: '#FFD700',
            cursor: 'pointer', fontSize: 16, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(4px)',
            boxShadow: '0 0 8px rgba(255,215,0,0.12)',
            transition: 'all 0.2s',
          }}
          title="Leaderboard"
        >
          &#127942;
        </button>
        <button
          onClick={() => setShowSettings(true)}
          style={{
            width: 36, height: 36, borderRadius: 8, border: 'none',
            background: 'rgba(0, 0, 0, 0.5)', color: '#00ffff',
            cursor: 'pointer', fontSize: 17, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(4px)',
            boxShadow: '0 0 8px rgba(0,255,255,0.12)',
            transition: 'all 0.2s',
          }}
          title="Settings"
        >
          &#9881;
        </button>
      </div>

      {/* Settings overlay */}
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}

      {/* Leaderboard overlay */}
      {showLeaderboard && <Leaderboard onClose={() => setShowLeaderboard(false)} />}

      {/* Results screen overlay */}
      <ResultsOverlay onPlayAgain={() => window.location.reload()} onLeave={() => window.location.reload()} />
    </div>
  );
}
