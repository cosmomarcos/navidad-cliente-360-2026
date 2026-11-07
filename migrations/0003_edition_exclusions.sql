-- Restricciones mutuas entre participantes de una edición.
CREATE TABLE IF NOT EXISTS edition_exclusions (
  id TEXT PRIMARY KEY,
  edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE,
  user_a_id TEXT NOT NULL REFERENCES users(id),
  user_b_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK(user_a_id <> user_b_id),
  UNIQUE(edition_id, user_a_id, user_b_id)
);
CREATE INDEX IF NOT EXISTS idx_exclusions_edition ON edition_exclusions(edition_id);
