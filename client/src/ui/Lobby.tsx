/**
 * LEARNING NOTE: Multiplayer Lobby UI — Premium Design
 */

import { useState, useEffect } from 'react';
import type { NetworkManager } from '../network/NetworkManager.js';
import type { RoomSummary, RoomId } from '@neon-drift/shared';
import { VEHICLES, VEHICLE_IDS } from '@neon-drift/shared';
import type { VehicleDef } from '@neon-drift/shared';
import { useGameStore } from './store.js';

interface LobbyProps {
  network: NetworkManager;
  onGameStart: () => void;
}

export function Lobby({ network, onGameStart }: LobbyProps) {
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [inRoom, setInRoom] = useState(false);
  const [playerName, setPlayerName] = useState('Racer');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isReady, setIsReady] = useState(false);
  const selectedVehicleId = useGameStore((s) => s.selectedVehicleId);
  const setSelectedVehicleId = useGameStore((s) => s.setSelectedVehicleId);

  useEffect(() => {
    network.onRoomList = (r) => setRooms(r);
    network.onRoomJoined = () => setInRoom(true);
    network.onCountdown = (s) => setCountdown(s);
    network.onRaceStart = () => onGameStart();
    network.listRooms();
    const interval = setInterval(() => network.listRooms(), 3000);
    return () => clearInterval(interval);
  }, [network, onGameStart]);

  const handleLeave = () => {
    network.leaveRoom();
    setInRoom(false);
    setIsReady(false);
    network.listRooms();
  };

  // === COUNTDOWN ===
  if (countdown !== null) {
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontSize: 140, fontWeight: 900, color: '#fff',
          textShadow: '0 0 60px rgba(255,200,0,0.6), 0 0 120px rgba(255,100,0,0.3)',
          lineHeight: 1,
        }}>
          {countdown === 0 ? 'GO!' : countdown}
        </div>
        <div style={{ fontSize: 18, opacity: 0.5, marginTop: 10, color: '#ccc' }}>
          Get ready to race!
        </div>
      </div>
    );
  }

  // === IN ROOM ===
  if (inRoom) {
    return (
      <div style={{
        background: 'rgba(10, 10, 20, 0.85)',
        backdropFilter: 'blur(16px)',
        borderRadius: 16,
        border: '1px solid rgba(255,255,255,0.08)',
        padding: '28px 32px',
        width: 400,
        color: '#fff',
        fontFamily: "'Segoe UI', system-ui, sans-serif",
      }}>
        {/* Room header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.4, textTransform: 'uppercase', letterSpacing: 2 }}>Room</div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: 3 }}>{network.currentRoom?.id}</div>
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: '8px 14px',
            fontSize: 13, opacity: 0.6,
          }}>
            {network.players.length} / {network.currentRoom?.maxPlayers} players
          </div>
        </div>

        {/* Player list */}
        <div style={{ marginBottom: 20 }}>
          {network.players.map(p => (
            <div key={p.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 16px', margin: '6px 0', borderRadius: 10,
              background: p.ready ? 'rgba(50, 200, 80, 0.12)' : 'rgba(255,255,255,0.04)',
              border: p.id === network.playerId ? '1px solid rgba(100,180,255,0.3)' : '1px solid transparent',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: p.id === network.playerId ? 'linear-gradient(135deg, #4488ff, #2266cc)' : 'rgba(255,255,255,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 700,
                }}>
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</div>
                  <div style={{ fontSize: 11, opacity: 0.4 }}>
                    {p.id === network.playerId ? 'You' : 'Player'}
                  </div>
                </div>
              </div>
              <div style={{
                fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6,
                background: p.ready ? 'rgba(50,200,80,0.2)' : 'rgba(255,200,0,0.1)',
                color: p.ready ? '#44dd66' : '#ddaa44',
              }}>
                {p.ready ? '✓ READY' : 'WAITING'}
              </div>
            </div>
          ))}
        </div>

        {/* Waiting message */}
        {isReady && (
          <div style={{
            textAlign: 'center', padding: '12px', borderRadius: 10,
            background: 'rgba(50,200,80,0.06)', border: '1px solid rgba(50,200,80,0.1)',
            fontSize: 13, color: '#88cc88', marginBottom: 16,
          }}>
            Waiting for all players...
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={handleLeave} style={{
            flex: 1, padding: '12px', borderRadius: 10, border: 'none',
            background: 'rgba(255,255,255,0.06)', color: '#999',
            cursor: 'pointer', fontWeight: 600, fontSize: 14,
            transition: 'all 0.2s',
          }}>
            ← LEAVE
          </button>
          {!isReady ? (
            <button onClick={() => { network.setReady(); setIsReady(true); }} style={{
              flex: 2, padding: '12px', borderRadius: 10, border: 'none',
              background: 'linear-gradient(135deg, #0088ff, #00ccff)',
              color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 15,
              boxShadow: '0 4px 20px rgba(34,204,85,0.3)',
              transition: 'all 0.2s',
            }}>
              READY UP
            </button>
          ) : (
            <div style={{
              flex: 2, padding: '12px', borderRadius: 10, textAlign: 'center',
              background: 'rgba(50,200,80,0.1)', color: '#44dd66',
              fontWeight: 700, fontSize: 15,
            }}>
              ✓ YOU'RE READY
            </div>
          )}
        </div>
      </div>
    );
  }

  // === MAIN LOBBY ===
  return (
    <div style={{
      background: 'rgba(10, 10, 20, 0.85)',
      backdropFilter: 'blur(16px)',
      borderRadius: 16,
      border: '1px solid rgba(255,255,255,0.08)',
      padding: '24px 28px',
      width: 420,
      color: '#fff',
      fontFamily: "'Segoe UI', system-ui, sans-serif",
    }}>
      {/* Title */}
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{
          fontSize: 32, fontWeight: 900, letterSpacing: 4,
          background: 'linear-gradient(135deg, #00ffff, #ff00ff, #ffaa00)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          textShadow: '0 0 40px rgba(0,255,255,0.3), 0 0 80px rgba(255,0,255,0.2)',
        }}>
          VELOCITYX
        </div>
        <div style={{ fontSize: 10, opacity: 0.4, marginTop: 2, letterSpacing: 3 }}>
          MULTIPLAYER RACING
        </div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          marginTop: 6, fontSize: 11,
          color: network.connected ? '#44dd66' : '#ff4444',
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: 3,
            background: network.connected ? '#44dd66' : '#ff4444',
          }} />
          {network.connected ? 'Connected' : 'Connecting...'}
        </div>
      </div>

      {/* Player name */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, opacity: 0.4, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>
          Your Name
        </div>
        <input
          type="text" value={playerName}
          onChange={e => setPlayerName(e.target.value)}
          style={{
            width: '100%', padding: '8px 12px', borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.04)', color: '#fff',
            fontSize: 14, fontWeight: 600, boxSizing: 'border-box',
            outline: 'none',
          }}
        />
      </div>

      {/* Vehicle selector */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, opacity: 0.4, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
          Select Vehicle
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {VEHICLE_IDS.map((vid) => {
            const v = VEHICLES[vid]!;
            const isSelected = selectedVehicleId === vid;
            const ar = Math.round(v.accentColor[0] * 255);
            const ag = Math.round(v.accentColor[1] * 255);
            const ab = Math.round(v.accentColor[2] * 255);
            const accentSolid = `rgb(${ar}, ${ag}, ${ab})`;
            return (
              <button
                key={vid}
                onClick={() => setSelectedVehicleId(vid)}
                style={{
                  padding: '8px 10px', borderRadius: 8, border: 'none',
                  color: '#ccc',
                  background: isSelected
                    ? `linear-gradient(135deg, rgba(${ar},${ag},${ab},0.13), rgba(${ar},${ag},${ab},0.06))`
                    : 'rgba(255,255,255,0.04)',
                  outline: isSelected ? `2px solid ${accentSolid}` : '2px solid transparent',
                  cursor: 'pointer', textAlign: 'left' as const, transition: 'all 0.2s',
                  boxShadow: isSelected ? `0 0 20px rgba(${ar},${ag},${ab},0.2)` : 'none',
                }}
              >
                <div style={{
                  fontSize: 12, fontWeight: 800, letterSpacing: 2, color: isSelected ? accentSolid : '#ccc',
                  marginBottom: 1,
                }}>
                  {v.name}
                </div>
                <div style={{ fontSize: 9, opacity: 0.45, color: '#aaa', lineHeight: 1.2 }}>
                  {v.description}
                </div>
                <div style={{
                  display: 'flex', gap: 3, marginTop: 4, flexWrap: 'wrap',
                }}>
                  {[
                    { label: 'SPD', val: v.topSpeedMult },
                    { label: 'ACC', val: v.accelMult },
                    { label: 'HND', val: v.handlingMult },
                    { label: 'DFT', val: v.driftMult },
                  ].map(({ label, val }) => (
                    <div key={label} style={{
                      fontSize: 8, padding: '1px 4px', borderRadius: 3,
                      background: `rgba(${ar},${ag},${ab},0.1)`, color: accentSolid,
                      fontWeight: 700,
                    }}>
                      {label} {val.toFixed(1)}x
                    </div>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Create room */}
      <button onClick={() => network.createRoom(4, 3)} style={{
        width: '100%', padding: '11px', borderRadius: 10, border: 'none',
        background: 'linear-gradient(135deg, #0088ff, #00ccff)',
        color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 14,
        boxShadow: '0 4px 15px rgba(0,200,255,0.25), 0 0 30px rgba(0,255,255,0.08)',
        marginBottom: 14, transition: 'all 0.2s',
      }}>
        + CREATE ROOM
      </button>

      {/* Room list */}
      <div style={{ fontSize: 10, opacity: 0.4, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
        Available Rooms
      </div>
      {rooms.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '16px', borderRadius: 8,
          background: 'rgba(255,255,255,0.02)', opacity: 0.3, fontSize: 13,
        }}>
          No rooms yet — create one!
        </div>
      ) : (
        rooms.map(room => (
          <div key={room.id} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 16px', margin: '6px 0', borderRadius: 10,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: 2 }}>{room.id}</div>
              <div style={{ fontSize: 11, opacity: 0.4 }}>
                {room.playerCount}/{room.maxPlayers} players · {room.phase}
              </div>
            </div>
            <button onClick={() => network.joinRoom(room.id, playerName)} style={{
              padding: '8px 20px', borderRadius: 8, border: 'none',
              background: 'linear-gradient(135deg, #0088ff, #00ccff)',
              color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13,
              transition: 'all 0.2s',
            }}>
              JOIN →
            </button>
          </div>
        ))
      )}
    </div>
  );
}
