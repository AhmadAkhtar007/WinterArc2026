create or replace function private.remove_challenge_progress_entry(target_challenge_id uuid, target_entry_id uuid, target_period_key text)
returns void language plpgsql security definer set search_path = '' as $$
declare caller_id uuid := (select auth.uid());
begin
  perform private.valid_local_period(target_period_key);
  if caller_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  delete from public.challenge_progress_entries
  where id = target_entry_id and user_id = caller_id and challenge_id = target_challenge_id and period_key = target_period_key;
  if not found then raise exception 'Progress entry not found' using errcode = 'P0002'; end if;
end;
$$;

revoke execute on function private.remove_challenge_progress_entry(uuid, uuid, text) from public, anon;
grant execute on function private.remove_challenge_progress_entry(uuid, uuid, text) to authenticated;