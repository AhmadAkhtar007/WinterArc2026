create table public.challenge_commitments (
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge_id uuid not null references public.challenges(id) on delete restrict,
  committed_at timestamptz not null default now(),
  primary key (user_id, challenge_id)
);

create index challenge_commitments_user_idx on public.challenge_commitments (user_id, committed_at);
alter table public.challenge_commitments enable row level security;
revoke all on table public.challenge_commitments from anon, authenticated;
grant select on table public.challenge_commitments to authenticated;

create policy "players read own commitments"
on public.challenge_commitments for select to authenticated
using ((select auth.uid()) = user_id);

create function private.enroll_challenge(target_challenge_id uuid)
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

  select * into target from public.challenges
  where id = target_challenge_id and archived_at is null;
  if not found then raise exception 'Challenge not found' using errcode = 'P0002'; end if;
  if current_date < target.starts_on or current_date > target.ends_on then
    raise exception 'Challenge is not currently available' using errcode = '22023';
  end if;

  insert into public.challenge_commitments (user_id, challenge_id)
  values (caller_id, target_challenge_id)
  on conflict (user_id, challenge_id) do nothing;
end;
$$;

create function public.enroll_challenge(target_challenge_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$ select private.enroll_challenge(target_challenge_id) $$;

revoke execute on function private.enroll_challenge(uuid), public.enroll_challenge(uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.enroll_challenge(uuid), public.enroll_challenge(uuid) to authenticated;

drop function if exists public.player_challenges(text);
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
as $$
  select challenges.*
  from private.player_challenges(target_period_key) as challenges
  where exists (
    select 1 from public.challenge_commitments commitment
    where commitment.user_id = (select auth.uid())
      and commitment.challenge_id = challenges.id
  )
$$;

grant execute on function public.player_challenges(text) to authenticated;
