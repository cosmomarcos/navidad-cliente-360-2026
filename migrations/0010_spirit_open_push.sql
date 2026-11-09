-- Control idempotente para la notificación de apertura de cada reto.
CREATE TABLE IF NOT EXISTS spirit_challenge_open_notifications (
  challenge_id TEXT PRIMARY KEY REFERENCES spirit_challenges(id) ON DELETE CASCADE,
  edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE,
  notified_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- No enviar avisos retroactivos por retos que ya estaban abiertos al desplegar.
INSERT OR IGNORE INTO spirit_challenge_open_notifications (challenge_id, edition_id)
SELECT id, edition_id FROM spirit_challenges WHERE starts_at <= datetime('now');
