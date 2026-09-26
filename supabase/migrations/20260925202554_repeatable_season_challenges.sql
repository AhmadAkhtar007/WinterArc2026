alter table public.challenge_commitments
  add column id uuid default gen_random_uuid(),
  add column is_active boolean not null default true;

update public.challenge_commitments
set id = gen_random_uuid()
where id is null;

alter table public.challenge_commitments
  alter column id set not null,
  drop constraint challenge_commitments_pkey,
  add constraint challenge_commitments_pkey primary key (id);

create unique index challenge_commitments_one_active
on public.challenge_commitments (user_id, challenge_id)
where is_active;

alter table public.completions
  add column commitment_id uuid;

insert into public.challenge_commitments (user_id, challenge_id, is_active)
select
  completion.user_id,
  completion.challenge_id,
  case
    when challenge.frequency = 'once' then not bool_or(completion.status = 'confirmed')
    else true
  end
from public.completions completion
join public.challenges challenge
  on challenge.id = completion.challenge_id
where not exists (
  select 1
  from public.challenge_commitments commitment
  where commitment.user_id = completion.user_id
    and commitment.challenge_id = completion.challenge_id
)
group by completion.user_id, completion.challenge_id, challenge.frequency;

update public.challenge_commitments commitment
set is_active = false
from public.challenges challenge
where challenge.id = commitment.challenge_id
  and challenge.frequency = 'once'
  and exists (
    select 1
    from public.completions completion
    where completion.user_id = commitment.user_id
      and completion.challenge_id = commitment.challenge_id
      and completion.status = 'confirmed'
  );

update public.completions completion
set commitment_id = commitment.id
from public.challenge_commitments commitment
where commitment.user_id = completion.user_id
  and commitment.challenge_id = completion.challenge_id;

alter table public.completions
  alter column commitment_id set not null,
  add constraint completions_commitment_id_fkey
    foreign key (commitment_id)
    references public.challenge_commitments(id)
    on delete restrict;

drop index if exists public.completions_active_period_unique;

create unique index completions_active_period_unique
on public.completions (commitment_id, period_key)
where status <> 'reversed';

create or replace function private.enroll_challenge(
  target_challenge_id uuid,
  target_goal integer default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  target public.challenges;
begin
  if caller_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;

  select * into target
  from public.challenges
  where id = target_challenge_id and archived_at is null;

  if not found then raise exception 'Challenge not found' using errcode = 'P0002'; end if;
  if current_date < target.starts_on or current_date > target.ends_on then
    raise exception 'Challenge is not currently available' using errcode = '22023';
  end if;

  insert into public.challenge_commitments (user_id, challenge_id, custom_target)
  values (caller_id, target_challenge_id, target_goal)
  on conflict (user_id, challenge_id) where is_active
  do update set custom_target = coalesce(excluded.custom_target, public.challenge_commitments.custom_target);
end;
$$;

create or replace function private.complete_challenge(target_challenge_id uuid, target_period_key text)
returns public.completions
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  commitment public.challenge_commitments;
  target public.challenges;
  requested_date date := private.valid_local_period(target_period_key);
  period text;
  created public.completions;
begin
  if caller_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;

  select * into commitment
  from public.challenge_commitments
  where user_id = caller_id
    and is_active
    and (id = target_challenge_id or challenge_id = target_challenge_id)
  order by case when id = target_challenge_id then 0 else 1 end
  limit 1
  for update;

  if not found then raise exception 'Active challenge not found' using errcode = 'P0002'; end if;

  select * into target
  from public.challenges
  where id = commitment.challenge_id and archived_at is null
  for share;

  if not found then raise exception 'Challenge not found' using errcode = 'P0002'; end if;
  if target.tracking_mode <> 'binary' then raise exception 'Tracked challenges require progress entries' using errcode = '22023'; end if;
  if requested_date < target.starts_on or requested_date > target.ends_on then raise exception 'Challenge is outside its active window' using errcode = '22023'; end if;

  period := case target.frequency
    when 'daily' then target_period_key
    when 'weekly' then to_char(requested_date, 'IYYY-"W"IW')
    else '2026-season'
  end;

  insert into public.completions (user_id, challenge_id, commitment_id, period_key, points_awarded, status)
  values (
    caller_id,
    target.id,
    commitment.id,
    period,
    target.points,
    case when target.requires_approval then 'pending'::public.completion_status else 'confirmed'::public.completion_status end
  )
  returning * into created;

  if target.frequency = 'once' and created.status = 'confirmed' then
    update public.challenge_commitments
    set is_active = false
    where id = commitment.id;
  end if;

  return created;
exception when unique_violation then
  raise exception 'Challenge already completed for this period' using errcode = '23505';
end;
$$;

create or replace function private.uncomplete_challenge(target_challenge_id uuid, target_period_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  commitment public.challenge_commitments;
  target public.challenges;
  requested_date date := private.valid_local_period(target_period_key);
  period text;
begin
  if caller_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;

  select * into commitment
  from public.challenge_commitments
  where user_id = caller_id
    and (id = target_challenge_id or (challenge_id = target_challenge_id and is_active))
  order by case when id = target_challenge_id then 0 else 1 end
  limit 1
  for update;

  if not found then raise exception 'Challenge commitment not found' using errcode = 'P0002'; end if;

  select * into target
  from public.challenges
  where id = commitment.challenge_id;

  if not found then raise exception 'Challenge not found' using errcode = 'P0002'; end if;

  period := case target.frequency
    when 'daily' then target_period_key
    when 'weekly' then to_char(requested_date, 'IYYY-"W"IW')
    else '2026-season'
  end;

  delete from public.completions
  where user_id = caller_id
    and commitment_id = commitment.id
    and period_key = period;

  if not found then raise exception 'Challenge is not complete for this period' using errcode = 'P0002'; end if;

  if target.frequency = 'once' then
    update public.challenge_commitments
    set is_active = true
    where id = commitment.id;
  end if;
end;
$$;

create or replace function private.review_completion(target_completion_id uuid, decision public.completion_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  reviewed public.completions;
begin
  if not private.is_admin() then raise exception 'Administrator required' using errcode = '42501'; end if;
  if decision not in ('confirmed', 'reversed') then raise exception 'Invalid review decision' using errcode = '22023'; end if;

  update public.completions
  set status = decision,
      reviewed_at = now(),
      reviewed_by = (select auth.uid())
  where id = target_completion_id and status = 'pending'
  returning * into reviewed;

  if not found then raise exception 'Pending completion not found' using errcode = 'P0002'; end if;

  if decision = 'confirmed' and exists (
    select 1
    from public.challenges challenge
    where challenge.id = reviewed.challenge_id
      and challenge.frequency = 'once'
  ) then
    update public.challenge_commitments
    set is_active = false
    where id = reviewed.commitment_id;
  end if;
end;
$$;

drop function if exists public.player_challenges(text);
drop function if exists private.player_challenges(text);

create function private.player_challenges(target_period_key text)
returns table (
  id uuid, catalog_id uuid, title text, description text, frequency public.challenge_frequency, points integer,
  requires_approval boolean, starts_on date, ends_on date, archived_at timestamptz,
  completion_id uuid, completion_period_key text, completion_points_awarded integer,
  completion_status public.completion_status, completion_completed_at timestamptz,
  tracking_mode text, tracking_unit text, tracking_target integer, entry_options integer[],
  entry_step integer, burst_limit integer, minimum_interval_minutes integer, attempt_duration_minutes integer,
  reward_tiers jsonb, progress integer, secured_points integer, cooldown_ends_at timestamptz,
  attempt_ends_at timestamptz, attempt_failed boolean, progress_entries jsonb, scoring_profile text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  requested_date date := private.valid_local_period(target_period_key);
begin
  if caller_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;

  return query
  select
    case when challenge.frequency = 'once' then commitment.id else challenge.id end,
    challenge.id,
    challenge.title,
    challenge.description,
    challenge.frequency,
    case
      when challenge.scoring_profile = 'gym' then
        (coalesce(commitment.custom_target, challenge.tracking_target, 4) * 10) + 50
      when challenge.scoring_profile = 'pushups' then
        (coalesce(commitment.custom_target, challenge.tracking_target, 100) / 10)
      else challenge.points
    end,
    challenge.requires_approval,
    challenge.starts_on,
    challenge.ends_on,
    challenge.archived_at,
    completion.id,
    completion.period_key,
    completion.points_awarded,
    completion.status,
    completion.completed_at,
    challenge.tracking_mode,
    challenge.tracking_unit,
    coalesce(commitment.custom_target, challenge.tracking_target),
    challenge.entry_options,
    challenge.entry_step,
    challenge.burst_limit,
    challenge.minimum_interval_minutes,
    challenge.attempt_duration_minutes,
    challenge.reward_tiers,
    entry_state.total,
    case
      when challenge.scoring_profile = 'pushups' then
        (least(entry_state.total, coalesce(commitment.custom_target, challenge.tracking_target, 100) * 2) / 10)
      when challenge.scoring_profile = 'gym' then
        (least(entry_state.total, coalesce(commitment.custom_target, challenge.tracking_target, 4)) * 10)
        + (case when entry_state.total >= coalesce(commitment.custom_target, challenge.tracking_target, 4) then 50 else 0 end)
      else
        coalesce((
          select max((tier->>'points')::integer)
          from jsonb_array_elements(challenge.reward_tiers) tier
          where entry_state.total >= (tier->>'threshold')::integer
        ), 0)
    end,
    case
      when entry_state.latest is not null and entry_state.entry_count % challenge.burst_limit = 0
      then entry_state.latest + make_interval(mins => challenge.minimum_interval_minutes)
      else null
    end,
    case
      when entry_state.first_entry is not null
        and challenge.attempt_duration_minutes is not null
        and entry_state.total < coalesce(commitment.custom_target, challenge.tracking_target)
      then entry_state.first_entry + make_interval(mins => challenge.attempt_duration_minutes)
      else null
    end,
    case
      when entry_state.first_entry is not null
        and challenge.attempt_duration_minutes is not null
        and entry_state.total < coalesce(commitment.custom_target, challenge.tracking_target)
        and now() >= entry_state.first_entry + make_interval(mins => challenge.attempt_duration_minutes)
      then true
      else false
    end,
    entry_state.entries,
    challenge.scoring_profile
  from public.challenge_commitments commitment
  join public.challenges challenge
    on challenge.id = commitment.challenge_id
  left join public.completions completion
    on completion.commitment_id = commitment.id
    and completion.status <> 'reversed'
    and completion.period_key = case challenge.frequency
      when 'daily' then target_period_key
      when 'weekly' then to_char(requested_date, 'IYYY-"W"IW')
      else '2026-season'
    end
  left join lateral (
    select
      coalesce(sum(item.amount), 0)::integer as total,
      min(item.recorded_at) as first_entry,
      max(item.recorded_at) as latest,
      count(item.id)::integer as entry_count,
      coalesce(
        jsonb_agg(
          jsonb_build_object('id', item.id, 'amount', item.amount, 'recordedAt', item.recorded_at)
          order by item.recorded_at
        ) filter (where item.id is not null),
        '[]'::jsonb
      ) as entries
    from public.challenge_progress_entries item
    where item.user_id = caller_id
      and item.challenge_id = challenge.id
      and item.period_key = case challenge.frequency
        when 'daily' then target_period_key
        when 'weekly' then to_char(requested_date, 'IYYY-"W"IW')
        else '2026-season'
      end
  ) entry_state on true
  where commitment.user_id = caller_id
    and challenge.archived_at is null
    and requested_date between challenge.starts_on and challenge.ends_on
  order by challenge.points, commitment.committed_at, commitment.id;
end;
$$;

create function public.player_challenges(target_period_key text)
returns table (
  id uuid, catalog_id uuid, title text, description text, frequency public.challenge_frequency, points integer,
  requires_approval boolean, starts_on date, ends_on date, archived_at timestamptz,
  completion_id uuid, completion_period_key text, completion_points_awarded integer,
  completion_status public.completion_status, completion_completed_at timestamptz,
  tracking_mode text, tracking_unit text, tracking_target integer, entry_options integer[],
  entry_step integer, burst_limit integer, minimum_interval_minutes integer, attempt_duration_minutes integer,
  reward_tiers jsonb, progress integer, secured_points integer, cooldown_ends_at timestamptz,
  attempt_ends_at timestamptz, attempt_failed boolean, progress_entries jsonb, scoring_profile text
)
language sql
stable
security invoker
set search_path = ''
as $$ select * from private.player_challenges(target_period_key) $$;

revoke execute on function private.player_challenges(text), public.player_challenges(text) from public, anon;
grant execute on function private.player_challenges(text), public.player_challenges(text) to authenticated;
