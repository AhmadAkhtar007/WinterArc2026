drop trigger if exists sync_admin_game_name_after_role_change on auth.users;
drop function if exists private.sync_admin_game_name();

update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) - 'role'
where coalesce(raw_app_meta_data->>'role', '') = 'admin';
revoke insert, update on table public.challenges from authenticated;
revoke execute on function private.review_completion(uuid, public.completion_status), private.reverse_completion(uuid, text) from authenticated;
revoke execute on function public.review_completion(uuid, public.completion_status), public.reverse_completion(uuid, text) from authenticated;

drop policy if exists "admins create challenges" on public.challenges;
drop policy if exists "admins update challenges" on public.challenges;
drop policy if exists "admins read reversal audit" on public.completion_reversals;
drop policy if exists "players read leaderboard own history and admin queue" on public.completions;

create policy "players read confirmed leaderboard and own history"
on public.completions for select to authenticated
using (
  status = 'confirmed'
  or (select auth.uid()) = user_id
);

create or replace function private.create_profile_for_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  assigned_number bigint;
  assigned_name text;
begin
  if new.email is null then
    raise exception 'Player accounts require an email-backed identity' using errcode = '23502';
  end if;

  assigned_number := nextval('private.player_number_seq');
  assigned_name := left(coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), 'Contender'), 40);

  insert into public.profiles (id, player_number, player_code, display_name, avatar_seed)
  values (
    new.id,
    assigned_number,
    'player' || lpad(assigned_number::text, 3, '0'),
    assigned_name,
    new.id::text
  );

  insert into private.player_credentials (profile_id, login_email)
  values (new.id, new.email);

  return new;
end;
$$;

revoke execute on function private.create_profile_for_user() from public, anon, authenticated;

create function private.player_challenges()
returns table (
  id uuid,
  title text,
  description text,
  frequency public.challenge_frequency,
  points integer,
  requires_approval boolean,
  starts_on date,
  ends_on date,
  archived_at timestamptz,
  completion_id uuid,
  completion_period_key text,
  completion_points_awarded integer,
  completion_status public.completion_status,
  completion_completed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  local_today date := timezone('Asia/Karachi', now())::date;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  return query
  select
    challenge.id,
    challenge.title,
    challenge.description,
    challenge.frequency,
    challenge.points,
    challenge.requires_approval,
    challenge.starts_on,
    challenge.ends_on,
    challenge.archived_at,
    completion.id,
    completion.period_key,
    completion.points_awarded,
    completion.status,
    completion.completed_at
  from public.challenges as challenge
  left join public.completions as completion
    on completion.challenge_id = challenge.id
   and completion.user_id = caller_id
   and completion.status <> 'reversed'
   and completion.period_key = case challenge.frequency
     when 'daily' then to_char(local_today, 'YYYY-MM-DD')
     when 'weekly' then to_char(local_today, 'IYYY-"W"IW')
     else '2026-season'
   end
  where challenge.archived_at is null
    and local_today between challenge.starts_on and challenge.ends_on
  order by challenge.points, challenge.created_at, challenge.id;
end;
$$;

create function public.player_challenges()
returns table (
  id uuid,
  title text,
  description text,
  frequency public.challenge_frequency,
  points integer,
  requires_approval boolean,
  starts_on date,
  ends_on date,
  archived_at timestamptz,
  completion_id uuid,
  completion_period_key text,
  completion_points_awarded integer,
  completion_status public.completion_status,
  completion_completed_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$ select * from private.player_challenges() $$;

revoke execute on function private.player_challenges() from public, anon;
revoke execute on function public.player_challenges() from public, anon;
grant execute on function private.player_challenges(), public.player_challenges() to authenticated;