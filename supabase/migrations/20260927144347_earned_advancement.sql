-- Earn the next configured level through fourteen complete days / two complete weeks.
alter table public.arc_commitments
 add column qualification_started_at timestamptz not null default now(),
 add column offered_target integer,
 add column offer_dismissed_until timestamptz;
update public.arc_commitments set qualification_started_at=created_at;

-- Only guarded callers invoke this helper. Once earned, an offer persists until resolved.
create function private.arc_advancement_offers(owner_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare c public.arc_commitments; next_target integer; boundary timestamptz; cadence interval; required integer;
begin
 for c in select * from public.arc_commitments where user_id=owner_id and active and frequency<>'once'
 and starts_at<=now() and ends_at>now() order by id for update loop
  if c.offered_target is not null or c.pending_target is not null or c.offer_dismissed_until>now() then continue; end if;
  select min(value::text::int) into next_target from jsonb_array_elements(c.rules->'targets') where value::text::int>c.target;
  if next_target is null then continue; end if;
  required:=case when c.frequency='weekly' then 2 else 14 end;
  cadence:=case when c.frequency='weekly' then interval '1 week' else interval '1 day' end;
  boundary:=date_trunc(case when c.frequency='weekly' then 'week' else 'day' end,now() at time zone 'Asia/Karachi') at time zone 'Asia/Karachi';
  if boundary-cadence*required<c.qualification_started_at then continue; end if;
  if not exists (
   select 1 from generate_series(1,required) n
   where not exists (
    select 1 from public.arc_periods p where p.commitment_id=c.id
    and p.starts_at=boundary-cadence*n and p.ends_at=boundary-cadence*(n-1)
    and p.target=c.target and p.progress>=p.target and p.status not in ('pending','rejected','failed')
   )
  ) then update public.arc_commitments set offered_target=next_target where id=c.id; end if;
 end loop;
 return (select coalesce(jsonb_agg(jsonb_build_object(
  'commitmentId',offered.id,'title',offered.title,'unit',offered.rules->>'unit','currentTarget',offered.target,
  'nextTarget',offered.offered_target,'reward',private.arc_reward(offered.rules,offered.offered_target,offered.offered_target),
  'maximumPenalty',case when offered.rules->>'penalty'='baseline' then private.arc_reward(offered.rules,offered.offered_target,offered.offered_target) else 0 end
 ) order by offered.created_at,offered.id),'[]') from public.arc_commitments offered
 where offered.user_id=owner_id and offered.active and offered.ends_at>now() and offered.offered_target is not null);
end $$;
revoke all on function private.arc_advancement_offers(uuid) from public,anon,authenticated;

create or replace function private.arc_upgrade(commitment uuid,new_target integer) returns void
language plpgsql security definer set search_path='' as $$
declare c public.arc_commitments; p public.arc_periods; earned integer;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 perform private.arc_maintain(auth.uid());
 perform private.arc_advancement_offers(auth.uid());
 select * into c from public.arc_commitments where id=commitment and user_id=auth.uid() and active for update;
 if not found or c.frequency='once' or c.ends_at<=now() then raise exception 'Recurring commitment required'; end if;
 if new_target is null or c.offered_target is null or new_target<>c.offered_target then
  raise exception 'Complete every target for two full weeks to unlock the next level';
 end if;
 select * into p from public.arc_periods where commitment_id=c.id and starts_at<=now() and ends_at>now() for update;
 if not found or p.status<>'open' then raise exception 'No active period to advance'; end if;
 -- Keep all logged progress and already-earned XP, including the old completion bonus.
 earned:=greatest(p.reward,private.arc_reward(p.rules,new_target,p.progress));
 insert into public.arc_xp(user_id,period_id,category,amount,reason,event_key)
 values(c.user_id,p.id,p.category,earned-p.reward,'Baseline advanced',p.id||':upgrade:'||new_target);
 update public.arc_periods set target=new_target,reward=earned where id=p.id;
 update public.arc_commitments set target=new_target,pending_target=null,pending_at=null,
  qualification_started_at=now(),offered_target=null,offer_dismissed_until=null where id=c.id;
end $$;

create function private.arc_dismiss_advancement(commitment uuid,offered_target integer) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 perform private.arc_maintain(auth.uid());
 update public.arc_commitments c set offered_target=null,offer_dismissed_until=now()+interval '7 days'
 where c.id=commitment and c.user_id=auth.uid() and c.active and c.offered_target=$2;
 if not found then raise exception 'This offer is no longer available'; end if;
end $$;
create function public.arc_dismiss_advancement(commitment uuid,offered_target integer) returns void
language sql security invoker set search_path='' as $$ select private.arc_dismiss_advancement(commitment,offered_target) $$;
revoke all on function private.arc_dismiss_advancement(uuid,integer),public.arc_dismiss_advancement(uuid,integer) from public,anon,authenticated;
grant execute on function private.arc_dismiss_advancement(uuid,integer),public.arc_dismiss_advancement(uuid,integer) to authenticated;

-- Preserve earned XP when an immediate upgrade raises the reward gate.
create or replace function private.arc_record(commitment uuid,amount integer,request_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare c public.arc_commitments; p public.arc_periods; old_entry public.arc_entries; earned integer; needs_proof boolean;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 if request_id is null or amount is null or amount<=0 then raise exception 'Positive whole amount and request ID required'; end if;
 perform private.arc_maintain(auth.uid());
 select * into c from public.arc_commitments where id=commitment and user_id=auth.uid() for update;
 if not found then raise exception 'Commitment not found'; end if;
 select * into old_entry from public.arc_entries where id=request_id;
 if found then
 if old_entry.user_id<>auth.uid() or old_entry.amount<>amount or not exists(select 1 from public.arc_periods where id=old_entry.period_id and commitment_id=c.id) then raise exception 'Request ID already used'; end if;
 return;
 end if;
 if not c.active then raise exception 'Attempt ended; start another attempt'; end if;
 select * into p from public.arc_periods where commitment_id=c.id and starts_at<=now() and ends_at>now() order by starts_at desc limit 1 for update;
 if not found then raise exception 'This commitment has not started'; end if;
 if p.status<>'open' then raise exception 'This attempt is already submitted or completed'; end if;
 if (p.rules->>'step')::int>0 and amount<>(p.rules->>'step')::int then raise exception 'Use the configured entry amount'; end if;
 if p.rules->>'mode'='binary' and amount<>1 then raise exception 'Submit one completion'; end if;
 if p.progress+amount>private.arc_cap(p.rules,p.target) then raise exception 'Entry exceeds the progress cap'; end if;
 if p.last_entry_at is not null and p.entry_count % (p.rules->>'burst')::int=0
 and now()<p.last_entry_at+make_interval(mins=>(p.rules->>'cooldownMinutes')::int) then raise exception 'Wait for the cooldown to finish'; end if;
 insert into public.arc_entries(id,period_id,user_id,amount) values(request_id,p.id,auth.uid(),amount);
 needs_proof:=(p.rules->>'approval')::boolean;
 earned:=case when needs_proof then 0 else greatest(p.reward,private.arc_reward(p.rules,p.target,p.progress+amount)) end;
 insert into public.arc_xp(user_id,period_id,category,amount,reason,event_key)
 values(auth.uid(),p.id,p.category,earned-p.reward,'Progress reward',request_id||':reward');
 update public.arc_periods set progress=progress+amount,entry_count=entry_count+1,last_entry_at=now(),reward=earned,
 status=case when needs_proof then 'pending' when c.frequency='once' and progress+amount>=target then 'confirmed' else 'open' end
 where id=p.id;
 if c.frequency='once' and not needs_proof and p.progress+amount>=p.target then
 update public.arc_commitments set active=false where id=c.id;
 update public.arc_periods set settled_at=now() where id=p.id;
 end if;
end $$;


create or replace function private.arc_snapshot() returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); result jsonb;
begin
 if caller is null then raise exception 'Sign in required'; end if;
 perform private.arc_maintain(caller);
 select jsonb_build_object(
 'advancement_offers',private.arc_advancement_offers(caller),
 'profile',(select to_jsonb(p) from public.profiles p where id=caller),
 'seasons',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from public.arc_seasons s),
 'catalog',(select coalesce(jsonb_agg(to_jsonb(d)||jsonb_build_object('target_rewards',
 (select jsonb_object_agg(t::text,private.arc_reward(d.rules,t::text::int,t::text::int))
 from jsonb_array_elements(d.rules->'targets') t)) order by d.created_at,d.id),'[]') from public.arc_challenges d
 join public.arc_seasons s on s.id=d.season_id where (private.arc_admin() or (d.published and not d.archived))
 and s.ends_on >= (now() at time zone s.timezone)::date),
 'challenges',(select coalesce(jsonb_agg(
 jsonb_build_object('id',c.id,'catalog_id',c.challenge_id,'title',c.title,'description',d.description,
 'category',c.category,'frequency',c.frequency,'rules',coalesce(p.rules,c.rules),'target',coalesce(p.target,c.target),
 'starts_at',coalesce(p.starts_at,c.starts_at),'ends_at',coalesce(p.ends_at,c.ends_at),
 'pending_target',c.pending_target,'pending_at',c.pending_at,'period_id',p.id,'progress',coalesce(p.progress,0),
 'reward',coalesce(p.reward,0),'penalty',coalesce(p.penalty,0),'status',coalesce(p.status,'scheduled'),
 'baseline_reward',private.arc_reward(coalesce(p.rules,c.rules),coalesce(p.target,c.target),coalesce(p.target,c.target)),
 'max_progress',private.arc_cap(coalesce(p.rules,c.rules),coalesce(p.target,c.target)),
 'cooldown_ends_at',case when p.entry_count>0 and p.entry_count % (p.rules->>'burst')::int=0 then
 p.last_entry_at+make_interval(mins=>(p.rules->>'cooldownMinutes')::int) end,
 'active',c.active)
 order by c.created_at,c.id),'[]')
 from public.arc_commitments c join public.arc_challenges d on d.id=c.challenge_id
 left join lateral (select * from public.arc_periods where commitment_id=c.id order by starts_at desc limit 1) p on true
 where c.user_id=caller),
 'leaderboard',(select coalesce(jsonb_agg(to_jsonb(r) order by r.points desc,r.display_name,r.id),'[]') from (
 select p.id,p.display_name,coalesce(sum(x.amount),0)::integer points,
 (select count(*) from public.arc_periods ap where ap.user_id=p.id and ap.progress>=ap.target
 and ap.status not in ('pending','rejected','failed')) completed_count
 from public.profiles p left join public.arc_xp x on x.user_id=p.id group by p.id) r),
 'legacy_points',(select coalesce(sum(amount),0) from public.arc_xp where user_id=caller and category is null),
 'stats',(select jsonb_build_object('body',coalesce(sum(amount) filter(where category='body'),0),
 'mind',coalesce(sum(amount) filter(where category='mind'),0),'soul',coalesce(sum(amount) filter(where category='soul'),0),
 'craft',coalesce(sum(amount) filter(where category='craft'),0)) from public.arc_xp where user_id=caller),
 'daily_history',(select coalesce(jsonb_agg(to_jsonb(h) order by h.day),'[]') from (
 select (p.starts_at at time zone 'Asia/Karachi')::date as "day",
 bool_and(p.progress>=p.target and p.status not in ('pending','rejected','failed')) completed
 from public.arc_periods p join public.arc_commitments c on c.id=p.commitment_id
 where p.user_id=caller and c.frequency='daily' group by 1) h),
 'pending',case when private.arc_admin() then (select coalesce(jsonb_agg(
 jsonb_build_object('id',p.id,'challengeId',c.id,'playerName',u.display_name,'challengeTitle',c.title,
 'pointsAwarded',private.arc_reward(p.rules,p.target,p.target),'status','pending','completedAt',p.last_entry_at,'periodKey',p.starts_at)
 order by p.last_entry_at),'[]')
 from public.arc_periods p join public.arc_commitments c on c.id=p.commitment_id
 join public.profiles u on u.id=p.user_id where p.status='pending') else '[]'::jsonb end,
 'ideas',case when private.arc_admin() then (select coalesce(jsonb_agg(
 jsonb_build_object('id',i.id,'title',i.title,'description',i.description,'status',i.status,
 'submittedBy',i.user_id,'submittedAt',i.created_at,'playerName',p.display_name) order by i.created_at),'[]')
 from public.arc_ideas i join public.profiles p on p.id=i.user_id where i.status='pending') else '[]'::jsonb end
 ) into result;
 return result;
end $$;

