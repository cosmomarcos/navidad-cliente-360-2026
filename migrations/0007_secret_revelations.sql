-- v1.5.0: registra la primera revelación individual de cada participante.
-- Ocultar la asignación en pantalla no elimina este registro.
CREATE TABLE IF NOT EXISTS draw_revelations (
  edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  revealed_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (edition_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_draw_revelations_edition
  ON draw_revelations(edition_id, revealed_at);
