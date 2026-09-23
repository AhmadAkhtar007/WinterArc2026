begin;

do $$
declare rls_count integer;
begin
  select count(*) into rls_count from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname in ('profiles', 'challenges', 'completions', 'completion_reversals', 'challenge_progress_entries') and c.relrowsecurity;
  if rls_count <> 5 then raise exception 'Expected RLS on all five public tables'; end if;
end $$;

do $$
begin
  if has_table_privilege('anon', 'public.completions', 'INSERT') then raise exception 'Anon must not insert completions'; end if;
  if has_table_privilege('authenticated', 'public.completions', 'INSERT') then raise exception 'Authenticated users must score through RPC only'; end if;
  if not has_function_privilege('authenticated', 'public.complete_challenge(uuid, text)', 'EXECUTE') then raise exception 'Authenticated users need completion RPC'; end if;
  if has_function_privilege('anon', 'public.complete_challenge(uuid, text)', 'EXECUTE') then raise exception 'Anon must not execute completion RPC'; end if;
  if not has_function_privilege('authenticated', 'public.uncomplete_challenge(uuid, text)', 'EXECUTE') then raise exception 'Authenticated users need uncomplete RPC'; end if;
  if has_function_privilege('anon', 'public.uncomplete_challenge(uuid, text)', 'EXECUTE') then raise exception 'Anon must not execute uncomplete RPC'; end if;
  if not has_function_privilege('authenticated', 'public.record_challenge_progress(uuid, integer, text)', 'EXECUTE') then raise exception 'Authenticated users need progress RPC'; end if;
  if has_function_privilege('anon', 'public.record_challenge_progress(uuid, integer, text)', 'EXECUTE') then raise exception 'Anon must not execute progress RPC'; end if;
  if not has_function_privilege('authenticated', 'public.player_leaderboard()', 'EXECUTE') then raise exception 'Authenticated users need leaderboard RPC'; end if;
  if has_table_privilege('authenticated', 'public.challenges', 'INSERT') then raise exception 'Player-only mode must block challenge creation'; end if;
  if not has_function_privilege('authenticated', 'public.review_completion(uuid, public.completion_status)', 'EXECUTE') then raise exception 'Authenticated users need review RPC'; end if;
  if has_function_privilege('anon', 'public.review_completion(uuid, public.completion_status)', 'EXECUTE') then raise exception 'Anon must not execute review RPC'; end if;
  if not has_function_privilege('anon', 'public.resolve_player_login(text)', 'EXECUTE') then raise exception 'Anon needs Player ID login resolution'; end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'player_code'
  ) then raise exception 'Profiles need permanent player codes'; end if;
  if to_regprocedure('private.sync_admin_game_name()') is not null then raise exception 'Admin game-name synchronization must be removed'; end if;
  if to_regprocedure('public.player_challenges(text)') is null then raise exception 'Player challenge RPC is missing'; end if;
end $$;

rollback;
