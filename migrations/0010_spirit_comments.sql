CREATE TABLE IF NOT EXISTS spirit_comments (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES spirit_submissions(id) ON DELETE CASCADE,
  edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_spirit_comments_submission
  ON spirit_comments(submission_id, created_at);
