-- ============================================================
-- FriendlyBet - Feedback / Contact-us table
-- ============================================================
-- Stores in-app feedback submitted via the "Send feedback" modal.
-- Public (anon) clients may INSERT only; reading is restricted to the
-- service key (used by scripts/notify-feedback.js), so one user can
-- never read another user's feedback.
--
-- Idempotent: safe to re-run. Run ONCE in the Supabase SQL editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS feedback (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NULL,                 -- set when the sender is logged in (no FK: keep feedback if the user is deleted)
  pool_code   text NULL,                 -- the pool the user was in, if any
  category    text NOT NULL DEFAULT 'other'
              CHECK (category IN ('bug','idea','praise','other')),
  message     text NOT NULL,
  reply_email text NULL,                  -- optional, so we can reply
  app_version text NULL,
  language    text NULL,                  -- 'he' | 'en'
  screen      text NULL,                  -- the screen the modal was opened from
  user_agent  text NULL,
  notified_at timestamptz NULL,           -- set by notify-feedback.js once Eyal has been emailed
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_unnotified
  ON feedback (created_at) WHERE notified_at IS NULL;

-- Length guard so the textarea can't be abused to store huge blobs.
ALTER TABLE feedback DROP CONSTRAINT IF EXISTS feedback_message_len;
ALTER TABLE feedback ADD CONSTRAINT feedback_message_len
  CHECK (char_length(message) BETWEEN 1 AND 4000);

-- ------------------------------------------------------------
-- RLS: anon may INSERT, nobody may SELECT/UPDATE/DELETE via the
-- public key. The service key bypasses RLS for the notifier.
-- ------------------------------------------------------------
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS feedback_anon_insert ON feedback;
CREATE POLICY feedback_anon_insert ON feedback
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Verify
SELECT COUNT(*) AS feedback_rows FROM feedback;
