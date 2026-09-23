alter table public.challenges
  add column attempt_duration_minutes integer check (attempt_duration_minutes > 0);

alter table public.challenge_progress_entries
  drop constraint if exists challenge_progress_entries_period_key_check;

alter table public.challenge_progress_entries
  add constraint challenge_progress_entries_period_key_check
  check (period_key ~ '^\d{4}-(\d{2}-\d{2}|W\d{2})$');

create or replace function private.valid_local_period(target_period_key text)
returns date
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  requested_date date;
  local_today date := timezone('Asia/Karachi', now())::date;
begin
  if target_period_key ~ '^\d{4}-W\d{2}$' then
    if target_period_key <> to_char(local_today, 'IYYY-"W"IW') then
      raise exception 'Local period is outside the accepted window' using errcode = '22023';
    end if;
    return local_today;
  end if;
  begin
    requested_date := target_period_key::date;
  exception when others then
    raise exception 'Invalid local period' using errcode = '22007';
  end;
  if requested_date not between local_today - 1 and local_today + 1 then
    raise exception 'Local period is outside the accepted window' using errcode = '22023';
  end if;
  return requested_date;
end;
$$;

drop function if exists public.record_challenge_progress(uuid, integer, text);
drop function if exists private.record_challenge_progress(uuid, integer, text);

create function private.record_challenge_progress(target_challenge_id uuid, entry_amount integer, target_period_key text)
returns public.challenge_progress_entries
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  target public.challenges;
  requested_date date := private.valid_local_period(target_period_key);
  period text;
  latest_entry timestamptz;
  first_entry timestamptz;
  current_progress integer;
  entry_count integer;
  created public.challenge_progress_entries;
begin
  if caller_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into target from public.challenges where id = target_challenge_id and archived_at is null for share;
  if not found or target.frequency not in ('daily', 'weekly') or target.tracking_mode = 'binary' then
    raise exception 'Tracked challenge not found' using errcode = 'P0002';
  end if;
  if requested_date < target.starts_on or requested_date > target.ends_on then
    raise exception 'Challenge is outside its active window' using errcode = '22023';
  end if;
  if entry_amount <= 0 then raise exception 'Progress must be a positive whole number' using errcode = '22023'; end if;
  if target.entry_step is not null and entry_amount <> target.entry_step then raise exception 'Progress must use the configured step' using errcode = '22023'; end if;
  if target.tracking_mode = 'occurrence' and entry_amount <> 1 then raise exception 'Occurrence challenges record one completion at a time' using errcode = '22023'; end if;

  period := case target.frequency
    when 'daily' then target_period_key
    when 'weekly' then to_char(requested_date, 'IYYY-"W"IW')
    else '2026-season'
  end;

  select min(recorded_at), max(recorded_at), coalesce(sum(amount), 0)::integer, count(*)::integer
  into first_entry, latest_entry, current_progress, entry_count
  from public.challenge_progress_entries
  where user_id = caller_id and challenge_id = target_challenge_id and period_key = period;

  if target.attempt_duration_minutes is not null
     and first_entry is not null
     and now() >= first_entry + make_interval(mins => target.attempt_duration_minutes)
     and current_progress < target.tracking_target then
    delete from public.challenge_progress_entries
    where user_id = caller_id and challenge_id = target_challenge_id and period_key = period;
    first_entry := null;
    latest_entry := null;
    current_progress := 0;
    entry_count := 0;
  end if;

  if latest_entry is not null
     and entry_count % target.burst_limit = 0
     and now() < latest_entry + make_interval(mins => target.minimum_interval_minutes) then
    raise exception 'Challenge is still in cooldown' using errcode = '22023';
  end if;
  if current_progress >= target.tracking_target or current_progress + entry_amount > target.tracking_target then
    raise exception 'Entry exceeds remaining progress' using errcode = '22023';
  end if;

  insert into public.challenge_progress_entries (user_id, challenge_id, period_key, amount)
  values (caller_id, target_challenge_id, period, entry_amount)
  returning * into created;
  return created;
end;
$$;

create function public.record_challenge_progress(target_challenge_id uuid, entry_amount integer, target_period_key text)
returns public.challenge_progress_entries
language sql security invoker set search_path = ''
as $$ select private.record_challenge_progress(target_challenge_id, entry_amount, target_period_key) $$;

revoke execute on function private.record_challenge_progress(uuid, integer, text), public.record_challenge_progress(uuid, integer, text) from public, anon;
grant execute on function private.record_challenge_progress(uuid, integer, text), public.record_challenge_progress(uuid, integer, text) to authenticated;

drop function if exists public.player_challenges(text);
drop function if exists private.player_challenges(text);

create function private.player_challenges(target_period_key text)
returns table (
  id uuid, title text, description text, frequency public.challenge_frequency, points integer,
  requires_approval boolean, starts_on date, ends_on date, archived_at timestamptz,
  completion_id uuid, completion_period_key text, completion_points_awarded integer,
  completion_status public.completion_status, completion_completed_at timestamptz,
  tracking_mode text, tracking_unit text, tracking_target integer, entry_options integer[],
  entry_step integer, burst_limit integer, minimum_interval_minutes integer, attempt_duration_minutes integer,
  reward_tiers jsonb, progress integer, secured_points integer, cooldown_ends_at timestamptz,
  attempt_ends_at timestamptz, attempt_failed boolean, progress_entries jsonb
)
language plpgsql stable security definer set search_path = '' as $$
declare
  caller_id uuid := (select auth.uid());
  requested_date date := private.valid_local_period(target_period_key);
begin
  if caller_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  return query
  select challenge.id, challenge.title, challenge.description, challenge.frequency, challenge.points,
    challenge.requires_approval, challenge.starts_on, challenge.ends_on, challenge.archived_at,
    completion.id, completion.period_key, completion.points_awarded, completion.status, completion.completed_at,
    challenge.tracking_mode, challenge.tracking_unit, challenge.tracking_target, challenge.entry_options,
    challenge.entry_step, challenge.burst_limit, challenge.minimum_interval_minutes, challenge.attempt_duration_minutes,
    challenge.reward_tiers, entry_state.total,
    coalesce((select max((tier->>'points')::integer) from jsonb_array_elements(challenge.reward_tiers) tier where entry_state.total >= (tier->>'threshold')::integer), 0),
    case when entry_state.latest is not null and entry_state.entry_count % challenge.burst_limit = 0
      then entry_state.latest + make_interval(mins => challenge.minimum_interval_minutes) else null end,
    case when entry_state.first_entry is not null and challenge.attempt_duration_minutes is not null
      and entry_state.total < challenge.tracking_target
      then entry_state.first_entry + make_interval(mins => challenge.attempt_duration_minutes) else null end,
    case when entry_state.first_entry is not null and challenge.attempt_duration_minutes is not null
      and entry_state.total < challenge.tracking_target
      and now() >= entry_state.first_entry + make_interval(mins => challenge.attempt_duration_minutes)
      then true else false end,
    entry_state.entries
  from public.challenges challenge
  left join public.completions completion
    on completion.challenge_id = challenge.id and completion.user_id = caller_id and completion.status <> 'reversed'
   and completion.period_key = case challenge.frequency
     when 'daily' then target_period_key
     when 'weekly' then to_char(requested_date, 'IYYY-"W"IW')
     else '2026-season' end
  left join lateral (
    select coalesce(sum(item.amount), 0)::integer as total, min(item.recorded_at) as first_entry,
      max(item.recorded_at) as latest, count(item.id)::integer as entry_count,
      coalesce(jsonb_agg(jsonb_build_object('id', item.id, 'amount', item.amount, 'recordedAt', item.recorded_at) order by item.recorded_at) filter (where item.id is not null), '[]'::jsonb) as entries
    from public.challenge_progress_entries item
    where item.user_id = caller_id and item.challenge_id = challenge.id
      and item.period_key = case challenge.frequency
        when 'daily' then target_period_key
        when 'weekly' then to_char(requested_date, 'IYYY-"W"IW')
        else '2026-season' end
  ) entry_state on true
  where challenge.archived_at is null and requested_date between challenge.starts_on and challenge.ends_on
  order by challenge.points, challenge.created_at, challenge.id;
end;
$$;

create function public.player_challenges(target_period_key text)
returns table (
  id uuid, title text, description text, frequency public.challenge_frequency, points integer,
  requires_approval boolean, starts_on date, ends_on date, archived_at timestamptz,
  completion_id uuid, completion_period_key text, completion_points_awarded integer,
  completion_status public.completion_status, completion_completed_at timestamptz,
  tracking_mode text, tracking_unit text, tracking_target integer, entry_options integer[],
  entry_step integer, burst_limit integer, minimum_interval_minutes integer, attempt_duration_minutes integer,
  reward_tiers jsonb, progress integer, secured_points integer, cooldown_ends_at timestamptz,
  attempt_ends_at timestamptz, attempt_failed boolean, progress_entries jsonb
)
language sql stable security invoker set search_path = ''
as $$ select * from private.player_challenges(target_period_key) $$;

revoke execute on function private.player_challenges(text), public.player_challenges(text) from public, anon;
grant execute on function private.player_challenges(text), public.player_challenges(text) to authenticated;

update public.challenges
set tracking_mode = 'quantity', tracking_unit = 'reps', tracking_target = 1000, entry_options = '{}',
    entry_step = 50, burst_limit = 1, minimum_interval_minutes = 0, attempt_duration_minutes = 1440,
    reward_tiers = '[{"threshold":1000,"points":100}]'::jsonb, points = 100
where lower(title) = '1000 squats';

update public.challenges
set tracking_mode = 'occurrence', tracking_unit = 'sessions', tracking_target = 3, entry_options = array[1],
    entry_step = 1, burst_limit = 1, minimum_interval_minutes = 720, attempt_duration_minutes = null,
    reward_tiers = '[{"threshold":3,"points":60}]'::jsonb, points = 60
where lower(title) = 'gym';

do $$
declare creator uuid;
begin
  select id into creator from auth.users order by created_at limit 1;
  if creator is null then return; end if;
  insert into public.challenges (id, title, description, frequency, points, requires_approval, starts_on, ends_on, created_by, tracking_mode, tracking_unit, tracking_target, entry_options, entry_step, burst_limit, minimum_interval_minutes, attempt_duration_minutes, reward_tiers)
  values ('10000000-0000-4000-8000-000000000005', '1000 squats', 'Reach one thousand deliberate squats within a 24-hour attempt.', 'weekly', 100, false, '2026-09-23', '2026-12-31', creator, 'quantity', 'reps', 1000, '{}', 50, 1, 0, 1440, '[{"threshold":1000,"points":100}]'::jsonb)
  on conflict (id) do nothing;
  insert into public.challenges (id, title, description, frequency, points, requires_approval, starts_on, ends_on, created_by, tracking_mode, tracking_unit, tracking_target, entry_options, entry_step, burst_limit, minimum_interval_minutes, reward_tiers)
  values ('10000000-0000-4000-8000-000000000006', 'Gym', 'Complete three gym sessions this week.', 'weekly', 60, false, '2026-09-23', '2026-12-31', creator, 'occurrence', 'sessions', 3, array[1], 1, 1, 720, '[{"threshold":3,"points":60}]'::jsonb)
  on conflict (id) do nothing;
  insert into public.challenges (id, title, description, frequency, points, requires_approval, starts_on, ends_on, created_by, tracking_mode)
  values
    ('10000000-0000-4000-8000-000000000007', 'Compete in a 5K run', 'Complete the challenge and submit proof on WhatsApp for review.', 'once', 100, true, '2026-09-23', '2026-12-31', creator, 'binary'),
    ('10000000-0000-4000-8000-000000000008', 'Run a Half-Marathon', 'Complete the challenge and submit proof on WhatsApp for review.', 'once', 500, true, '2026-09-23', '2026-12-31', creator, 'binary'),
    ('10000000-0000-4000-8000-000000000009', 'Run a Full-Marathon', 'Complete the challenge and submit proof on WhatsApp for review.', 'once', 1000, true, '2026-09-23', '2026-12-31', creator, 'binary')
  on conflict (id) do nothing;
end;
$$;
