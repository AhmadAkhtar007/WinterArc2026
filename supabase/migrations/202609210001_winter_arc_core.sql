create type public.challenge_frequency as enum ('daily', 'weekly', 'once');
create type public.completion_status as enum ('pending', 'confirmed', 'reversed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 40),
  avatar_seed text not null default '',
  created_at timestamptz not null default now()
);

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 80),
  description text not null check (char_length(description) between 2 and 500),
  frequency public.challenge_frequency not null,
  points integer not null check (points between 1 and 5000),
  requires_approval boolean not null default false,
  starts_on date not null,
  ends_on date not null,
  created_by uuid not null references auth.users(id),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  constraint challenge_dates_valid check (ends_on >= starts_on)
);

create table public.completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge_id uuid not null references public.challenges(id),
  period_key text not null check (char_length(period_key) between 4 and 20),
  points_awarded integer not null check (points_awarded between 1 and 5000),
  status public.completion_status not null,
  completed_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  unique (user_id, challenge_id, period_key)
);

create table public.completion_reversals (
  id uuid primary key default gen_random_uuid(),
  completion_id uuid not null unique references public.completions(id),
  reversed_by uuid not null references auth.users(id),
  reason text not null check (char_length(reason) between 3 and 300),
  created_at timestamptz not null default now()
);

create index completions_leaderboard_idx on public.completions (status, user_id) include (points_awarded);
create index completions_user_history_idx on public.completions (user_id, completed_at desc);
create index challenges_active_idx on public.challenges (starts_on, ends_on) where archived_at is null;

alter table public.profiles enable row level security;
alter table public.challenges enable row level security;
alter table public.completions enable row level security;
alter table public.completion_reversals enable row level security;

revoke all on table public.profiles, public.challenges, public.completions, public.completion_reversals from anon, authenticated;
grant select, update (display_name, avatar_seed) on table public.profiles to authenticated;
grant select, insert, update (title, description, frequency, points, requires_approval, starts_on, ends_on, archived_at) on table public.challenges to authenticated;
grant select on table public.completions to authenticated;
grant select on table public.completion_reversals to authenticated;

create policy "authenticated players read profiles"
on public.profiles for select to authenticated using ((select auth.uid()) is not null);

create policy "players update own profile"
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "authenticated players read challenges"
on public.challenges for select to authenticated using ((select auth.uid()) is not null);

create policy "admins create challenges"
on public.challenges for insert to authenticated
with check (
  (select auth.uid()) = created_by
  and coalesce((select auth.jwt()->'app_metadata'->>'role'), '') = 'admin'
);

create policy "admins update challenges"
on public.challenges for update to authenticated
using (coalesce((select auth.jwt()->'app_metadata'->>'role'), '') = 'admin')
with check (coalesce((select auth.jwt()->'app_metadata'->>'role'), '') = 'admin');

create policy "players read leaderboard own history and admin queue"
on public.completions for select to authenticated
using (
  status = 'confirmed'
  or (select auth.uid()) = user_id
  or coalesce((select auth.jwt()->'app_metadata'->>'role'), '') = 'admin'
);

create policy "admins read reversal audit"
on public.completion_reversals for select to authenticated
using (coalesce((select auth.jwt()->'app_metadata'->>'role'), '') = 'admin');

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create function private.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce((select auth.jwt()->'app_metadata'->>'role'), '') = 'admin'
$$;

create function private.complete_challenge(target_challenge_id uuid)
returns public.completions
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  target public.challenges;
  period text;
  created public.completions;
  local_now timestamp := timezone('Asia/Karachi', now());
begin
  if caller_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;

  select * into target from public.challenges
  where id = target_challenge_id and archived_at is null
  for share;
  if not found then raise exception 'Challenge not found' using errcode = 'P0002'; end if;
  if local_now::date < target.starts_on or local_now::date > target.ends_on then
    raise exception 'Challenge is outside its active window' using errcode = '22023';
  end if;

  period := case target.frequency
    when 'daily' then to_char(local_now, 'YYYY-MM-DD')
    when 'weekly' then to_char(local_now, 'IYYY-"W"IW')
    else '2026-season'
  end;

  insert into public.completions (user_id, challenge_id, period_key, points_awarded, status)
  values (caller_id, target.id, period, target.points, case when target.requires_approval then 'pending'::public.completion_status else 'confirmed'::public.completion_status end)
  returning * into created;
  return created;
exception
  when unique_violation then
    raise exception 'Challenge already completed for this period' using errcode = '23505';
end;
$$;

create function private.review_completion(target_completion_id uuid, decision public.completion_status)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Administrator required' using errcode = '42501'; end if;
  if decision not in ('confirmed', 'reversed') then raise exception 'Invalid review decision' using errcode = '22023'; end if;
  update public.completions set status = decision, reviewed_at = now(), reviewed_by = (select auth.uid())
  where id = target_completion_id and status = 'pending';
  if not found then raise exception 'Pending completion not found' using errcode = 'P0002'; end if;
end;
$$;

create function private.reverse_completion(target_completion_id uuid, reversal_reason text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Administrator required' using errcode = '42501'; end if;
  if char_length(trim(reversal_reason)) not between 3 and 300 then raise exception 'Reason must be 3 to 300 characters' using errcode = '22023'; end if;
  update public.completions set status = 'reversed', reviewed_at = now(), reviewed_by = (select auth.uid())
  where id = target_completion_id and status <> 'reversed';
  if not found then raise exception 'Completion not found or already reversed' using errcode = 'P0002'; end if;
  insert into public.completion_reversals (completion_id, reversed_by, reason)
  values (target_completion_id, (select auth.uid()), trim(reversal_reason));
end;
$$;

create function public.complete_challenge(target_challenge_id uuid)
returns public.completions language sql security invoker set search_path = ''
as $$ select private.complete_challenge(target_challenge_id) $$;

create function public.review_completion(target_completion_id uuid, decision public.completion_status)
returns void language sql security invoker set search_path = ''
as $$ select private.review_completion(target_completion_id, decision) $$;

create function public.reverse_completion(target_completion_id uuid, reversal_reason text)
returns void language sql security invoker set search_path = ''
as $$ select private.reverse_completion(target_completion_id, reversal_reason) $$;

revoke execute on all functions in schema private from public, anon, authenticated;
revoke execute on function public.complete_challenge(uuid) from public, anon;
revoke execute on function public.review_completion(uuid, public.completion_status) from public, anon;
revoke execute on function public.reverse_completion(uuid, text) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.complete_challenge(uuid), private.review_completion(uuid, public.completion_status), private.reverse_completion(uuid, text) to authenticated;
grant execute on function public.complete_challenge(uuid), public.review_completion(uuid, public.completion_status), public.reverse_completion(uuid, text) to authenticated;

create function private.create_profile_for_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, avatar_seed)
  values (new.id, left(coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)), 40), new.id::text);
  return new;
end;
$$;

revoke execute on function private.create_profile_for_user() from public, anon, authenticated;
create trigger create_profile_after_signup after insert on auth.users for each row execute function private.create_profile_for_user();
