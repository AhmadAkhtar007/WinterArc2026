create or replace function private.record_challenge_progress(target_challenge_id uuid, entry_amount integer, target_period_key text)
returns public.challenge_progress_entries
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  target public.challenges;
  requested_date date := private.valid_local_period(target_period_key);
  latest_entry timestamptz;
  current_progress integer;
  created public.challenge_progress_entries;
begin
  if caller_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into target from public.challenges where id = target_challenge_id and archived_at is null for share;
  if not found or target.frequency <> 'daily' or target.tracking_mode = 'binary' then raise exception 'Tracked daily challenge not found' using errcode = 'P0002'; end if;
  if requested_date < target.starts_on or requested_date > target.ends_on then raise exception 'Challenge is outside its active window' using errcode = '22023'; end if;
  if entry_amount <= 0 then raise exception 'Progress must be a positive whole number' using errcode = '22023'; end if;
  if target.tracking_mode = 'occurrence' and entry_amount <> 1 then raise exception 'Occurrence challenges record one completion at a time' using errcode = '22023'; end if;
  select max(recorded_at), coalesce(sum(amount), 0)::integer into latest_entry, current_progress
  from public.challenge_progress_entries
  where user_id = caller_id and challenge_id = target_challenge_id and period_key = target_period_key;
  if latest_entry is not null and now() < latest_entry + make_interval(mins => target.minimum_interval_minutes) then
    raise exception 'Challenge is still in cooldown' using errcode = '22023';
  end if;
  if current_progress >= target.tracking_target or current_progress + entry_amount > target.tracking_target then
    raise exception 'Entry exceeds remaining progress' using errcode = '22023';
  end if;
  insert into public.challenge_progress_entries (user_id, challenge_id, period_key, amount)
  values (caller_id, target_challenge_id, target_period_key, entry_amount)
  returning * into created;
  return created;
end;
$$;

revoke execute on function private.record_challenge_progress(uuid, integer, text) from public, anon;
grant execute on function private.record_challenge_progress(uuid, integer, text) to authenticated;

update public.challenges
set entry_options = case when tracking_mode = 'occurrence' then array[1]::integer[] else '{}'::integer[] end
where tracking_mode in ('quantity', 'occurrence');