PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  google_sub TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS workspace (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_user_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS memberships (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspace(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL DEFAULT 'participant' CHECK(role IN ('owner','organizer','participant')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS editions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspace(id),
  title TEXT NOT NULL,
  year INTEGER NOT NULL,
  budget_amount REAL,
  currency TEXT NOT NULL DEFAULT 'PEN',
  event_date TEXT,
  status TEXT NOT NULL DEFAULT 'setup'
    CHECK(status IN ('setup','registration','drawn','completed','cancelled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(workspace_id, year)
);

CREATE TABLE IF NOT EXISTS invitations (
  id TEXT PRIMARY KEY,
  edition_id TEXT NOT NULL REFERENCES editions(id),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT,
  max_uses INTEGER NOT NULL DEFAULT 1,
  uses INTEGER NOT NULL DEFAULT 0,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS edition_members (
  id TEXT PRIMARY KEY,
  edition_id TEXT NOT NULL REFERENCES editions(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'confirmed'
    CHECK(status IN ('invited','confirmed','withdrawn')),
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(edition_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_user ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_edition_members_edition ON edition_members(edition_id);
CREATE INDEX IF NOT EXISTS idx_invitations_edition ON invitations(edition_id);
