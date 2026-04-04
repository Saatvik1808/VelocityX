/**
 * LEARNING NOTE: Persistent Leaderboard (localStorage)
 *
 * Since we don't have a backend database, we use the browser's localStorage
 * to persist race times across sessions. Each entry stores the player name,
 * vehicle used, lap count, and total time. We keep the top 10 fastest times
 * sorted ascending. The leaderboard shows in the lobby and after race results.
 *
 * Key concepts: localStorage persistence, sorted rankings, client-side storage
 */

import { useState, useEffect } from 'react';

// === Leaderboard Data Layer ===

export interface LeaderboardEntry {
  id?: number;
  name: string;
  vehicleId: string;
  laps: number;
  time: number;       // seconds
  date: string;        // ISO string
}

const STORAGE_KEY = 'neondrift_leaderboard';
const MAX_ENTRIES = 10;

/** Load leaderboard from localStorage as fallback, sorted fastest first */
function loadLocalLeaderboard(): LeaderboardEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const entries: LeaderboardEntry[] = JSON.parse(raw);
    return entries.sort((a, b) => a.time - b.time).slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

/** Save a new time to localStorage (fallback). */
function saveLocalLeaderboard(entry: LeaderboardEntry): void {
  const entries = loadLocalLeaderboard();
  entries.push(entry);
  entries.sort((a, b) => a.time - b.time);
  const trimmed = entries.slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage full or unavailable
  }
}

/**
 * Fetch leaderboard from server API. Falls back to localStorage if
 * the server is unreachable (e.g., solo/offline mode).
 */
export async function loadLeaderboard(): Promise<LeaderboardEntry[]> {
  try {
    const resp = await fetch('/api/leaderboard?limit=10');
    if (resp.ok) {
      const data = await resp.json();
      return data.entries ?? [];
    }
  } catch {
    // Server unreachable — fall back to localStorage
  }
  return loadLocalLeaderboard();
}

/** Save a new time — writes to both localStorage (instant) and server (on finish). */
export function saveToLeaderboard(entry: LeaderboardEntry): void {
  saveLocalLeaderboard(entry);
  // Server save happens via CLIENT_FINISHED socket event in Game.ts
}

/** Clear localStorage leaderboard data */
export function clearLeaderboard(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// === Leaderboard UI Component ===

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(2).padStart(5, '0')}`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  } catch {
    return '';
  }
}

const medals = ['🥇', '🥈', '🥉'];
const medalColors = ['#FFD700', '#C0C0C0', '#CD7F32'];

interface LeaderboardProps {
  onClose: () => void;
  /** If provided, this time will be highlighted (just-finished race) */
  highlightTime?: number;
}

export function Leaderboard({ onClose, highlightTime }: LeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLeaderboard().then((data) => {
      setEntries(data);
      setLoading(false);
    });
  }, []);

  const handleClear = () => {
    clearLeaderboard();
    setEntries([]);
  };

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
        width: 440,
        maxHeight: '80vh',
        overflowY: 'auto',
        color: '#fff',
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        boxShadow: '0 0 40px rgba(0, 255, 255, 0.1)',
      }}>
        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{
            fontSize: 24, fontWeight: 900, letterSpacing: 4,
            background: 'linear-gradient(135deg, #FFD700, #00ffff)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            LEADERBOARD
          </div>
          <div style={{ fontSize: 11, opacity: 0.4, letterSpacing: 2, marginTop: 4 }}>
            TOP {MAX_ENTRIES} FASTEST TIMES
          </div>
        </div>

        {/* Column headers */}
        {entries.length > 0 && (
          <div style={{
            display: 'grid', gridTemplateColumns: '36px 1fr 70px 80px',
            gap: 8, padding: '0 12px', marginBottom: 6,
            fontSize: 9, opacity: 0.35, textTransform: 'uppercase', letterSpacing: 1,
            fontWeight: 700,
          }}>
            <div>#</div>
            <div>Racer</div>
            <div style={{ textAlign: 'right' }}>Car</div>
            <div style={{ textAlign: 'right' }}>Time</div>
          </div>
        )}

        {/* Entries */}
        {loading ? (
          <div style={{
            textAlign: 'center', padding: '40px 20px',
            opacity: 0.4, fontSize: 14,
          }}>
            Loading leaderboard...
          </div>
        ) : entries.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '40px 20px',
            opacity: 0.3, fontSize: 14,
          }}>
            No races completed yet.
            <br />
            <span style={{ fontSize: 12 }}>Finish a race to set your first time!</span>
          </div>
        ) : (
          entries.map((entry, i) => {
            const isHighlighted = highlightTime !== undefined &&
              Math.abs(entry.time - highlightTime) < 0.01;
            const isMedal = i < 3;

            return (
              <div key={`${entry.date}-${i}`} style={{
                display: 'grid', gridTemplateColumns: '36px 1fr 70px 80px',
                gap: 8, alignItems: 'center',
                padding: '10px 12px', margin: '4px 0', borderRadius: 10,
                background: isHighlighted
                  ? 'rgba(0, 255, 255, 0.1)'
                  : isMedal
                    ? `${medalColors[i]}0A`
                    : 'rgba(255,255,255,0.02)',
                border: isHighlighted
                  ? '1px solid rgba(0, 255, 255, 0.3)'
                  : isMedal
                    ? `1px solid ${medalColors[i]}18`
                    : '1px solid transparent',
                boxShadow: isHighlighted ? '0 0 15px rgba(0,255,255,0.15)' : 'none',
                transition: 'all 0.2s',
              }}>
                {/* Position */}
                <div style={{
                  fontSize: isMedal ? 20 : 14,
                  fontWeight: 800,
                  textAlign: 'center',
                  color: medalColors[i] ?? '#555',
                }}>
                  {isMedal ? medals[i] : `${i + 1}`}
                </div>

                {/* Name + Date */}
                <div>
                  <div style={{
                    fontSize: 14, fontWeight: 700,
                    color: isHighlighted ? '#00ffff' : '#ddd',
                  }}>
                    {entry.name}
                    {isHighlighted && (
                      <span style={{
                        fontSize: 9, marginLeft: 8, padding: '2px 6px',
                        borderRadius: 4, background: 'rgba(0,255,255,0.15)',
                        color: '#00ffff', fontWeight: 800, letterSpacing: 1,
                        verticalAlign: 'middle',
                      }}>
                        NEW
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 10, opacity: 0.3 }}>
                    {formatDate(entry.date)} &middot; {entry.laps} laps
                  </div>
                </div>

                {/* Vehicle */}
                <div style={{
                  fontSize: 10, fontWeight: 700, textAlign: 'right',
                  color: '#888', textTransform: 'uppercase', letterSpacing: 1,
                }}>
                  {entry.vehicleId}
                </div>

                {/* Time */}
                <div style={{
                  fontFamily: 'monospace', fontSize: 16, fontWeight: 700,
                  textAlign: 'right',
                  color: isMedal ? medalColors[i] : '#aaa',
                }}>
                  {formatTime(entry.time)}
                </div>
              </div>
            );
          })
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          {entries.length > 0 && (
            <button onClick={handleClear} style={{
              flex: 1, padding: '10px', borderRadius: 10, border: 'none',
              background: 'rgba(255, 50, 50, 0.08)', color: '#ff6666',
              cursor: 'pointer', fontWeight: 600, fontSize: 12,
              letterSpacing: 1, transition: 'all 0.2s',
            }}>
              CLEAR ALL
            </button>
          )}
          <button onClick={onClose} style={{
            flex: 2, padding: '12px', borderRadius: 10, border: 'none',
            background: 'rgba(255,255,255,0.06)', color: '#ccc',
            cursor: 'pointer', fontWeight: 700, fontSize: 14,
            letterSpacing: 2, transition: 'all 0.2s',
          }}>
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}
