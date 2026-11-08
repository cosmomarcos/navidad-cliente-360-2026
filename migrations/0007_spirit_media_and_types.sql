-- Espíritu Navideño 1.4.0: formatos de retos y medios de participación.
ALTER TABLE spirit_challenges ADD COLUMN challenge_type TEXT NOT NULL DEFAULT 'text';
ALTER TABLE spirit_challenges ADD COLUMN config_json TEXT;
ALTER TABLE spirit_submissions ADD COLUMN media_data TEXT;
ALTER TABLE spirit_submissions ADD COLUMN media_type TEXT;
