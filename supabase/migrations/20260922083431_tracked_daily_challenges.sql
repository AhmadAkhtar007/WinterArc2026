alter table public.challenges
  add column tracking_mode text not null default 'binary' check (tracking_mode in ('binary', 'quantity', 'occurrence')),
  add column tracking_unit text,
  add column tracking_target integer check (tracking_target > 0),
  add column entry_options integer[] not null default '{}',
  add column minimum_interval_minutes integer not null default 0 check (minimum_interval_minutes between 0 and 1440),
  add column reward_tiers jsonb not null default '[]'::jsonb check (jsonb_typeof(reward_tiers) = 'array');

create table public.challenge_progress_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  period_key text not null check (period_key ~ '^\d{4}-\d{2}-\d{2}$'),
  amount integer not null check (amount > 0),
  recorded_at timestamptz not null default now()
);

create index challenge_progress_entries_period_idx
on public.challenge_progress_entries (user_id, challenge_id, period_key, recorded_at);

alter table public.challenge_progress_entries enable row level security;
revoke all on table public.challenge_progress_entries from anon, authenticated;
grant select on table public.challenge_progress_entries to authenticated;

create policy "players read own progress entries"
on public.challenge_progress_entries for select to authenticated
using ((select auth.uid()) = user_id);

create or replace function private.valid_local_period(target_period_key text)
returns date
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  requested_date date;
  utc_today date := timezone('UTC', now())::date;
begin
  begin
    requested_date := target_period_key::date;
  exception when others then
    raise exception 'Invalid local period' using errcode = '22007';
  end;
  if requested_date not between utc_today - 1 and utc_today + 1 then
    raise exception 'Local period is outside the accepted window' using errcode = '22023';
  end if;
  return requested_date;
end;
$$;

revoke execute on function private.valid_local_period(text) from public, anon, authenticated;

drop function public.complete_challenge(uuid);
drop function private.complete_challenge(uuid);

create function private.complete_challenge(target_challenge_id uuid, target_period_key text)
returns public.completions
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  target public.challenges;
  requested_date date := private.valid_local_period(target_period_key);
  period text;
  created public.completions;
begin
  if caller_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into target from public.challenges where id = target_challenge_id and archived_at is null for share;
  if not found then raise exception 'Challenge not found' using errcode = 'P0002'; end if;
  if target.tracking_mode <> 'binary' then raise exception 'Tracked challenges require progress entries' using errcode = '22023'; end if;
  if requested_date < target.starts_on or requested_date > target.ends_on then raise exception 'Challenge is outside its active window' using errcode = '22023'; end if;
  period := case target.frequency when 'daily' then target_period_key when 'weekly' then to_char(requested_date, 'IYYY-"W"IW') else '2026-season' end;
  insert into public.completions (user_id, challenge_id, period_key, points_awarded, status)
  values (caller_id, target.id, period, target.points, case when target.requires_approval then 'pending'::public.completion_status else 'confirmed'::public.completion_status end)
  returning * into created;
  return created;
exception when unique_violation then
  raise exception 'Challenge already completed for this period' using errcode = '23505';
end;
$$;

create function public.complete_challenge(target_challenge_id uuid, target_period_key text)
returns public.completions language sql security invoker set search_path = ''
as $$ select private.complete_challenge(target_challenge_id, target_period_key) $$;

revoke execute on function private.complete_challenge(uuid, text) from public, anon;
revoke execute on function public.complete_challenge(uuid, text) from public, anon;
grant execute on function private.complete_challenge(uuid, text), public.complete_challenge(uuid, text) to authenticated;

drop function public.uncomplete_challenge(uuid);
drop function private.uncomplete_challenge(uuid);

create function private.uncomplete_challenge(target_challenge_id uuid, target_period_key text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  caller_id uuid := (select auth.uid());
  target public.challenges;
  requested_date date := private.valid_local_period(target_period_key);
  period text;
begin
  if caller_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into target from public.challenges where id = target_challenge_id;
  if not found then raise exception 'Challenge not found' using errcode = 'P0002'; end if;
  period := case target.frequency when 'daily' then target_period_key when 'weekly' then to_char(requested_date, 'IYYY-"W"IW') else '2026-season' end;
  delete from public.completions where user_id = caller_id and challenge_id = target_challenge_id and period_key = period;
  if not found then raise exception 'Challenge is not complete for this period' using errcode = 'P0002'; end if;
end;
$$;

create function public.uncomplete_challenge(target_challenge_id uuid, target_period_key text)
returns void language sql security invoker set search_path = ''
as $$ select private.uncomplete_challenge(target_challenge_id, target_period_key) $$;

revoke execute on function private.uncomplete_challenge(uuid, text) from public, anon;
revoke execute on function public.uncomplete_challenge(uuid, text) from public, anon;
grant execute on function private.uncomplete_challenge(uuid, text), public.uncomplete_challenge(uuid, text) to authenticated;

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
  latest_entry timestamptz;
  current_progress integer;
  created public.challenge_progress_entries;
begin
  if caller_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into target from public.challenges where id = target_challenge_id and archived_at is null for share;
  if not found or target.frequency <> 'daily' or target.tracking_mode = 'binary' then raise exception 'Tracked daily challenge not found' using errcode = 'P0002'; end if;
  if requested_date < target.starts_on or requested_date > target.ends_on then raise exception 'Challenge is outside its active window' using errcode = '22023'; end if;
  if not (entry_amount = any(target.entry_options)) then raise exception 'Progress amount is not allowed' using errcode = '22023'; end if;
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

create function public.record_challenge_progress(target_challenge_id uuid, entry_amount integer, target_period_key text)
returns public.challenge_progress_entries language sql security invoker set search_path = ''
as $$ select private.record_challenge_progress(target_challenge_id, entry_amount, target_period_key) $$;

create function private.remove_challenge_progress_entry(target_challenge_id uuid, target_entry_id uuid, target_period_key text)
returns void language plpgsql security definer set search_path = '' as $$
declare caller_id uuid := (select auth.uid()); requested_date date := private.valid_local_period(target_period_key);
begin
  if caller_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  delete from public.challenge_progress_entries
  where id = target_entry_id and user_id = caller_id and challenge_id = target_challenge_id and period_key = target_period_key;
  if not found then raise exception 'Progress entry not found' using errcode = 'P0002'; end if;
end;
$$;

create function public.remove_challenge_progress_entry(target_challenge_id uuid, target_entry_id uuid, target_period_key text)
returns void language sql security invoker set search_path = ''
as $$ select private.remove_challenge_progress_entry(target_challenge_id, target_entry_id, target_period_key) $$;

revoke execute on function private.record_challenge_progress(uuid, integer, text), private.remove_challenge_progress_entry(uuid, uuid, text) from public, anon;
revoke execute on function public.record_challenge_progress(uuid, integer, text), public.remove_challenge_progress_entry(uuid, uuid, text) from public, anon;
grant execute on function private.record_challenge_progress(uuid, integer, text), private.remove_challenge_progress_entry(uuid, uuid, text) to authenticated;
grant execute on function public.record_challenge_progress(uuid, integer, text), public.remove_challenge_progress_entry(uuid, uuid, text) to authenticated;

drop function public.player_challenges();
drop function private.player_challenges();

create function private.player_challenges(target_period_key text)
returns table (
  id uuid, title text, description text, frequency public.challenge_frequency, points integer,
  requires_approval boolean, starts_on date, ends_on date, archived_at timestamptz,
  completion_id uuid, completion_period_key text, completion_points_awarded integer,
  completion_status public.completion_status, completion_completed_at timestamptz,
  tracking_mode text, tracking_unit text, tracking_target integer, entry_options integer[],
  minimum_interval_minutes integer, reward_tiers jsonb, progress integer, secured_points integer,
  cooldown_ends_at timestamptz, progress_entries jsonb
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
    challenge.minimum_interval_minutes, challenge.reward_tiers, entry_state.total,
    coalesce((select max((tier->>'points')::integer) from jsonb_array_elements(challenge.reward_tiers) tier where entry_state.total >= (tier->>'threshold')::integer), 0),
    case when entry_state.latest is null then null else entry_state.latest + make_interval(mins => challenge.minimum_interval_minutes) end,
    entry_state.entries
  from public.challenges challenge
  left join public.completions completion
    on completion.challenge_id = challenge.id and completion.user_id = caller_id and completion.status <> 'reversed'
   and completion.period_key = case challenge.frequency when 'daily' then target_period_key when 'weekly' then to_char(requested_date, 'IYYY-"W"IW') else '2026-season' end
  left join lateral (
    select coalesce(sum(item.amount), 0)::integer as total, max(item.recorded_at) as latest,
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
  minimum_interval_minutes integer, reward_tiers jsonb, progress integer, secured_points integer,
  cooldown_ends_at timestamptz, progress_entries jsonb
)
language sql stable security invoker set search_path = ''
as $$ select * from private.player_challenges(target_period_key) $$;

revoke execute on function private.player_challenges(text) from public, anon;
revoke execute on function public.player_challenges(text) from public, anon;
grant execute on function private.player_challenges(text), public.player_challenges(text) to authenticated;

update public.challenges set tracking_mode = 'quantity', tracking_unit = 'glasses', tracking_target = 8, entry_options = array[1], minimum_interval_minutes = 30, reward_tiers = '[{"threshold":8,"points":10}]'::jsonb, points = 10 where lower(title) = 'hydration protocol';
update public.challenges set tracking_mode = 'quantity', tracking_unit = 'reps', tracking_target = 150, entry_options = array[10,25,50], minimum_interval_minutes = 5, reward_tiers = '[{"threshold":100,"points":20},{"threshold":150,"points":30}]'::jsonb, points = 30 where lower(title) in ('100 push-ups', '100 pushups per day');
update public.challenges set tracking_mode = 'quantity', tracking_unit = 'pages', tracking_target = 16, entry_options = array[1,2,4], minimum_interval_minutes = 0, reward_tiers = '[{"threshold":8,"points":10},{"threshold":12,"points":15},{"threshold":16,"points":20}]'::jsonb, points = 20 where lower(title) = 'read nonfiction';
update public.challenges set tracking_mode = 'occurrence', tracking_unit = 'prayers', tracking_target = 5, entry_options = array[1], minimum_interval_minutes = 120, reward_tiers = '[{"threshold":5,"points":25}]'::jsonb, points = 25 where lower(title) = 'daily salah';

do $$
declare creator uuid;
begin
  select id into creator from auth.users order by created_at limit 1;
  if creator is null then return; end if;
  insert into public.challenges (id, title, description, frequency, points, requires_approval, starts_on, ends_on, created_by, tracking_mode, tracking_unit, tracking_target, entry_options, minimum_interval_minutes, reward_tiers)
  select '10000000-0000-4000-8000-000000000001', 'Hydration protocol', 'Drink eight glasses across the day.', 'daily', 10, false, '2026-09-23', '2026-12-31', creator, 'quantity', 'glasses', 8, array[1], 30, '[{"threshold":8,"points":10}]'::jsonb
  where not exists (select 1 from public.challenges where lower(title) = 'hydration protocol');
  insert into public.challenges (id, title, description, frequency, points, requires_approval, starts_on, ends_on, created_by, tracking_mode, tracking_unit, tracking_target, entry_options, minimum_interval_minutes, reward_tiers)
  select '10000000-0000-4000-8000-000000000002', '100 push-ups', 'Complete deliberate repetitions in sets.', 'daily', 30, false, '2026-09-23', '2026-12-31', creator, 'quantity', 'reps', 150, array[10,25,50], 5, '[{"threshold":100,"points":20},{"threshold":150,"points":30}]'::jsonb
  where not exists (select 1 from public.challenges where lower(title) in ('100 push-ups', '100 pushups per day'));
  insert into public.challenges (id, title, description, frequency, points, requires_approval, starts_on, ends_on, created_by, tracking_mode, tracking_unit, tracking_target, entry_options, minimum_interval_minutes, reward_tiers)
  select '10000000-0000-4000-8000-000000000003', 'Read nonfiction', 'Read deliberately and record pages as you finish them.', 'daily', 20, false, '2026-09-23', '2026-12-31', creator, 'quantity', 'pages', 16, array[1,2,4], 0, '[{"threshold":8,"points":10},{"threshold":12,"points":15},{"threshold":16,"points":20}]'::jsonb
  where not exists (select 1 from public.challenges where lower(title) = 'read nonfiction');
  insert into public.challenges (id, title, description, frequency, points, requires_approval, starts_on, ends_on, created_by, tracking_mode, tracking_unit, tracking_target, entry_options, minimum_interval_minutes, reward_tiers)
  select '10000000-0000-4000-8000-000000000004', 'Daily Salah', 'Record each prayer after it is performed.', 'daily', 25, false, '2026-09-23', '2026-12-31', creator, 'occurrence', 'prayers', 5, array[1], 120, '[{"threshold":5,"points":25}]'::jsonb
  where not exists (select 1 from public.challenges where lower(title) = 'daily salah');
end;
$$;
create function private.player_leaderboard()
returns table (id uuid, display_name text, points integer, completed_count integer)
language sql stable security definer set search_path = '' as $$
  with completion_scores as (
    select user_id, coalesce(sum(points_awarded), 0)::integer as points, count(*)::integer as completed_count
    from public.completions where status = 'confirmed' group by user_id
  ),
  progress_periods as (
    select entry.user_id, entry.challenge_id, entry.period_key, sum(entry.amount)::integer as progress
    from public.challenge_progress_entries entry group by entry.user_id, entry.challenge_id, entry.period_key
  ),
  progress_scores as (
    select period.user_id,
      coalesce(sum(reward.points), 0)::integer as points,
      count(*) filter (where reward.points > 0)::integer as completed_count
    from progress_periods period
    join public.challenges challenge on challenge.id = period.challenge_id
    left join lateral (
      select coalesce(max((tier->>'points')::integer), 0)::integer as points
      from jsonb_array_elements(challenge.reward_tiers) tier
      where period.progress >= (tier->>'threshold')::integer
    ) reward on true
    group by period.user_id
  )
  select profile.id, profile.display_name,
    (coalesce(completion.points, 0) + coalesce(progress.points, 0))::integer as points,
    (coalesce(completion.completed_count, 0) + coalesce(progress.completed_count, 0))::integer as completed_count
  from public.profiles profile
  left join completion_scores completion on completion.user_id = profile.id
  left join progress_scores progress on progress.user_id = profile.id
  order by points desc, profile.display_name, profile.id
$$;

create function public.player_leaderboard()
returns table (id uuid, display_name text, points integer, completed_count integer)
language sql stable security invoker set search_path = ''
as $$ select * from private.player_leaderboard() $$;

revoke execute on function private.player_leaderboard() from public, anon;
revoke execute on function public.player_leaderboard() from public, anon;
grant execute on function private.player_leaderboard(), public.player_leaderboard() to authenticated;