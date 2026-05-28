-- ============================================================
-- Track where each signup came from
-- ============================================================
-- Adds 5 nullable columns to users so the app can record the source of every
-- new signup (admin or joiner). Captured client-side on first visit from
-- document.referrer + UTM params; classified into a short label.
-- Idempotent; safe to re-run.

ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_source TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_referrer TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS utm_source TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS utm_medium TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS utm_campaign TEXT;

CREATE INDEX IF NOT EXISTS idx_users_signup_source ON users(signup_source);
