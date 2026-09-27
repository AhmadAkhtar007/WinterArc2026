-- Update Water challenge rules: 250ml per glass (10 glasses min for 2.5L) and burst of 4 glasses (1L) before cooldown.
update public.arc_challenges
set rules = jsonb_set(jsonb_set(rules, '{step}', '250'), '{burst}', '4')
where title = 'Water';

update public.arc_commitments
set rules = jsonb_set(jsonb_set(rules, '{step}', '250'), '{burst}', '4')
where title = 'Water';

update public.arc_periods
set rules = jsonb_set(jsonb_set(rules, '{step}', '250'), '{burst}', '4')
where commitment_id in (select id from public.arc_commitments where title = 'Water')
  and status = 'open';
