-- ============================================================
-- Unique nickname per pool (closes the join-race TOCTOU window)
-- ============================================================
-- Context: when an organiser drops one invite link in a WhatsApp group and
-- many people tap it at once, the app checks "is this nickname free?" and then
-- inserts the new user. Those two steps are not atomic, so two people picking
-- the SAME nickname at the SAME moment can both pass the check and both insert.
--
-- This migration enforces uniqueness at the database level so the second insert
-- fails cleanly (Postgres error 23505) instead of creating a duplicate. The app
-- (completeRegistration) now catches 23505 and sends the loser back to pick a
-- different name.
--
-- Case-SENSITIVE on purpose, to match the app's exact `.eq('nickname', ...)`
-- availability check (so the DB and the UI agree on what "taken" means).
--
-- Safe to run on existing data: any pre-existing duplicates are renamed first
-- (the earliest row keeps the name; later ones get a -2, -3, ... suffix), then
-- the unique index is created. Idempotent — re-running is a no-op.
-- Run this in the Supabase SQL editor.
-- ============================================================

-- 1) Resolve any pre-existing duplicate (pool_id, nickname) pairs.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY pool_id, nickname ORDER BY id) AS rn
  FROM users
)
UPDATE users u
SET nickname = u.nickname || '-' || r.rn
FROM ranked r
WHERE u.id = r.id
  AND r.rn > 1;

-- 2) Enforce uniqueness going forward.
CREATE UNIQUE INDEX IF NOT EXISTS users_pool_nickname_unique
  ON users (pool_id, nickname);
