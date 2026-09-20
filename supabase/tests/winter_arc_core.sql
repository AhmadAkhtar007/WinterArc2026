begin;

do $$
declare rls_count integer;
begin
  select count(*) into rls_count from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname in ('profiles', 'challenges', 'completions', 'completion_reversals') and c.relrowsecurity;
  if rls_count <> 4 then raise exception 'Expected RLS on all four public tables'; end if;
end $$;

do $$
begin
  if has_table_privilege('anon', 'public.completions', 'INSERT') then raise exception 'Anon must not insert completions'; end if;
  if has_table_privilege('authenticated', 'public.completions', 'INSERT') then raise exception 'Authenticated users must score through RPC only'; end if;
  if not has_function_privilege('authenticated', 'public.complete_challenge(uuid)', 'EXECUTE') then raise exception 'Authenticated users need completion RPC'; end if;
  if has_function_privilege('anon', 'public.complete_challenge(uuid)', 'EXECUTE') then raise exception 'Anon must not execute completion RPC'; end if;
end $$;

rollback;

