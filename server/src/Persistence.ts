/**
 * LEARNING NOTE: SQLite Persistence Layer (better-sqlite3)
 *
 * SQLite is a file-based database — no separate server process needed.
 * The entire database lives in a single file (neondrift.db). This is
 * perfect for small-to-medium games: free, zero-config, and deployable
 * on any platform. better-sqlite3 is synchronous, which is actually
 * faster for SQLite since it avoids async overhead on a single-file DB.
 *
 * We store leaderboard entries (race completions) and query the top N
 * fastest times. The database auto-creates on first run.
 *
 * Key concepts: SQLite, file-based DB, prepared statements, migrations
 * Further reading: https://github.com/WiseLibs/better-sqlite3
 */

import Database from 'better-sqlite3';
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
  private db: Database.Database;

  // Prepared statements for performance (compiled once, executed many times)
  private insertStmt: Database.Statement;
  private topNStmt: Database.Statement;
  private countStmt: Database.Statement;
  private clearStmt: Database.Statement;

  constructor() {
    this.db = new Database(DB_PATH);

    // Enable WAL mode for better concurrent read/write performance
    this.db.pragma('journal_mode = WAL');

    // Create table if it doesn't exist (auto-migration)
    this.db.exec(`
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
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_leaderboard_time ON leaderboard (time ASC)
    `);

    // Prepare statements
    this.insertStmt = this.db.prepare(
      'INSERT INTO leaderboard (name, vehicleId, laps, time, date) VALUES (?, ?, ?, ?, ?)'
    );

    this.topNStmt = this.db.prepare(
      'SELECT id, name, vehicleId, laps, time, date FROM leaderboard ORDER BY time ASC LIMIT ?'
    );

    this.countStmt = this.db.prepare(
      'SELECT COUNT(*) as count FROM leaderboard'
    );

    this.clearStmt = this.db.prepare(
      'DELETE FROM leaderboard'
    );

    console.log(`Database initialized at ${DB_PATH}`);
  }

  /** Save a race completion to the leaderboard */
  saveRaceTime(name: string, vehicleId: string, laps: number, time: number): void {
    const date = new Date().toISOString();
    this.insertStmt.run(name, vehicleId, laps, time, date);
  }

  /** Get the top N fastest times (default 10) */
  getTopTimes(limit: number = 10): LeaderboardRow[] {
    return this.topNStmt.all(limit) as LeaderboardRow[];
  }

  /** Get total race count */
  getRaceCount(): number {
    const row = this.countStmt.get() as { count: number };
    return row.count;
  }

  /** Clear all leaderboard data */
  clearAll(): void {
    this.clearStmt.run();
  }

  /** Close the database connection */
  close(): void {
    this.db.close();
  }
}
