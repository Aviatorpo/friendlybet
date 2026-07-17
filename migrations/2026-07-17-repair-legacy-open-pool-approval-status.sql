-- Repair legacy approval metadata for open pools.
--
-- Before the 2026-07-03 join_pool fix, some non-approval pools created members
-- with is_approved=true but approval_status='pending'. approval_status drives
-- member/admin UI, so those stale rows hide locked bracket viewing even though
-- the pool never required approval and the picks are present.
--
-- Scope:
--   - only pools where approve_before_betting is false
--   - only non-admin users already legacy-approved
--   - only rows still pending
--   - only users who joined before the 2026-07-03 fix

do $$
declare
  repaired_count integer;
begin
  update public.users u
  set approval_status = 'approved',
      approved_at = coalesce(u.approved_at, u.joined_at, now())
  from public.pools p
  where p.id = u.pool_id
    and coalesce(p.approve_before_betting, false) = false
    and u.is_admin = false
    and coalesce(u.is_approved, false) = true
    and u.approval_status = 'pending'
    and u.joined_at < timestamptz '2026-07-03 00:00:00+00';

  get diagnostics repaired_count = row_count;
  raise notice 'Repaired % legacy open-pool pending approval rows', repaired_count;
end
$$;
