-- Start daily and weekly commitments immediately on the current calendar period.
create or replace function private.arc_join(challenge uuid,chosen_target integer) returns void language plpgsql security definer set search_path='' as $$
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
 else greatest(date_trunc(case when d.frequency='weekly' then 'week' else 'day' end, now() at time zone s.timezone) at time zone s.timezone, s.starts_on::timestamp at time zone s.timezone) end;
 ends:=(s.ends_on+1)::timestamp at time zone s.timezone;
 if begins>=ends then raise exception 'No full period remains in this season'; end if;
 if d.frequency<>'once' and private.arc_boundary(d.frequency,begins)>ends then raise exception 'No full period remains in this season'; end if;
 if d.frequency='once' and (d.rules->>'durationMinutes')::int>0 then
 ends:=least(ends,begins+make_interval(mins=>(d.rules->>'durationMinutes')::int)); end if;
 insert into public.arc_commitments(user_id,challenge_id,target,rules,category,frequency,title,starts_at,ends_at,next_period_at)
 values(auth.uid(),d.id,chosen_target,d.rules,d.category,d.frequency,d.title,begins,ends,begins);
 perform private.arc_maintain(auth.uid());
end $$;

-- Immediately activate any existing commitments that were locked into tomorrow.
update public.arc_commitments
set starts_at = date_trunc(case when frequency='weekly' then 'week' else 'day' end, now() at time zone 'Asia/Karachi') at time zone 'Asia/Karachi',
    next_period_at = date_trunc(case when frequency='weekly' then 'week' else 'day' end, now() at time zone 'Asia/Karachi') at time zone 'Asia/Karachi'
where active and starts_at > now();

-- Generate active periods for today.
select private.arc_maintain();
