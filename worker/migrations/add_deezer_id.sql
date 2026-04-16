-- Add deezer_id column to artists table for faster catalog builds
-- (skip name search for artists that already have a Deezer ID)
ALTER TABLE artists ADD COLUMN deezer_id INTEGER DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_artists_deezer_id ON artists(deezer_id);
