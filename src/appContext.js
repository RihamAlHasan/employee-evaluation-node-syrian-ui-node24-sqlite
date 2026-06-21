const { createEvaluationService, InMemoryStore } = require('./domain/store');
let store;
if ((process.env.DB_PROVIDER || 'sqlite').toLowerCase() === 'sqlite') {
  try {
    const { SQLiteStateStore } = require('./domain/sqliteStateStore');
    store = new SQLiteStateStore(process.env.SQLITE_PATH || './data/employee-evaluation.sqlite');
  } catch (e) {
    console.warn('SQLite غير متاح، سيتم استخدام الذاكرة مؤقتاً:', e.message);
    store = new InMemoryStore();
  }
} else {
  // SQL Server schema is provided under sql/sqlserver-schema.sql.
  // Runtime falls back to the same service layer so Codex can test without an external server.
  store = new InMemoryStore();
}
const service = createEvaluationService(store);
let seeded = store.all('employees').length > 0;
async function ensureSeeded() { if (!seeded) { await service.seedDemo(); seeded = true; } return service; }
module.exports = { service, ensureSeeded };
