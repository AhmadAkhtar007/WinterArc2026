update public.challenges
set starts_on = least(starts_on, date '2026-09-22')
where lower(title) in ('hydration protocol', '100 push-ups', '100 pushups per day', 'read nonfiction', 'daily salah')
  and archived_at is null;