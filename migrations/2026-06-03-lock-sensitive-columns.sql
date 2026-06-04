-- ============================================================
-- 2026-06-03  Column-level write hardening for public.users
-- ============================================================
-- ⚠️ SUPERSEDED by the Phase-2 RPC-gateway lockdown (2026-06-04). Once the big
--    REVOKE (revoke insert/update/delete on public.users from anon) is applied
--    and the client is wired to the create_pool/join_pool/approve_member/
--    regenerate_recovery_code/... RPCs, this file is OBSOLETE. **DO NOT RE-RUN IT
--    AFTER THE LOCKDOWN** — its GRANTs below re-open anon `is_admin` INSERT and
--    `recovery_code_hash` UPDATE (account-takeover + admin escalation). Kept only
--    for historical/rollback reference.
-- ============================================================
-- Tightens column-level write privileges so score / standing columns and the
-- admin flag are written by trusted server jobs only, not by the public client
-- role. The client keeps writing exactly the columns it needs (signup +
-- approve / recovery-code regen / predictions-submitted).
--
-- SAFE: the scoring/sync GitHub Actions use the SERVICE ROLE key, which bypasses
-- these grants, so score calculation is unaffected. The GRANT lists below were
-- derived from the actual client writes in app.js.
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
