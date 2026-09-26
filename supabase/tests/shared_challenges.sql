begin;
create function pg_temp.assert_true(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; end $$;
create function pg_temp.expect_error(command text,label text) returns void language plpgsql as $$
declare failed boolean:=false; begin
 begin execute command; exception when others then failed:=true; end;
 if not failed then raise exception 'FAIL expected rejection: %',label; end if;
end $$;
insert into auth.users(id,email,raw_user_meta_data)
values('90000000-0000-4000-8000-000000000001','arc-test-1@example.invalid','{"display_name":"Test One"}'),
('90000000-0000-4000-8000-000000000002','arc-test-2@example.invalid','{"display_name":"Test Two"}');
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{}}',true);
update public.arc_seasons set starts_on=current_date-100,ends_on=current_date+100;

do $$ declare r jsonb; begin
 select rules into r from public.arc_challenges where title='Pushups';
 perform pg_temp.assert_true(private.arc_reward(r,100,99)=0,'pushups gate');
 perform pg_temp.assert_true(private.arc_reward(r,100,100)=10,'pushups baseline');
 perform pg_temp.assert_true(private.arc_reward(r,100,120)=12,'pushups bonus');
 perform pg_temp.assert_true(private.arc_reward(r,50,80)=8,'smaller baseline bonus');
 perform pg_temp.assert_true(private.arc_reward(r,100,500)=20,'pushups cap');
 select rules into r from public.arc_challenges where title='Pullups';
 perform pg_temp.assert_true(private.arc_reward(r,8,7)=0,'pullups gate');
 perform pg_temp.assert_true(private.arc_reward(r,8,8)=5 and private.arc_reward(r,8,16)=10,'pullups light');
 perform pg_temp.assert_true(private.arc_reward(r,20,20)=12 and private.arc_reward(r,20,40)=24,'pullups heavy');
 select rules into r from public.arc_challenges where title='Water';
 perform pg_temp.assert_true(private.arc_reward(r,2500,2000)=0,'water gate');
 perform pg_temp.assert_true(private.arc_reward(r,2500,2500)=8 and private.arc_reward(r,2500,3000)=10,'water base and extra');
 perform pg_temp.assert_true(private.arc_reward(r,3500,3000)=0 and private.arc_reward(r,3500,4000)=16,'water chosen baseline');
 select rules into r from public.arc_challenges where title='Gym';
 perform pg_temp.assert_true(private.arc_reward(r,3,2)=20 and private.arc_reward(r,3,3)=80,'gym immediate and bonus');
 perform pg_temp.assert_true(private.arc_reward(r,3,4)=90 and private.arc_reward(r,3,10)=120,'gym beyond baseline and hard cap');
 select rules into r from public.arc_challenges where title like 'Salah%';
 perform pg_temp.assert_true(private.arc_reward(r,5,3)=15,'salah partial XP');
 select rules into r from public.arc_challenges where title='Read Nonfiction';
 perform pg_temp.assert_true(private.arc_reward(r,8,7)=0 and private.arc_reward(r,8,8)=10,'reading milestone');
end $$;

select public.arc_join('20260000-0000-4000-8000-000000000002',100);
select pg_temp.assert_true((select starts_at>now() from public.arc_commitments where user_id=auth.uid()),'recurring starts next day');
-- Simulate the start of the committed period without changing application clock logic.
update public.arc_commitments set starts_at=date_trunc('day',now() at time zone 'Asia/Karachi') at time zone 'Asia/Karachi',
 next_period_at=date_trunc('day',now() at time zone 'Asia/Karachi') at time zone 'Asia/Karachi' where user_id=auth.uid();
select private.arc_maintain(auth.uid());
do $$ declare c uuid; r uuid:=gen_random_uuid(); p uuid; begin
 select id into c from public.arc_commitments where user_id=auth.uid();
 perform public.arc_record(c,60,r);
 perform public.arc_record(c,60,r);
 perform pg_temp.assert_true((select progress=60 and reward=0 from public.arc_periods where commitment_id=c),'idempotent retries and no early XP');
 perform pg_temp.expect_error(format('select public.arc_record(%L,61,%L)',c,r),'request mismatch');
 perform public.arc_record(c,60,gen_random_uuid());
 perform pg_temp.assert_true((select progress=120 and reward=12 from public.arc_periods where commitment_id=c),'bonus awarded exactly once');
 perform pg_temp.expect_error(format('select public.arc_record(%L,100,gen_random_uuid())',c),'hard cap');
 perform public.arc_upgrade(c,150);
 perform pg_temp.assert_true((select target=100 and pending_target=150 from public.arc_commitments where id=c),'upgrade deferred');
 perform pg_temp.assert_true((select target=100 and reward=12 from public.arc_periods where commitment_id=c),'upgrade preserves current period');
 perform pg_temp.expect_error(format('select public.arc_upgrade(%L,50)',c),'downgrade');
 perform set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000002',true);
 perform set_config('request.jwt.claims','{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
 perform pg_temp.expect_error(format('select public.arc_record(%L,1,gen_random_uuid())',c),'other player progress');
 perform pg_temp.assert_true(jsonb_array_length(private.arc_snapshot()->'challenges')=0,'private commitments');
 perform set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000001',true);
 perform set_config('request.jwt.claims','{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
end $$;

-- Missed periods, including periods with no entries, settle once without player activity.
do $$ declare c public.arc_commitments; p uuid; before_count integer; begin
 select * into c from public.arc_commitments where user_id=auth.uid() limit 1;
 insert into public.arc_periods(commitment_id,user_id,starts_at,ends_at,target,rules,category,progress)
 values(c.id,c.user_id,now()-interval '3 days',now()-interval '2 days',100,c.rules,c.category,60) returning id into p;
 perform private.arc_settle(p); perform private.arc_settle(p);
 perform pg_temp.assert_true((select penalty=4 from public.arc_periods where id=p),'proportional shortfall');
 perform pg_temp.assert_true((select count(*)=1 from public.arc_xp where event_key=p||':penalty'),'exactly one penalty');
 update public.arc_commitments set next_period_at=now()-interval '6 days',pending_at=null,pending_target=null where id=c.id;
 perform private.arc_maintain();
 select count(*) into before_count from public.arc_xp where reason='Missed target';
 perform private.arc_maintain();
 perform pg_temp.assert_true((select count(*)=before_count from public.arc_xp where reason='Missed target'),'catch-up idempotency');
 perform pg_temp.assert_true((select count(*)>=4 from public.arc_periods where commitment_id=c.id and penalty=10),'zero-entry days penalized');
end $$;

select public.arc_join('20260000-0000-4000-8000-000000000001',2500);
update public.arc_commitments set starts_at=now()-interval '1 hour',next_period_at=now()-interval '1 hour' where challenge_id='20260000-0000-4000-8000-000000000001';
select private.arc_maintain(auth.uid());
do $$ declare c uuid; begin
 select id into c from public.arc_commitments where challenge_id='20260000-0000-4000-8000-000000000001';
 perform pg_temp.expect_error(format('select public.arc_record(%L,250,gen_random_uuid())',c),'water fixed entry');
 perform public.arc_record(c,500,gen_random_uuid()); perform public.arc_record(c,500,gen_random_uuid()); perform public.arc_record(c,500,gen_random_uuid());
 perform pg_temp.expect_error(format('select public.arc_record(%L,500,gen_random_uuid())',c),'water fourth entry cooldown');
 update public.arc_periods set last_entry_at=now()-interval '31 minutes' where commitment_id=c;
 perform public.arc_record(c,500,gen_random_uuid());
end $$;

select public.arc_join('20260000-0000-4000-8000-000000000006',1000);
do $$ declare c uuid; p uuid; begin
 select id into c from public.arc_commitments where challenge_id='20260000-0000-4000-8000-000000000006' and active;
 perform public.arc_record(c,400,gen_random_uuid());
 perform pg_temp.assert_true((select reward=0 from public.arc_periods where commitment_id=c),'squats no partial XP');
 update public.arc_periods set starts_at=now()-interval '25 hours',ends_at=now()-interval '1 hour' where commitment_id=c;
 perform private.arc_maintain();
 perform pg_temp.expect_error(format('select public.arc_record(%L,600,gen_random_uuid())',c),'expired squat attempt');
 perform pg_temp.assert_true((select status='failed' and penalty=0 from public.arc_periods where commitment_id=c),'squats fail without recurring penalty');
 perform public.arc_join('20260000-0000-4000-8000-000000000006',1000);
 select id into c from public.arc_commitments where challenge_id='20260000-0000-4000-8000-000000000006' and active;
 perform public.arc_record(c,1000,gen_random_uuid());
 perform pg_temp.assert_true((select reward=100 from public.arc_periods where commitment_id=c),'squat success');
end $$;

select public.arc_join('20260000-0000-4000-8000-000000000008',1);
do $$ declare c uuid; p uuid; begin
 select id into c from public.arc_commitments where challenge_id='20260000-0000-4000-8000-000000000008' and active;
 perform public.arc_record(c,1,gen_random_uuid());
 select id into p from public.arc_periods where commitment_id=c;
 perform pg_temp.assert_true((select reward=0 and status='pending' from public.arc_periods where id=p),'proof waits for review');
 perform pg_temp.expect_error(format('select public.arc_review(%L,true)',p),'player cannot approve');
 perform set_config('request.jwt.claims','{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"role":"admin"}}',true);
 perform public.arc_review(p,true);
 perform pg_temp.assert_true((select reward=100 and status='confirmed' from public.arc_periods where id=p),'approved XP');
 perform pg_temp.expect_error(format('select public.arc_review(%L,true)',p),'no duplicate approval');
 perform public.arc_join('20260000-0000-4000-8000-000000000008',1);
 perform pg_temp.assert_true((select count(*)=2 from public.arc_commitments where challenge_id='20260000-0000-4000-8000-000000000008'),'repeatable season');
end $$;

select pg_temp.assert_true(not has_function_privilege('authenticated','private.arc_maintain(uuid)','execute'),'players cannot run global maintenance');
select pg_temp.assert_true(not has_table_privilege('authenticated','public.arc_xp','insert'),'players cannot mint XP');
select pg_temp.assert_true(not has_function_privilege('anon','public.arc_record(uuid,integer,uuid)','execute'),'anonymous entry denied');
select pg_temp.assert_true((select count(*)=7 from pg_class where relnamespace='public'::regnamespace and relname in ('arc_seasons','arc_challenges','arc_commitments','arc_periods','arc_entries','arc_xp','arc_ideas') and relrowsecurity),'RLS on all engine tables');

set local role authenticated;
select pg_temp.assert_true(jsonb_typeof(public.arc_snapshot())='object','authenticated snapshot');
reset role;
rollback;
