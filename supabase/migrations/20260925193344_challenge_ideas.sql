create table public.challenge_ideas (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 80),
  description text not null check (char_length(description) between 3 and 500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  assigned_points integer check (assigned_points between 1 and 5000),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint challenge_idea_review_valid check (
    (status = 'pending' and assigned_points is null and reviewed_by is null and reviewed_at is null)
    or (status = 'rejected' and assigned_points is null and reviewed_by is not null and reviewed_at is not null)
    or (status = 'approved' and assigned_points is not null and reviewed_by is not null and reviewed_at is not null)
  )
);

create index challenge_ideas_pending_idx
on public.challenge_ideas (created_at)
where status = 'pending';

alter table public.challenge_ideas enable row level security;
revoke all on table public.challenge_ideas from anon, authenticated;
grant select on table public.challenge_ideas to authenticated;

create policy "players read own ideas and admins read queue"
on public.challenge_ideas for select to authenticated
using (
  (select auth.uid()) = submitted_by
  or coalesce((select auth.jwt()->'app_metadata'->>'role'), '') = 'admin'
);

create function private.submit_challenge_idea(idea_title text, idea_description text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  created_id uuid;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if char_length(trim(idea_title)) not between 2 and 80 then
    raise exception 'Idea title must be 2 to 80 characters' using errcode = '22023';
  end if;
  if char_length(trim(idea_description)) not between 3 and 500 then
    raise exception 'Idea description must be 3 to 500 characters' using errcode = '22023';
  end if;

  insert into public.challenge_ideas (submitted_by, title, description)
  values (caller_id, trim(idea_title), trim(idea_description))
  returning id into created_id;

  return created_id;
end;
$$;

create function private.review_challenge_idea(
  target_idea_id uuid,
  decision text,
  challenge_frequency public.challenge_frequency default null,
  challenge_points integer default null,
  completion_requires_approval boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  idea public.challenge_ideas;
  reviewer_id uuid := (select auth.uid());
begin
  if not private.is_admin() then
    raise exception 'Administrator required' using errcode = '42501';
  end if;
  if decision not in ('approved', 'rejected') then
    raise exception 'Invalid review decision' using errcode = '22023';
  end if;

  select * into idea
  from public.challenge_ideas
  where id = target_idea_id and status = 'pending'
  for update;

  if not found then
    raise exception 'Pending idea not found' using errcode = 'P0002';
  end if;

  if decision = 'approved' then
    if challenge_frequency is null or challenge_points is null or challenge_points not between 1 and 5000 then
      raise exception 'Frequency and XP are required for approval' using errcode = '22023';
    end if;

    insert into public.challenges (
      title,
      description,
      frequency,
      points,
      requires_approval,
      starts_on,
      ends_on,
      created_by,
      tracking_mode,
      scoring_profile
    )
    values (
      idea.title,
      idea.description,
      challenge_frequency,
      challenge_points,
      completion_requires_approval,
      '2026-09-23',
      '2026-12-31',
      reviewer_id,
      'binary',
      'standard'
    );

    update public.challenge_ideas
    set status = 'approved',
        assigned_points = challenge_points,
        reviewed_by = reviewer_id,
        reviewed_at = now()
    where id = target_idea_id;
  else
    update public.challenge_ideas
    set status = 'rejected',
        reviewed_by = reviewer_id,
        reviewed_at = now()
    where id = target_idea_id;
  end if;
end;
$$;

create function public.submit_challenge_idea(idea_title text, idea_description text)
returns uuid
language sql
security invoker
set search_path = ''
as $$ select private.submit_challenge_idea(idea_title, idea_description) $$;

create function public.review_challenge_idea(
  target_idea_id uuid,
  decision text,
  challenge_frequency public.challenge_frequency default null,
  challenge_points integer default null,
  completion_requires_approval boolean default false
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.review_challenge_idea(
    target_idea_id,
    decision,
    challenge_frequency,
    challenge_points,
    completion_requires_approval
  )
$$;

revoke execute on function private.submit_challenge_idea(text, text) from public, anon;
revoke execute on function private.review_challenge_idea(uuid, text, public.challenge_frequency, integer, boolean) from public, anon;
revoke execute on function public.submit_challenge_idea(text, text) from public, anon;
revoke execute on function public.review_challenge_idea(uuid, text, public.challenge_frequency, integer, boolean) from public, anon;

grant execute on function private.submit_challenge_idea(text, text) to authenticated;
grant execute on function private.review_challenge_idea(uuid, text, public.challenge_frequency, integer, boolean) to authenticated;
grant execute on function public.submit_challenge_idea(text, text) to authenticated;
grant execute on function public.review_challenge_idea(uuid, text, public.challenge_frequency, integer, boolean) to authenticated;
