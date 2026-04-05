/**
 * LEARNING NOTE: SQLite Persistence Layer (sql.js — Pure WASM)
 *
 * sql.js is SQLite compiled to WebAssembly — it runs everywhere without
 * native compilation. Unlike better-sqlite3 (which needs a C++ binary
 * compiled per platform), sql.js works on any OS, any architecture,
 * and any hosting provider (Render, Vercel, Railway, etc.) without
 * build errors.
 *
 * Trade-off: sql.js is async to initialize (loads WASM), and we must
 * manually save the database to disk since it runs in-memory by default.
 * We auto-save after every write operation.
 *
 * Key concepts: WASM SQLite, cross-platform persistence, file-backed DB
 * Further reading: https://github.com/sql-js/sql.js
 */

import initSqlJs from 'sql.js';
import type { Database as SqlJsDatabase } from 'sql.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Store the DB file next to the server code (or use env var for production)
const DB_PATH = process.env.DB_PATH || join(__dirname, '../../neondrift.db');

export interface LeaderboardRow {
  id: number;
  name: string;
  vehicleId: string;
  laps: number;
  time: number;
  date: string;
}

export class Persistence {
  private db: SqlJsDatabase | null = null;
  private dirty = false;

  /** Initialize the database (must be called before any other method) */
  async init(): Promise<void> {
    const SQL = await initSqlJs();

    // Ensure directory exists
    const dir = dirname(DB_PATH);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Load existing database file if it exists
    if (existsSync(DB_PATH)) {
      try {
        const fileBuffer = readFileSync(DB_PATH);
        this.db = new SQL.Database(fileBuffer);
      } catch {
        // Corrupted file — start fresh
        this.db = new SQL.Database();
      }
    } else {
      this.db = new SQL.Database();
    }

    // Create table if it doesn't exist
    this.db.run(`
      CREATE TABLE IF NOT EXISTS leaderboard (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        name      TEXT    NOT NULL,
        vehicleId TEXT    NOT NULL DEFAULT 'ronin',
        laps      INTEGER NOT NULL DEFAULT 3,
        time      REAL    NOT NULL,
        date      TEXT    NOT NULL
      )
    `);

    // Create index on time for fast top-N queries
    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_leaderboard_time ON leaderboard (time ASC)
    `);

    this.saveToDisk();
    console.log(`Database initialized at ${DB_PATH}`);
  }

  /** Save a race completion to the leaderboard */
  saveRaceTime(name: string, vehicleId: string, laps: number, time: number): void {
    if (!this.db) return;
    const date = new Date().toISOString();
    this.db.run(
      'INSERT INTO leaderboard (name, vehicleId, laps, time, date) VALUES (?, ?, ?, ?, ?)',
      [name, vehicleId, laps, time, date],
    );
    this.saveToDisk();
  }

  /** Get the top N fastest times (default 10) */
  getTopTimes(limit: number = 10): LeaderboardRow[] {
    if (!this.db) return [];
    const stmt = this.db.prepare(
      'SELECT id, name, vehicleId, laps, time, date FROM leaderboard ORDER BY time ASC LIMIT ?',
    );
    stmt.bind([limit]);

    const results: LeaderboardRow[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject() as unknown as LeaderboardRow;
      results.push(row);
    }
    stmt.free();
    return results;
  }

  /** Get total race count */
  getRaceCount(): number {
    if (!this.db) return 0;
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM leaderboard');
    stmt.step();
    const row = stmt.getAsObject() as { count: number };
    stmt.free();
    return row.count;
  }

  /** Clear all leaderboard data */
  clearAll(): void {
    if (!this.db) return;
    this.db.run('DELETE FROM leaderboard');
    this.saveToDisk();
  }

  /** Persist the in-memory database to disk */
  private saveToDisk(): void {
    if (!this.db) return;
    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      writeFileSync(DB_PATH, buffer);
    } catch (err) {
      console.error('Failed to save database to disk:', err);
    }
  }

  /** Close the database connection */
  close(): void {
    if (this.db) {
      this.saveToDisk();
      this.db.close();
      this.db = null;
    }
  }
}
