-- Adds a photo URL column to players, populated by scripts/sync-player-photos.js
-- from Wikipedia (CC-BY-SA). Safe to re-run.

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS photo_source TEXT,
  ADD COLUMN IF NOT EXISTS photo_attribution TEXT,
  ADD COLUMN IF NOT EXISTS photo_synced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS players_photo_synced_at_idx
  ON players (photo_synced_at NULLS FIRST);
