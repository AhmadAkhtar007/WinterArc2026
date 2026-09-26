-- A single shared challenge engine. Business content lives in rule data.
create table public.arc_seasons (
 id uuid primary key default gen_random_uuid(), name text not null,
 starts_on date not null, ends_on date not null, timezone text not null default 'Asia/Karachi',
 check(ends_on >= starts_on)
);
create table public.arc_challenges (
 id uuid primary key default gen_random_uuid(), season_id uuid not null references public.arc_seasons,
 title text not null check(length(trim(title)) between 2 and 160),
 description text not null default '', category text not null check(category in ('body','mind','soul','craft')),
 frequency text not null check(frequency in ('daily','weekly','once')),
 rules jsonb not null, published boolean not null default false, archived boolean not null default false,
 version integer not null default 1, created_at timestamptz not null default now()
);
create table public.arc_commitments (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles,
 challenge_id uuid not null references public.arc_challenges, target integer not null check(target>0),
 rules jsonb not null, category text not null, frequency text not null, title text not null,
 starts_at timestamptz not null, ends_at timestamptz not null, next_period_at timestamptz not null,
 pending_target integer check(pending_target>0), pending_at timestamptz,
 active boolean not null default true, created_at timestamptz not null default now(),
 check(ends_at > starts_at)
);
create unique index arc_one_active_commitment on public.arc_commitments(user_id,challenge_id) where active;
create table public.arc_periods (
 id uuid primary key default gen_random_uuid(), commitment_id uuid not null references public.arc_commitments,
 user_id uuid not null references public.profiles, starts_at timestamptz not null, ends_at timestamptz not null,
 target integer not null check(target>0), rules jsonb not null, category text not null,
 progress integer not null default 0 check(progress>=0), entry_count integer not null default 0,
 last_entry_at timestamptz, status text not null default 'open' check(status in ('open','pending','confirmed','rejected','failed','closed')),
 reward integer not null default 0, penalty integer not null default 0,
 settled_at timestamptz, reviewed_by uuid references public.profiles,
 unique(commitment_id,starts_at), check(ends_at>starts_at)
);
create index arc_period_owner on public.arc_periods(user_id,starts_at);
create index arc_period_unsettled on public.arc_periods(ends_at) where settled_at is null;
create table public.arc_entries (
 id uuid primary key, period_id uuid not null references public.arc_periods,
 user_id uuid not null references public.profiles, amount integer not null check(amount>0),
 recorded_at timestamptz not null default now()
);
create index arc_entry_period on public.arc_entries(period_id);
create table public.arc_xp (
 id bigint generated always as identity primary key, user_id uuid not null references public.profiles,
 period_id uuid references public.arc_periods, category text not null check(category in ('body','mind','soul','craft')),
 amount integer not null, reason text not null, event_key text not null unique,
 created_at timestamptz not null default now()
);
create index arc_xp_owner on public.arc_xp(user_id);
create table public.arc_ideas (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles,
 title text not null check(length(trim(title)) between 2 and 160),
 description text not null check(length(trim(description)) between 10 and 2000),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 challenge_id uuid references public.arc_challenges, created_at timestamptz not null default now(),
 reviewed_by uuid references public.profiles
);

create function private.arc_admin() returns boolean language sql stable security invoker set search_path='' as $$
 select coalesce(auth.jwt()->'app_metadata'->>'role','')='admin'
$$;

-- All configurable numbers are bounded, whole numbers. There are no executable expressions in rule data.
create function private.arc_validate(r jsonb, cadence text) returns void language plpgsql immutable set search_path='' as $$
declare k text; n numeric; v jsonb; last_threshold integer:=0; last_points integer:=-1;
begin
 if coalesce(jsonb_typeof(r),'null')<>'object' or not (r ?& array['mode','targets','initialTargets','cap','capMultiplier','step','burst','cooldownMinutes','durationMinutes','rateEvery','ratePoints','targetBonus','gate','milestones','approval','penalty']) then
 raise exception 'Incomplete challenge rules'; end if;
 if coalesce(r->>'mode','') not in ('quantity','occurrence','binary') or coalesce(r->>'gate','') not in ('immediate','target')
 or coalesce(r->>'penalty','') not in ('baseline','none') then raise exception 'Unknown rule option'; end if;
 if jsonb_typeof(r->'approval')<>'boolean' then raise exception 'Approval must be boolean'; end if;
 foreach k in array array['cap','capMultiplier','step','burst','cooldownMinutes','durationMinutes','rateEvery','ratePoints','targetBonus'] loop
 if jsonb_typeof(r->k)<>'number' then raise exception 'Rule % must be numeric', k; end if;
 n:=(r->>k)::numeric;
 if n<>trunc(n) or n<0 or n>1000000 then raise exception 'Invalid rule %',k; end if;
 end loop;
 if (r->>'burst')::int<1 or (r->>'rateEvery')::int<1 then raise exception 'Burst and rate interval must be positive'; end if;
 if (r->>'cap')::int=0 and (r->>'capMultiplier')::int=0 then raise exception 'Progress cap required'; end if;
 if jsonb_typeof(r->'targets')<>'array' or jsonb_array_length(r->'targets') not between 1 and 100
 or jsonb_typeof(r->'initialTargets')<>'array' or jsonb_array_length(r->'initialTargets')<1 then raise exception 'Target choices required'; end if;
 for v in select value from jsonb_array_elements(r->'targets') loop
 if jsonb_typeof(v)<>'number' or v::text::numeric<>trunc(v::text::numeric) or v::text::numeric not between 1 and 1000000 then raise exception 'Invalid target'; end if;
 if (r->>'cap')::int=0 and v::text::numeric*(r->>'capMultiplier')::numeric>1000000 then raise exception 'Maximum progress exceeds one million'; end if;
 if (r->>'cap')::int>0 and v::text::int>(r->>'cap')::int then raise exception 'Target exceeds hard cap'; end if;
 if (r->>'step')::int>0 and v::text::int % (r->>'step')::int<>0 then raise exception 'Target must align with entry step'; end if;
 end loop;
 for v in select value from jsonb_array_elements(r->'initialTargets') loop
 if not (r->'targets' @> jsonb_build_array(v)) then raise exception 'Initial target not supported'; end if;
 end loop;
 if jsonb_typeof(r->'milestones')<>'array' then raise exception 'Invalid milestones'; end if;
 for v in select value from jsonb_array_elements(r->'milestones') loop
 if jsonb_typeof(v->'threshold')<>'number' or jsonb_typeof(v->'points')<>'number'
 or (v->>'threshold')::numeric<>trunc((v->>'threshold')::numeric)
 or (v->>'points')::numeric<>trunc((v->>'points')::numeric)
 or (v->>'threshold')::int<=last_threshold or (v->>'points')::int<last_points
 or (v->>'points')::int>1000000 then raise exception 'Milestones must increase'; end if;
 last_threshold:=(v->>'threshold')::int; last_points:=(v->>'points')::int;
 end loop;
 if r ? 'targetRates' then
 if jsonb_typeof(r->'targetRates')<>'object' then raise exception 'Invalid target rates'; end if;
 for k,v in select * from jsonb_each(r->'targetRates') loop
 if not (r->'targets' @> jsonb_build_array(k::int)) or jsonb_typeof(v)<>'number'
 or v::text::numeric<>trunc(v::text::numeric) or v::text::numeric not between 1 and 1000000 then raise exception 'Invalid target rate'; end if;
 end loop;
 end if;
 if r->>'mode'='occurrence' and (r->>'step')::int<>1 then raise exception 'Occurrences use one entry at a time'; end if;
 if r->>'mode'='binary' and (r->'targets'<>'[1]'::jsonb or (r->>'cap')::int<>1) then raise exception 'Submission challenges use target and cap one'; end if;
 if (r->>'approval')::boolean and r->>'mode'<>'binary' then raise exception 'Proof approval requires a submission challenge'; end if;
 if coalesce(jsonb_typeof(r->'unit'),'null')<>'string' or length(r->>'unit') not between 1 and 40 then raise exception 'A short measurement unit is required'; end if;
 if jsonb_array_length(r->'milestones')>0 and coalesce(r->'targetRates','{}'::jsonb)<>'{}'::jsonb then raise exception 'Choose milestones or baseline rates, not both'; end if;
 if cadence<>'once' and (r->>'durationMinutes')::int<>0 then raise exception 'Countdowns require season attempts'; end if;
 for v in select value from jsonb_array_elements(r->'targets') loop
 n:=case when (r->>'cap')::int>0 then (r->>'cap')::numeric else v::text::numeric*(r->>'capMultiplier')::numeric end;
 if n/(r->>'rateEvery')::numeric*(r->>'ratePoints')::numeric+(r->>'targetBonus')::numeric>1000000 then raise exception 'Reward exceeds one million XP'; end if;
 if r->'targetRates' ? v::text and n*(r->'targetRates'->>v::text)::numeric/v::text::numeric+(r->>'targetBonus')::numeric>1000000 then raise exception 'Baseline reward exceeds one million XP'; end if;
 end loop;
 if cadence='once' and r->>'penalty'<>'none' then raise exception 'Season attempts do not incur missed-period penalties'; end if;
end $$;

create function private.arc_cap(r jsonb,t integer) returns integer language sql immutable set search_path='' as $$
 select case when (r->>'cap')::int>0 then (r->>'cap')::int else t*(r->>'capMultiplier')::int end
$$;
create function private.arc_reward(r jsonb,t integer,p integer) returns integer language plpgsql immutable set search_path='' as $$
declare q integer:=least(p,private.arc_cap(r,t)); earned integer; per_target integer;
begin
 if r->>'gate'='target' and q<t then return 0; end if;
 per_target:=(r->'targetRates'->>t::text)::int;
 if per_target is not null then earned:=floor(q::numeric*per_target/t);
 elsif jsonb_array_length(r->'milestones')>0 then
 select coalesce(max((v->>'points')::int),0) into earned from jsonb_array_elements(r->'milestones') v where (v->>'threshold')::int<=q;
 else earned:=floor(q::numeric/(r->>'rateEvery')::int)*(r->>'ratePoints')::int; end if;
 return earned+case when q>=t then (r->>'targetBonus')::int else 0 end;
end $$;

create function private.arc_boundary(cadence text,at_time timestamptz) returns timestamptz language sql stable set search_path='' as $$
 select (date_trunc(case when cadence='weekly' then 'week' else 'day' end,at_time at time zone 'Asia/Karachi')
 + case when cadence='weekly' then interval '1 week' else interval '1 day' end) at time zone 'Asia/Karachi'
$$;

-- Called only by guarded RPCs or the database scheduler. No player EXECUTE grant.
create function private.arc_settle(p_id uuid) returns void language plpgsql security invoker set search_path='' as $$
declare p public.arc_periods; c public.arc_commitments; deduction integer:=0;
begin
 select * into p from public.arc_periods where id=p_id for update;
 if p.settled_at is not null or p.ends_at>now() or p.status='pending' then return; end if;
 if p.status='rejected' then p.progress:=0; end if;
 select * into c from public.arc_commitments where id=p.commitment_id;
 if c.frequency<>'once' and p.rules->>'penalty'='baseline' and p.progress<p.target then
 deduction:=round(private.arc_reward(p.rules,p.target,p.target)::numeric*(p.target-p.progress)/p.target);
 end if;
 insert into public.arc_xp(user_id,period_id,category,amount,reason,event_key)
 values(p.user_id,p.id,p.category,-deduction,'Missed target',p.id||':penalty') on conflict(event_key) do nothing;
 update public.arc_periods set penalty=deduction,settled_at=now(),
 status=case when status in ('pending','rejected') then status when progress>=target then 'confirmed'
 when c.frequency='once' then 'failed' else 'closed' end where id=p.id;
 if c.frequency='once' and p.status<>'pending' then update public.arc_commitments set active=false where id=c.id; end if;
end $$;

create function private.arc_maintain(owner_id uuid default null) returns void language plpgsql security definer set search_path='' as $$
declare c public.arc_commitments; p record; begin_at timestamptz; finish_at timestamptz; t integer;
begin
 for c in select * from public.arc_commitments where active and (owner_id is null or user_id=owner_id) order by id for update loop
 begin_at:=c.next_period_at;
 while begin_at<=now() and begin_at<c.ends_at loop
 if c.frequency<>'once' and private.arc_boundary(c.frequency,begin_at)>c.ends_at then begin_at:=c.ends_at; update public.arc_commitments set active=false where id=c.id; exit; end if;
 t:=case when c.pending_at is not null and begin_at>=c.pending_at then c.pending_target else c.target end;
 finish_at:=case when c.frequency='once' then c.ends_at else least(private.arc_boundary(c.frequency,begin_at),c.ends_at) end;
 insert into public.arc_periods(commitment_id,user_id,starts_at,ends_at,target,rules,category)
 values(c.id,c.user_id,begin_at,finish_at,t,c.rules,c.category) on conflict do nothing;
 begin_at:=finish_at;
 end loop;
 update public.arc_commitments set next_period_at=begin_at,
 target=case when pending_at<=now() then pending_target else target end,
 pending_target=case when pending_at<=now() then null else pending_target end,
 pending_at=case when pending_at<=now() then null else pending_at end where id=c.id;
 for p in select id from public.arc_periods where commitment_id=c.id and ends_at<=now() and settled_at is null order by starts_at loop
 perform private.arc_settle(p.id);
 end loop;
 if c.frequency<>'once' and c.ends_at<=now() then update public.arc_commitments set active=false where id=c.id; end if;
 end loop;
end $$;

create function private.arc_join(challenge uuid,chosen_target integer) returns void language plpgsql security definer set search_path='' as $$
declare d public.arc_challenges; s public.arc_seasons; begins timestamptz; ends timestamptz;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 perform private.arc_maintain(auth.uid());
 select * into d from public.arc_challenges where id=challenge and published and not archived for share;
 if not found then raise exception 'Challenge unavailable'; end if;
 select * into s from public.arc_seasons where id=d.season_id;
 if not (d.rules->'initialTargets' @> jsonb_build_array(chosen_target)) then raise exception 'Choose an allowed baseline'; end if;
 begins:=case when d.frequency='once' then greatest(now(),s.starts_on::timestamp at time zone s.timezone)
 else greatest(private.arc_boundary(d.frequency,now()),s.starts_on::timestamp at time zone s.timezone) end;
 ends:=(s.ends_on+1)::timestamp at time zone s.timezone;
 if begins>=ends then raise exception 'No full period remains in this season'; end if;
 if d.frequency<>'once' and private.arc_boundary(d.frequency,begins)>ends then raise exception 'No full period remains in this season'; end if;
 if d.frequency='once' and (d.rules->>'durationMinutes')::int>0 then
 ends:=least(ends,begins+make_interval(mins=>(d.rules->>'durationMinutes')::int)); end if;
 insert into public.arc_commitments(user_id,challenge_id,target,rules,category,frequency,title,starts_at,ends_at,next_period_at)
 values(auth.uid(),d.id,chosen_target,d.rules,d.category,d.frequency,d.title,begins,ends,begins);
 perform private.arc_maintain(auth.uid());
end $$;

create function private.arc_upgrade(commitment uuid,new_target integer) returns void language plpgsql security definer set search_path='' as $$
declare c public.arc_commitments; effective timestamptz;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 perform private.arc_maintain(auth.uid());
 select * into c from public.arc_commitments where id=commitment and user_id=auth.uid() and active for update;
 if not found or c.frequency='once' then raise exception 'Recurring commitment required'; end if;
 if new_target<=greatest(c.target,coalesce(c.pending_target,0)) or not (c.rules->'targets' @> jsonb_build_array(new_target)) then raise exception 'Choose a higher supported baseline'; end if;
 effective:=greatest(c.starts_at,private.arc_boundary(c.frequency,now()));
 if effective>=c.ends_at then raise exception 'No next period remains'; end if;
 update public.arc_commitments set pending_target=new_target,pending_at=effective where id=c.id;
end $$;

create function private.arc_record(commitment uuid,amount integer,request_id uuid) returns void language plpgsql security definer set search_path='' as $$
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
 earned:=case when needs_proof then 0 else private.arc_reward(p.rules,p.target,p.progress+amount) end;
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

create function private.arc_review(period uuid,approve boolean) returns void language plpgsql security definer set search_path='' as $$
declare p public.arc_periods; c public.arc_commitments; earned integer;
begin
 if not private.arc_admin() then raise exception 'Administrator required'; end if;
 -- Lock order is commitment, then period, matching recording and maintenance.
 select c0.* into c from public.arc_commitments c0 join public.arc_periods p0 on p0.commitment_id=c0.id where p0.id=period for update of c0;
 select * into p from public.arc_periods where id=period for update;
 if not found or p.status<>'pending' then raise exception 'Pending proof not found'; end if;
 earned:=case when approve then private.arc_reward(p.rules,p.target,p.progress) else 0 end;
 insert into public.arc_xp(user_id,period_id,category,amount,reason,event_key)
 values(p.user_id,p.id,p.category,earned-p.reward,case when approve then 'Proof approved' else 'Proof rejected' end,p.id||':review:'||p.entry_count);
 update public.arc_periods set reward=earned,status=case when approve then 'confirmed' else 'rejected' end,reviewed_by=auth.uid() where id=p.id;
 if c.frequency='once' then update public.arc_commitments set active=false where id=c.id;
 update public.arc_periods set settled_at=now() where id=p.id;
 else perform private.arc_settle(p.id); end if;
end $$;

create function private.arc_save_challenge(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; begin
 if not private.arc_admin() then raise exception 'Administrator required'; end if;
 perform private.arc_validate(payload->'rules',payload->>'frequency');
 if payload->>'frequency' not in ('daily','weekly','once') then raise exception 'Invalid frequency'; end if;
 if nullif(payload->>'id','') is null then
 insert into public.arc_challenges(season_id,title,description,category,frequency,rules,published)
 values((payload->>'seasonId')::uuid,trim(payload->>'title'),coalesce(payload->>'description',''),
 payload->>'category',payload->>'frequency',payload->'rules',coalesce((payload->>'published')::boolean,true))
 returning id into result;
 else
 update public.arc_challenges set title=trim(payload->>'title'),description=coalesce(payload->>'description',''),
 category=payload->>'category',frequency=payload->>'frequency',rules=payload->'rules',
 published=coalesce((payload->>'published')::boolean,true),version=version+1
 where id=(payload->>'id')::uuid returning id into result;
 if not found then raise exception 'Challenge not found'; end if;
 end if;
 return result;
end $$;
create function private.arc_submit_idea(idea_title text,idea_description text) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 insert into public.arc_ideas(user_id,title,description) values(auth.uid(),trim(idea_title),trim(idea_description));
end $$;
create function private.arc_review_idea(idea uuid,payload jsonb) returns void language plpgsql security definer set search_path='' as $$
declare new_id uuid; row public.arc_ideas;
begin
 if not private.arc_admin() then raise exception 'Administrator required'; end if;
 select * into row from public.arc_ideas where id=idea and status='pending' for update;
 if not found then raise exception 'Pending idea not found'; end if;
 if payload is not null then
 new_id:=private.arc_save_challenge((payload-'id')||jsonb_build_object('title',row.title,'description',row.description));
 end if;
 update public.arc_ideas set status=case when payload is null then 'rejected' else 'approved' end,
 challenge_id=new_id,reviewed_by=auth.uid() where id=idea;
end $$;

create function private.arc_snapshot() returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); result jsonb;
begin
 if caller is null then raise exception 'Sign in required'; end if;
 perform private.arc_maintain(caller);
 select jsonb_build_object(
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

-- Only guarded operations are reachable. Internal maintenance/scoring routines stay private.
create function public.arc_snapshot() returns jsonb language sql security invoker set search_path='' as $$ select private.arc_snapshot() $$;
create function public.arc_join(challenge uuid,chosen_target integer) returns void language sql security invoker set search_path='' as $$ select private.arc_join(challenge,chosen_target) $$;
create function public.arc_upgrade(commitment uuid,new_target integer) returns void language sql security invoker set search_path='' as $$ select private.arc_upgrade(commitment,new_target) $$;
create function public.arc_record(commitment uuid,amount integer,request_id uuid) returns void language sql security invoker set search_path='' as $$ select private.arc_record(commitment,amount,request_id) $$;
create function public.arc_review(period uuid,approve boolean) returns void language sql security invoker set search_path='' as $$ select private.arc_review(period,approve) $$;
create function public.arc_save_challenge(payload jsonb) returns uuid language sql security invoker set search_path='' as $$ select private.arc_save_challenge(payload) $$;
create function public.arc_submit_idea(idea_title text,idea_description text) returns void language sql security invoker set search_path='' as $$ select private.arc_submit_idea(idea_title,idea_description) $$;
create function public.arc_review_idea(idea uuid,payload jsonb) returns void language sql security invoker set search_path='' as $$ select private.arc_review_idea(idea,payload) $$;

do $$ declare t text; f record; begin
 foreach t in array array['arc_seasons','arc_challenges','arc_commitments','arc_periods','arc_entries','arc_xp','arc_ideas'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 end loop;
 for f in select p.oid::regprocedure signature,n.nspname,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('public','private') and p.proname like 'arc_%' loop
 execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 if f.proname in ('arc_snapshot','arc_join','arc_upgrade','arc_record','arc_review','arc_save_challenge','arc_submit_idea','arc_review_idea') then
 execute format('grant execute on function %s to authenticated',f.signature); end if;
 end loop;
end $$;

-- Cron owns settlement. If pg_cron is unavailable, installation fails instead of silently losing penalties.
create extension if not exists pg_cron;
select cron.schedule('winter-arc-settle','* * * * *','select private.arc_maintain()');

insert into public.arc_seasons(id,name,starts_on,ends_on)
values('20260000-0000-4000-8000-000000000001','Winter Arc 2026','2026-09-23','2026-12-31');
insert into public.arc_challenges(id,season_id,title,category,frequency,rules,published) values('20260000-0000-4000-8000-000000000001','20260000-0000-4000-8000-000000000001','Water','body','daily','{"mode":"quantity","targets":[2500,3000,3500,4000],"initialTargets":[2500,3000,3500,4000],"cap":4000,"capMultiplier":0,"step":500,"burst":3,"cooldownMinutes":30,"durationMinutes":0,"rateEvery":1,"ratePoints":0,"targetBonus":0,"gate":"target","milestones":[{"threshold":2500,"points":8},{"threshold":3000,"points":10},{"threshold":3500,"points":13},{"threshold":4000,"points":16}],"approval":false,"penalty":"baseline","unit":"ml"}',true);
insert into public.arc_challenges(id,season_id,title,category,frequency,rules,published) values('20260000-0000-4000-8000-000000000002','20260000-0000-4000-8000-000000000001','Pushups','body','daily','{"mode":"quantity","targets":[50,100,150,200],"initialTargets":[50,100],"cap":0,"capMultiplier":2,"step":0,"burst":1,"cooldownMinutes":0,"durationMinutes":0,"rateEvery":10,"ratePoints":1,"targetBonus":0,"gate":"target","milestones":[],"approval":false,"penalty":"baseline","unit":"reps"}',true);
insert into public.arc_challenges(id,season_id,title,category,frequency,rules,published) values('20260000-0000-4000-8000-000000000003','20260000-0000-4000-8000-000000000001','Pullups','body','daily','{"mode":"quantity","targets":[8,20],"initialTargets":[8,20],"cap":0,"capMultiplier":2,"step":0,"burst":1,"cooldownMinutes":0,"durationMinutes":0,"rateEvery":1,"ratePoints":0,"targetBonus":0,"gate":"target","milestones":[],"approval":false,"penalty":"baseline","targetRates":{"8":5,"20":12},"unit":"reps"}',true);
insert into public.arc_challenges(id,season_id,title,category,frequency,rules,published) values('20260000-0000-4000-8000-000000000004','20260000-0000-4000-8000-000000000001','Salah in Congregation with first takbeer','soul','daily','{"mode":"occurrence","targets":[5],"initialTargets":[5],"cap":0,"capMultiplier":1,"step":1,"burst":1,"cooldownMinutes":60,"durationMinutes":0,"rateEvery":1,"ratePoints":5,"targetBonus":0,"gate":"immediate","milestones":[],"approval":false,"penalty":"baseline","unit":"prayers"}',true);
insert into public.arc_challenges(id,season_id,title,category,frequency,rules,published) values('20260000-0000-4000-8000-000000000005','20260000-0000-4000-8000-000000000001','Gym','body','weekly','{"mode":"occurrence","targets":[1,2,3,4,5,6,7],"initialTargets":[1,2,3,4,5,6,7],"cap":7,"capMultiplier":0,"step":1,"burst":1,"cooldownMinutes":720,"durationMinutes":0,"rateEvery":1,"ratePoints":10,"targetBonus":50,"gate":"immediate","milestones":[],"approval":false,"penalty":"baseline","unit":"sessions"}',true);
insert into public.arc_challenges(id,season_id,title,category,frequency,rules,published) values('20260000-0000-4000-8000-000000000006','20260000-0000-4000-8000-000000000001','1,000 squats','body','once','{"mode":"quantity","targets":[1000],"initialTargets":[1000],"cap":0,"capMultiplier":1,"step":0,"burst":1,"cooldownMinutes":0,"durationMinutes":1440,"rateEvery":1,"ratePoints":0,"targetBonus":100,"gate":"target","milestones":[],"approval":false,"penalty":"none","unit":"reps"}',true);
insert into public.arc_challenges(id,season_id,title,category,frequency,rules,published) values('20260000-0000-4000-8000-000000000007','20260000-0000-4000-8000-000000000001','Read Nonfiction','mind','daily','{"mode":"quantity","targets":[8],"initialTargets":[8],"cap":0,"capMultiplier":1,"step":0,"burst":1,"cooldownMinutes":0,"durationMinutes":0,"rateEvery":1,"ratePoints":0,"targetBonus":10,"gate":"target","milestones":[],"approval":false,"penalty":"baseline","unit":"pages"}',true);
insert into public.arc_challenges(id,season_id,title,category,frequency,rules,published) values('20260000-0000-4000-8000-000000000008','20260000-0000-4000-8000-000000000001','Compete in a 5K run','body','once','{"mode":"binary","targets":[1],"initialTargets":[1],"cap":1,"capMultiplier":0,"step":1,"burst":1,"cooldownMinutes":0,"durationMinutes":0,"rateEvery":1,"ratePoints":0,"targetBonus":100,"gate":"target","milestones":[],"approval":true,"penalty":"none","unit":"completion"}',true);
insert into public.arc_challenges(id,season_id,title,category,frequency,rules,published) values('20260000-0000-4000-8000-000000000009','20260000-0000-4000-8000-000000000001','Run a Half-Marathon','body','once','{"mode":"binary","targets":[1],"initialTargets":[1],"cap":1,"capMultiplier":0,"step":1,"burst":1,"cooldownMinutes":0,"durationMinutes":0,"rateEvery":1,"ratePoints":0,"targetBonus":500,"gate":"target","milestones":[],"approval":true,"penalty":"none","unit":"completion"}',true);
insert into public.arc_challenges(id,season_id,title,category,frequency,rules,published) values('20260000-0000-4000-8000-000000000010','20260000-0000-4000-8000-000000000001','Run a Full-Marathon','body','once','{"mode":"binary","targets":[1],"initialTargets":[1],"cap":1,"capMultiplier":0,"step":1,"burst":1,"cooldownMinutes":0,"durationMinutes":0,"rateEvery":1,"ratePoints":0,"targetBonus":1000,"gate":"target","milestones":[],"approval":true,"penalty":"none","unit":"completion"}',true);
insert into public.arc_challenges(id,season_id,title,category,frequency,rules,published) values('20260000-0000-4000-8000-000000000011','20260000-0000-4000-8000-000000000001','Sell $100 worth of Digital Products','craft','once','{"mode":"binary","targets":[1],"initialTargets":[1],"cap":1,"capMultiplier":0,"step":1,"burst":1,"cooldownMinutes":0,"durationMinutes":0,"rateEvery":1,"ratePoints":0,"targetBonus":100,"gate":"target","milestones":[],"approval":true,"penalty":"none","unit":"completion"}',true);
insert into public.arc_challenges(id,season_id,title,category,frequency,rules,published) values('20260000-0000-4000-8000-000000000012','20260000-0000-4000-8000-000000000001','Sell $1000 worth of Digital Products','craft','once','{"mode":"binary","targets":[1],"initialTargets":[1],"cap":1,"capMultiplier":0,"step":1,"burst":1,"cooldownMinutes":0,"durationMinutes":0,"rateEvery":1,"ratePoints":0,"targetBonus":1000,"gate":"target","milestones":[],"approval":true,"penalty":"none","unit":"completion"}',true);
insert into public.arc_challenges(id,season_id,title,category,frequency,rules,published) values('20260000-0000-4000-8000-000000000013','20260000-0000-4000-8000-000000000001','Close a $500 service deal','craft','once','{"mode":"binary","targets":[1],"initialTargets":[1],"cap":1,"capMultiplier":0,"step":1,"burst":1,"cooldownMinutes":0,"durationMinutes":0,"rateEvery":1,"ratePoints":0,"targetBonus":500,"gate":"target","milestones":[],"approval":true,"penalty":"none","unit":"completion"}',true);
insert into public.arc_challenges(id,season_id,title,category,frequency,rules,published) values('20260000-0000-4000-8000-000000000014','20260000-0000-4000-8000-000000000001','Close a $1000 service deal','craft','once','{"mode":"binary","targets":[1],"initialTargets":[1],"cap":1,"capMultiplier":0,"step":1,"burst":1,"cooldownMinutes":0,"durationMinutes":0,"rateEvery":1,"ratePoints":0,"targetBonus":1000,"gate":"target","milestones":[],"approval":true,"penalty":"none","unit":"completion"}',true);
insert into public.arc_challenges(id,season_id,title,category,frequency,rules,published) values('20260000-0000-4000-8000-000000000015','20260000-0000-4000-8000-000000000001','Build & Ship an App that solves a real-world problem','craft','once','{"mode":"binary","targets":[1],"initialTargets":[1],"cap":1,"capMultiplier":0,"step":1,"burst":1,"cooldownMinutes":0,"durationMinutes":0,"rateEvery":1,"ratePoints":0,"targetBonus":500,"gate":"target","milestones":[],"approval":true,"penalty":"none","unit":"completion"}',true);
do $$ declare d record; begin for d in select * from public.arc_challenges loop perform private.arc_validate(d.rules,d.frequency); end loop; end $$;

-- Existing installations: preserve the old earned total as an opening balance.
-- Older XP did not have reliable categories; leave it explicitly uncategorized.
alter table public.arc_xp alter column category drop not null;
do $$ declare row record; d public.arc_challenges; mapped uuid; goal integer; start_at timestamptz; end_at timestamptz; cid uuid; pid uuid; r jsonb; amount integer;
begin
 if to_regclass('public.challenges') is null then return; end if;
 if to_regprocedure('private.player_leaderboard()') is null then
 raise exception 'Legacy database version is unsupported. Restore/reconcile its schema before cutover; no data has been deleted.';
 end if;
 for row in execute 'select * from private.player_leaderboard()' loop
 insert into public.arc_xp(user_id,category,amount,reason,event_key)
 values(row.id,null,row.points,'Legacy opening balance',row.id||':legacy');
 end loop;
 -- Map known catalog titles to current definitions. Keep other challenges as drafts for admin classification.
 create temporary table arc_legacy_map(old_id uuid primary key,new_id uuid) on commit drop;
 for row in execute 'select * from public.challenges' loop
 select id into mapped from public.arc_challenges where lower(title)=lower(row.title) limit 1;
 if mapped is null then
 select id into mapped from public.arc_challenges where title=case
 when lower(row.title) in ('hydration protocol','2.5l water','2.5l water per day') then 'Water'
 when lower(row.title) like '%push%up%' then 'Pushups'
 when lower(row.title) like '%pull%up%' then 'Pullups'
 when lower(row.title)='1000 squats' then '1,000 squats'
 when lower(row.title)='daily salah' then 'Salah in Congregation with first takbeer'
 when lower(row.title) in ('build & ship an app','ship something real') then 'Build & Ship an App that solves a real-world problem' end limit 1;
 end if;
 if mapped is null then
 r:=jsonb_build_object('mode','binary','unit','completion','targets',jsonb_build_array(1),'initialTargets',jsonb_build_array(1),
 'cap',1,'capMultiplier',0,'step',1,'burst',1,'cooldownMinutes',0,'durationMinutes',0,'rateEvery',1,'ratePoints',0,
 'targetBonus',row.points,'gate','target','milestones','[]'::jsonb,'approval',row.requires_approval,
 'penalty',case when row.frequency::text='once' then 'none' else 'baseline' end);
 insert into public.arc_challenges(season_id,title,description,category,frequency,rules,published)
 values('20260000-0000-4000-8000-000000000001',row.title,row.description,'craft',row.frequency::text,r,false) returning id into mapped;
 end if;
 insert into arc_legacy_map values(row.id,mapped);
 end loop;
 -- Recreate active recurring commitments under the new rules starting next full period.
 -- Old progress remains in the old tables, and its earned XP is in the opening balance.
 if to_regclass('public.challenge_commitments') is not null then
 for row in execute 'select c.user_id,c.challenge_id,to_jsonb(c) as data from public.challenge_commitments c' loop
 select d0.* into d from public.arc_challenges d0 join arc_legacy_map m on m.new_id=d0.id where m.old_id=row.challenge_id;
 if d.frequency='once' or not d.published or coalesce((row.data->>'is_active')::boolean,true)=false then continue; end if;
 select min(v::text::int) into goal from jsonb_array_elements(d.rules->'targets') v
 where v::text::int>=coalesce((row.data->>'custom_target')::int,(d.rules->'initialTargets'->>0)::int);
 goal:=coalesce(goal,(d.rules->'initialTargets'->>0)::int);
 start_at:=private.arc_boundary(d.frequency,now());
 select (ends_on+1)::timestamp at time zone timezone into end_at from public.arc_seasons where id=d.season_id;
 if start_at>=end_at or private.arc_boundary(d.frequency,start_at)>end_at then continue; end if;
 insert into public.arc_commitments(user_id,challenge_id,target,rules,category,frequency,title,starts_at,ends_at,next_period_at)
 values(row.user_id,d.id,goal,d.rules,d.category,d.frequency,d.title,start_at,end_at,start_at) on conflict do nothing;
 end loop;
 end if;
 -- Pending proofs remain reviewable at their original reward, even if the new catalog price differs.
 if to_regclass('public.completions') is not null then
 for row in execute 'select * from public.completions where status::text=''pending''' loop
 select d0.* into d from public.arc_challenges d0 join arc_legacy_map m on m.new_id=d0.id where m.old_id=row.challenge_id;
 r:=d.rules||jsonb_build_object('mode','binary','targets',jsonb_build_array(1),'initialTargets',jsonb_build_array(1),
 'cap',1,'step',1,'capMultiplier',0,'ratePoints',0,'targetBonus',row.points_awarded,'milestones','[]'::jsonb,'targetRates','{}'::jsonb,'approval',true,'durationMinutes',0,'penalty','none');
 insert into public.arc_commitments(user_id,challenge_id,target,rules,category,frequency,title,starts_at,ends_at,next_period_at,active)
 values(row.user_id,d.id,1,r,d.category,'once',d.title,row.completed_at,now()+interval '1 day',now()+interval '1 day',false)
 returning id into cid;
 insert into public.arc_periods(commitment_id,user_id,starts_at,ends_at,target,rules,category,progress,entry_count,last_entry_at,status)
 values(cid,row.user_id,row.completed_at,now()+interval '1 day',1,r,d.category,1,1,row.completed_at,'pending') returning id into pid;
 end loop;
 end if;
 if to_regclass('public.challenge_ideas') is not null then
 execute 'insert into public.arc_ideas(id,user_id,title,description,created_at)
 select id,submitted_by,title,description,created_at from public.challenge_ideas where status=''pending''';
 end if;
end $$;
-- Retire old write surfaces without destroying their data or audit history.
do $$ declare obj record; begin
 for obj in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('public','private') and p.proname in
 ('enroll_challenge','upgrade_challenge_target','record_challenge_progress','remove_challenge_progress_entry',
 'complete_challenge','uncomplete_challenge','review_completion','reverse_completion','submit_challenge_idea','review_challenge_idea','player_challenges','player_leaderboard') loop
 execute format('revoke all on function %s from public,anon,authenticated',obj.signature);
 end loop;
 for obj in select tablename from pg_tables where schemaname='public' and tablename in
 ('challenges','challenge_commitments','challenge_progress_entries','completions','completion_reversals','challenge_ideas') loop
 execute format('revoke all on public.%I from anon,authenticated',obj.tablename);
 end loop;
end $$;
