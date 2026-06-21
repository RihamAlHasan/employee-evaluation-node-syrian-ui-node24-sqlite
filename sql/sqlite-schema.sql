-- SQLite runtime uses AppState as a durable serialized store so the app can run in Codex without SQL Server.
CREATE TABLE IF NOT EXISTS AppState (
  Id INTEGER PRIMARY KEY CHECK (Id = 1),
  Json TEXT NOT NULL,
  UpdatedAt TEXT NOT NULL
);
