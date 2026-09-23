update public.challenges
set archived_at = coalesce(archived_at, now())
where frequency = 'daily'
  and tracking_mode = 'binary'
  and lower(title) = '2.5l water per day';

update public.challenges
set title = '2.5L water'
where frequency = 'daily' and lower(title) = '2.5l water per day';

update public.challenges
set title = '100 Pushups'
where frequency = 'daily' and lower(title) = '100 pushups per day';

update public.challenges
set title = '20 Pullups', points = 12
where frequency = 'daily' and lower(title) = '20 pullups per day';

update public.challenges
set title = 'Read Nonfiction', tracking_target = 8, points = 10,
    reward_tiers = '[{"threshold":8,"points":10}]'::jsonb
where frequency = 'daily' and lower(title) = 'read nonfiction';

update public.challenges
set title = 'Salah in Congregation with first takbeer', minimum_interval_minutes = 60
where frequency = 'daily' and lower(title) = 'daily salah';

update public.challenges
set title = 'Build & Ship an App that solves a real-world problem', requires_approval = true
where frequency = 'once' and lower(title) in ('build & ship an app', 'ship something real');

update public.challenges
set entry_step = null
where frequency = 'weekly' and lower(title) = '1000 squats';

do $$
declare
  creator uuid;
begin
  select id into creator from auth.users order by created_at limit 1;
  if creator is null then return; end if;

  insert into public.challenges (id, title, description, frequency, points, requires_approval, starts_on, ends_on, created_by, tracking_mode)
  values
    ('10000000-0000-4000-8000-000000000010', 'Sell $100 worth of Digital Products', 'Reach the sales target and submit proof for review.', 'once', 100, true, '2026-09-23', '2026-12-31', creator, 'binary'),
    ('10000000-0000-4000-8000-000000000011', 'Close a $500 service deal', 'Close the deal and submit proof for review.', 'once', 500, true, '2026-09-23', '2026-12-31', creator, 'binary'),
    ('10000000-0000-4000-8000-000000000012', 'Close a $1000 service deal', 'Close the deal and submit proof for review.', 'once', 1000, true, '2026-09-23', '2026-12-31', creator, 'binary'),
    ('10000000-0000-4000-8000-000000000013', 'Sell $1000 worth of Digital Products', 'Reach the sales target and submit proof for review.', 'once', 1000, true, '2026-09-23', '2026-12-31', creator, 'binary')
  on conflict (id) do update set title = excluded.title, description = excluded.description, points = excluded.points, requires_approval = true;
end;
$$;