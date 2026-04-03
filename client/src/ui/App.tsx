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

  const handleGameStart = useCallback(() => setShowLobby(false), []);
  const handleSkipLobby = useCallback(() => setShowLobby(false), []);

  return (
    <div ref={containerRef} style={{
      width: '100%', height: '100%', position: 'relative', overflow: 'hidden',
    }}>
      {/* Lobby overlay — renders ON TOP of the 3D canvas */}
      {showLobby && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1000,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0, 0, 0, 0.55)',
          pointerEvents: 'auto',
        }}>
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
              marginTop: 20,
              padding: '12px 32px', borderRadius: 8, border: 'none',
              background: 'rgba(255,255,255,0.12)', color: '#fff',
              cursor: 'pointer', fontSize: 14, backdropFilter: 'blur(4px)',
              fontWeight: 600, letterSpacing: 1,
            }}
          >
            SOLO MODE
          </button>
        </div>
      )}

      {/* HUD shows only when not in lobby */}
      {!showLobby && <HUD />}

      {/* Results screen overlay */}
      <ResultsOverlay onPlayAgain={() => window.location.reload()} onLeave={() => window.location.reload()} />
    </div>
  );
}
