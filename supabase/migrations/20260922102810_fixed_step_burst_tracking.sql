alter table public.challenges
  add column entry_step integer check (entry_step > 0),
  add column burst_limit integer not null default 1 check (burst_limit > 0);

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
  entry_count integer;
  created public.challenge_progress_entries;
begin
  if caller_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into target from public.challenges where id = target_challenge_id and archived_at is null for share;
  if not found or target.frequency <> 'daily' or target.tracking_mode = 'binary' then raise exception 'Tracked daily challenge not found' using errcode = 'P0002'; end if;
  if requested_date < target.starts_on or requested_date > target.ends_on then raise exception 'Challenge is outside its active window' using errcode = '22023'; end if;
  if entry_amount <= 0 then raise exception 'Progress must be a positive whole number' using errcode = '22023'; end if;
  if target.entry_step is not null and entry_amount <> target.entry_step then raise exception 'Progress must use the configured step' using errcode = '22023'; end if;
  if target.tracking_mode = 'occurrence' and entry_amount <> 1 then raise exception 'Occurrence challenges record one completion at a time' using errcode = '22023'; end if;

  select max(recorded_at), coalesce(sum(amount), 0)::integer, count(*)::integer
  into latest_entry, current_progress, entry_count
  from public.challenge_progress_entries
  where user_id = caller_id and challenge_id = target_challenge_id and period_key = target_period_key;

  if latest_entry is not null
     and entry_count % target.burst_limit = 0
     and now() < latest_entry + make_interval(mins => target.minimum_interval_minutes) then
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

drop function public.player_challenges(text);
drop function private.player_challenges(text);

create function private.player_challenges(target_period_key text)
returns table (
  id uuid, title text, description text, frequency public.challenge_frequency, points integer,
  requires_approval boolean, starts_on date, ends_on date, archived_at timestamptz,
  completion_id uuid, completion_period_key text, completion_points_awarded integer,
  completion_status public.completion_status, completion_completed_at timestamptz,
  tracking_mode text, tracking_unit text, tracking_target integer, entry_options integer[],
  entry_step integer, burst_limit integer, minimum_interval_minutes integer, reward_tiers jsonb,
  progress integer, secured_points integer, cooldown_ends_at timestamptz, progress_entries jsonb
)
language plpgsql stable security definer set search_path = '' as $$
declare caller_id uuid := (select auth.uid()); requested_date date := private.valid_local_period(target_period_key);
begin
  if caller_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  return query
  select challenge.id, challenge.title, challenge.description, challenge.frequency, challenge.points,
    challenge.requires_approval, challenge.starts_on, challenge.ends_on, challenge.archived_at,
    completion.id, completion.period_key, completion.points_awarded, completion.status, completion.completed_at,
    challenge.tracking_mode, challenge.tracking_unit, challenge.tracking_target, challenge.entry_options,
    challenge.entry_step, challenge.burst_limit, challenge.minimum_interval_minutes, challenge.reward_tiers,
    entry_state.total,
    coalesce((select max((tier->>'points')::integer) from jsonb_array_elements(challenge.reward_tiers) tier where entry_state.total >= (tier->>'threshold')::integer), 0),
    case
      when entry_state.latest is not null and entry_state.entry_count % challenge.burst_limit = 0
      then entry_state.latest + make_interval(mins => challenge.minimum_interval_minutes)
      else null
    end,
    entry_state.entries
  from public.challenges challenge
  left join public.completions completion
    on completion.challenge_id = challenge.id and completion.user_id = caller_id and completion.status <> 'reversed'
   and completion.period_key = case challenge.frequency when 'daily' then target_period_key when 'weekly' then to_char(requested_date, 'IYYY-"W"IW') else '2026-season' end
  left join lateral (
    select coalesce(sum(item.amount), 0)::integer as total, max(item.recorded_at) as latest, count(item.id)::integer as entry_count,
      coalesce(jsonb_agg(jsonb_build_object('id', item.id, 'amount', item.amount, 'recordedAt', item.recorded_at) order by item.recorded_at) filter (where item.id is not null), '[]'::jsonb) as entries
    from public.challenge_progress_entries item
    where item.user_id = caller_id and item.challenge_id = challenge.id and item.period_key = target_period_key
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
  entry_step integer, burst_limit integer, minimum_interval_minutes integer, reward_tiers jsonb,
  progress integer, secured_points integer, cooldown_ends_at timestamptz, progress_entries jsonb
)
language sql stable security invoker set search_path = ''
as $$ select * from private.player_challenges(target_period_key) $$;

revoke execute on function private.player_challenges(text) from public, anon;
revoke execute on function public.player_challenges(text) from public, anon;
grant execute on function private.player_challenges(text), public.player_challenges(text) to authenticated;

update public.challenges
set title = '2.5L water per day',
    description = 'Drink 2.5 litres across the day.',
    tracking_unit = 'ml',
    tracking_target = 2500,
    entry_step = 250,
    burst_limit = 3,
    minimum_interval_minutes = 30,
    reward_tiers = '[{"threshold":2500,"points":10}]'::jsonb
where lower(title) in ('hydration protocol', '2.5l water per day');

update public.challenges
set entry_step = 1, burst_limit = 1
where lower(title) = 'daily salah';

update public.challenges
set entry_step = null, burst_limit = 1
where lower(title) in ('100 push-ups', '100 pushups per day', 'read nonfiction');
