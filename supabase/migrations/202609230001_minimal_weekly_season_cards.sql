update public.challenges
set entry_step = null
where lower(title) = '1000 squats'
  and frequency = 'weekly';

update public.challenges
set requires_approval = true
where frequency = 'once';