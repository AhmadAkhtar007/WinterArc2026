begin;
create function pg_temp.assert_true(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; end $$;
create function pg_temp.expect_error(command text,label text) returns void language plpgsql as $$
declare failed boolean:=false; begin
 begin execute command; exception when others then failed:=true; end;
 if not failed then raise exception 'FAIL expected rejection: %',label; end if;
end $$;
insert into auth.users(id,email,raw_user_meta_data)
values('91000000-0000-4000-8000-000000000001','advancement-test@example.invalid','{"display_name":"Advancement Test"}'),
('91000000-0000-4000-8000-000000000002','advancement-other@example.invalid','{"display_name":"Other"}');
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
update public.arc_seasons set starts_on=current_date-100,ends_on=current_date+100;
select public.arc_join('20260000-0000-4000-8000-000000000002',50);
select public.arc_join('20260000-0000-4000-8000-000000000005',1);

do $$ declare c public.arc_commitments; boundary timestamptz; cadence interval; required integer; daily uuid; weekly uuid; offers jsonb; saved_reward integer; begin
 select id into daily from public.arc_commitments where user_id=auth.uid() and title='Pushups';
 select id into weekly from public.arc_commitments where user_id=auth.uid() and title='Gym';
 perform pg_temp.expect_error(format('select public.arc_upgrade(%L,100)',daily),'day-one upgrade blocked');
 for c in select * from public.arc_commitments where user_id=auth.uid() loop
  cadence:=case when c.frequency='weekly' then interval '1 week' else interval '1 day' end;
  required:=case when c.frequency='weekly' then 2 else 14 end;
  boundary:=date_trunc(case when c.frequency='weekly' then 'week' else 'day' end,now() at time zone 'Asia/Karachi') at time zone 'Asia/Karachi';
  update public.arc_commitments set qualification_started_at=boundary-cadence*required where id=c.id;
  insert into public.arc_periods(commitment_id,user_id,starts_at,ends_at,target,rules,category,progress,status,settled_at)
  select c.id,c.user_id,boundary-cadence*n,boundary-cadence*(n-1),c.target,c.rules,c.category,c.target,'confirmed',now()
  from generate_series(1,required) n;
 end loop;
 -- One missed day or week disqualifies, even with all other periods complete.
 update public.arc_periods set progress=0 where id in (
  select distinct on (commitment_id) id from public.arc_periods where user_id=auth.uid() and ends_at<=now() order by commitment_id,starts_at);
 offers:=private.arc_advancement_offers(auth.uid());
 perform pg_temp.assert_true(jsonb_array_length(offers)=0,'100 percent required for both cadences');
 update public.arc_periods set progress=target where user_id=auth.uid() and ends_at<=now();
 offers:=private.arc_advancement_offers(auth.uid());
 perform pg_temp.assert_true(jsonb_array_length(offers)=2,'14 days and 2 weeks unlock offers');
 perform pg_temp.expect_error(format('select public.arc_upgrade(%L,150)',daily),'cannot skip next level');
 -- Already-earned offer persists until resolved.
 update public.arc_periods set progress=0 where commitment_id=daily and ends_at<=now();
 perform pg_temp.assert_true(jsonb_array_length(private.arc_advancement_offers(auth.uid()))=2,'offer persists until decision');
 perform public.arc_dismiss_advancement(daily,100);
 perform pg_temp.assert_true((select offer_dismissed_until>now()+interval '6 days 23 hours' from public.arc_commitments where id=daily),'dismissal stored for 7 days');
 perform pg_temp.assert_true(jsonb_array_length(private.arc_advancement_offers(auth.uid()))=1,'dismissal hides offer');
 perform pg_temp.expect_error(format('select public.arc_upgrade(%L,100)',daily),'dismissal enforced by backend');
 update public.arc_commitments set offer_dismissed_until=now()-interval '1 second' where id=daily;
 perform pg_temp.assert_true(jsonb_array_length(private.arc_advancement_offers(auth.uid()))=1,'eligibility rechecked after dismissal');
 update public.arc_periods set progress=target where commitment_id=daily and ends_at<=now();
 perform pg_temp.assert_true(jsonb_array_length(private.arc_advancement_offers(auth.uid()))=2,'eligible offer returns after dismissal');
 -- Upgrade in the middle of the period; keep XP even while the new gate is unmet.
 perform public.arc_record(daily,50,gen_random_uuid());
 perform public.arc_upgrade(daily,100);
 perform pg_temp.assert_true((select target=100 and offered_target is null and pending_target is null from public.arc_commitments where id=daily),'upgrade applies immediately');
 perform pg_temp.assert_true((select target=100 and progress=50 and reward=5 from public.arc_periods where commitment_id=daily and ends_at>now()),'current progress and XP preserved');
 perform public.arc_record(daily,10,gen_random_uuid());
 perform pg_temp.assert_true((select reward=5 from public.arc_periods where commitment_id=daily and ends_at>now()),'raised gate does not claw back earned XP');
 perform public.arc_record(daily,40,gen_random_uuid());
 perform pg_temp.assert_true((select progress=100 and reward=10 from public.arc_periods where commitment_id=daily and ends_at>now()),'new reward awarded only as delta');
 perform pg_temp.expect_error(format('select public.arc_upgrade(%L,150)',daily),'qualification cycle resets');
 perform public.arc_record(weekly,1,gen_random_uuid());
 perform public.arc_upgrade(weekly,2);
 perform pg_temp.assert_true((select target=2 and progress=1 and reward=60 from public.arc_periods where commitment_id=weekly and ends_at>now()),'weekly immediate target preserves session bonus');
 perform pg_temp.assert_true(jsonb_array_length(private.arc_snapshot()->'advancement_offers')=0,'resolved offers removed from snapshot');
 update public.arc_periods set last_entry_at=now()-interval '13 hours' where commitment_id=weekly and ends_at>now();
 perform public.arc_record(weekly,1,gen_random_uuid());
 perform pg_temp.assert_true((select reward=70 from public.arc_periods where commitment_id=weekly and ends_at>now()),'weekly bonus is not awarded twice');
 -- Simulate a fresh successful fortnight at the raised daily baseline.
 update public.arc_commitments set qualification_started_at=(date_trunc('day',now() at time zone 'Asia/Karachi') at time zone 'Asia/Karachi')-interval '14 days' where id=daily;
 update public.arc_periods set target=100,progress=100 where commitment_id=daily and ends_at<=now();
 perform private.arc_advancement_offers(auth.uid());
 perform pg_temp.assert_true((select offered_target=150 from public.arc_commitments where id=daily),'next fortnight unlocks only the next level');

 perform set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000002',true);
 perform pg_temp.expect_error(format('select public.arc_upgrade(%L,150)',daily),'another player cannot advance');
 perform pg_temp.expect_error(format('select public.arc_dismiss_advancement(%L,150)',daily),'another player cannot dismiss');
 perform pg_temp.assert_true(not has_function_privilege('authenticated','private.arc_advancement_offers(uuid)','execute'),'internal helper not exposed');
end $$;
rollback;
