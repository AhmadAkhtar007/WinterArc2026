create function private.uncomplete_challenge(target_challenge_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  target public.challenges;
  period text;
  local_now timestamp := timezone('Asia/Karachi', now());
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select * into target
  from public.challenges
  where id = target_challenge_id;

  if not found then
    raise exception 'Challenge not found' using errcode = 'P0002';
  end if;

  period := case target.frequency
    when 'daily' then to_char(local_now, 'YYYY-MM-DD')
    when 'weekly' then to_char(local_now, 'IYYY-"W"IW')
    else '2026-season'
  end;

  delete from public.completions
  where user_id = caller_id
    and challenge_id = target_challenge_id
    and period_key = period;

  if not found then
    raise exception 'Challenge is not complete for this period' using errcode = 'P0002';
  end if;
end;
$$;

create function public.uncomplete_challenge(target_challenge_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$ select private.uncomplete_challenge(target_challenge_id) $$;

revoke execute on function private.uncomplete_challenge(uuid) from public, anon;
revoke execute on function public.uncomplete_challenge(uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.uncomplete_challenge(uuid) to authenticated;
grant execute on function public.uncomplete_challenge(uuid) to authenticated;