-- Espíritu Navideño 2026: retos, publicaciones, votos y puntos.
CREATE TABLE IF NOT EXISTS spirit_challenges (
  id TEXT PRIMARY KEY,
  edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 10,
  bonus_points INTEGER NOT NULL DEFAULT 5,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_spirit_challenges_active ON spirit_challenges(edition_id, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS spirit_submissions (
  id TEXT PRIMARY KEY,
  edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE,
  challenge_id TEXT NOT NULL REFERENCES spirit_challenges(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  caption TEXT NOT NULL,
  image_data TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(challenge_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_spirit_submissions_challenge ON spirit_submissions(challenge_id, created_at);

CREATE TABLE IF NOT EXISTS spirit_votes (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES spirit_submissions(id) ON DELETE CASCADE,
  voter_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(submission_id, voter_user_id)
);

CREATE TABLE IF NOT EXISTS spirit_points (
  id TEXT PRIMARY KEY,
  edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  points INTEGER NOT NULL,
  description TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(edition_id, user_id, source_type, source_id)
);
CREATE INDEX IF NOT EXISTS idx_spirit_points_ranking ON spirit_points(edition_id, user_id);
