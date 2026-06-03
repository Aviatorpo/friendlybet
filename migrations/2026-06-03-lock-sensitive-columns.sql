-- ============================================================
-- 2026-06-03  Column-level lockdown of users (partial RLS hardening)
-- ============================================================
-- WHY: the app has no Supabase Auth, so every browser request uses the public
-- anon role. A live probe confirmed the anon key could UPDATE any user's
-- total_score / points and set is_admin = true (leaderboard cheating + self-
-- promotion), and INSERT a user with a pre-set score. This migration removes
-- the anon (and authenticated) role's ability to WRITE the sensitive columns,
-- while keeping every column the client legitimately writes.
--
-- SAFE because:
--   * The scoring/sync GitHub Actions use the SERVICE ROLE key, which BYPASSES
--     these grants (and RLS) - so score writes keep working.
--   * The GRANT lists below cover every column the client actually writes
--     (verified in app.js): signup INSERT + admin-approve / recovery-code-
--     regen / predictions-submitted UPDATE.
--
-- DOES NOT fix (still possible via the public key - accepted for now, see
-- CLAUDE.md security note): reading recovery_code_hash; deleting pools/users;
-- creating a NEW user row with is_admin=true (admin signup needs INSERT(is_admin)).
--
-- Run in the Supabase SQL editor. Re-runnable (REVOKE/GRANT are idempotent).
-- ROLLBACK (if anything breaks): GRANT UPDATE, INSERT ON public.users TO anon, authenticated;
-- ============================================================

-- ---- UPDATE: drop blanket update, re-grant only client-written columns ----
REVOKE UPDATE ON public.users FROM anon, authenticated;
GRANT  UPDATE (
  nickname,
  recovery_code_hash,        -- user can regenerate their own recovery code
  is_approved,
  is_late_joiner,
  whatsapp_url,
  telegram_url,
  last_active_at,
  approval_status,           -- admin approve/reject (via anon - can't gate w/o identity)
  approved_at,
  approved_by,
  predictions_locked,
  predictions_submitted_at
) ON public.users TO anon, authenticated;
-- NOT granted (now blocked from the public key): total_score, group_score,
-- knockout_score, top_scorer_score, groups_score, bonus_score, group_points,
-- knockout_points, bonus_points, last_score_calc, is_admin.

-- ---- INSERT: drop blanket insert, re-grant only signup columns ----
REVOKE INSERT ON public.users FROM anon, authenticated;
GRANT  INSERT (
  pool_id,
  nickname,
  recovery_code_hash,
  is_admin,                  -- admin signup creates the first admin row
  is_approved,
  approval_status,
  approved_at,
  signup_source,
  signup_referrer,
  utm_source,
  utm_medium,
  utm_campaign,
  country
) ON public.users TO anon, authenticated;
-- NOT granted on INSERT (blocked): every score/points column -> can't create a
-- pre-scored user to top a leaderboard.
