-- Preserve administrator-disabled participants without treating them as withdrawals.
CREATE TABLE edition_members_new (
  id TEXT PRIMARY KEY,
  edition_id TEXT NOT NULL REFERENCES editions(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'confirmed'
    CHECK(status IN ('invited','confirmed','inactive','withdrawn')),
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(edition_id, user_id)
);

INSERT INTO edition_members_new (id, edition_id, user_id, status, joined_at)
SELECT id, edition_id, user_id, status, joined_at
FROM edition_members;

DROP TABLE edition_members;
ALTER TABLE edition_members_new RENAME TO edition_members;

CREATE INDEX IF NOT EXISTS idx_edition_members_edition ON edition_members(edition_id);
