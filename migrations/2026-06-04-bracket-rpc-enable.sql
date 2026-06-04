-- LIKELY FIX for get_public_bracket() returning []. The security hardening put
-- RLS on knockout_picks so anon can't read it directly (correct). But if RLS is
-- *FORCED*, even the table owner -- and therefore the SECURITY DEFINER function
-- running as that owner -- is still subject to the policies, so the function
-- reads nothing.
--
-- NO FORCE lets the table OWNER bypass RLS again. It does NOT grant anon any
-- direct access: anon is not the owner, so anon is still fully governed by RLS
-- policies (and there is no anon SELECT policy). This only re-enables the
-- definer-gated read path you chose.
--
-- (Belt-and-suspenders: make sure the function is owned by postgres, the table
-- owner in Supabase, so the owner-bypass actually applies.)

alter table public.knockout_picks no force row level security;
alter function public.get_public_bracket(uuid, uuid) owner to postgres;

notify pgrst, 'reload schema';
