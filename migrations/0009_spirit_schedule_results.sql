-- Estado para rachas de primer lugar y cierre/notificación idempotente de retos.
CREATE TABLE IF NOT EXISTS spirit_leader_streaks (
  edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  last_first_date TEXT,
  PRIMARY KEY (edition_id, user_id)
);
CREATE TABLE IF NOT EXISTS spirit_challenge_results (
  challenge_id TEXT PRIMARY KEY REFERENCES spirit_challenges(id) ON DELETE CASCADE,
  edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE,
  processed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- Evita enviar notificaciones retroactivas por retos que ya habían terminado antes de activar esta versión.
INSERT OR IGNORE INTO spirit_challenge_results (challenge_id, edition_id)
SELECT id, edition_id FROM spirit_challenges WHERE ends_at <= datetime('now');
