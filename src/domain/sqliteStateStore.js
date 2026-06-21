const fs = require('fs');
const path = require('path');
const { InMemoryStore } = require('./store');

/**
 * SQLite persistence using Node.js built-in sqlite module.
 * This avoids native npm packages such as better-sqlite3/sqlite3, so npm install
 * does not need Visual Studio C++ Build Tools.
 * Works on Node.js versions that provide node:sqlite, including Node 24.
 */
class SQLiteStateStore extends InMemoryStore {
  constructor(filePath) {
    super();
    this.filePath = path.resolve(filePath || './data/employee-evaluation.sqlite');
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });

    let DatabaseSync;
    try {
      ({ DatabaseSync } = require('node:sqlite'));
    } catch (error) {
      throw new Error('node:sqlite غير متوفر في نسخة Node الحالية. استخدمي Node 24 أو سيعمل النظام على الذاكرة فقط.');
    }

    this.db = new DatabaseSync(this.filePath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS AppState (
        Id INTEGER PRIMARY KEY CHECK (Id = 1),
        Json TEXT NOT NULL,
        UpdatedAt TEXT NOT NULL
      )
    `);

    const row = this.db.prepare('SELECT Json FROM AppState WHERE Id = 1').get();
    if (row && row.Json) {
      const state = JSON.parse(row.Json);
      this.tables = state.tables;
      this.ids = state.ids;
    } else {
      this.persist();
    }
  }

  persist() {
    if (!this.db) return;
    this.db.prepare(`
      INSERT INTO AppState (Id, Json, UpdatedAt)
      VALUES (1, ?, ?)
      ON CONFLICT(Id) DO UPDATE SET
        Json = excluded.Json,
        UpdatedAt = excluded.UpdatedAt
    `).run(JSON.stringify({ tables: this.tables, ids: this.ids }), new Date().toISOString());
  }

  reset() { super.reset(); this.persist?.(); }
  insert(table, row) { const r = super.insert(table, row); this.persist(); return r; }
  update(table, id, patch) { const r = super.update(table, id, patch); this.persist(); return r; }
}

module.exports = { SQLiteStateStore };
