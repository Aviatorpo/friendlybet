-- DIAGNOSTIC ONLY (no changes). Run in the Supabase SQL editor and send me the
-- two result rows. Tells us why get_public_bracket() still returns [] even
-- though it's SECURITY DEFINER: is RLS *forced* on the table, who owns the
-- table, who owns the function.

select c.relname                       as table_name,
       c.relrowsecurity                as rls_enabled,
       c.relforcerowsecurity           as rls_forced,
       pg_get_userbyid(c.relowner)     as table_owner
from   pg_class c
join   pg_namespace n on n.oid = c.relnamespace
where  n.nspname = 'public' and c.relname = 'knockout_picks';

select p.proname                       as function_name,
       pg_get_userbyid(p.proowner)     as function_owner,
       p.prosecdef                     as is_security_definer
from   pg_proc p
join   pg_namespace n on n.oid = p.pronamespace
where  n.nspname = 'public' and p.proname = 'get_public_bracket';
