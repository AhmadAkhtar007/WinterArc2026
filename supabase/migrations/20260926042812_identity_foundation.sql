-- Compatible with an existing Winter Arc identity database; no player data is removed.
create schema if not exists private;
revoke all on schema private from public;
create sequence if not exists private.player_number_seq as bigint start 1;
create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check (length(trim(display_name)) between 2 and 40),
 avatar_seed text not null,
 created_at timestamptz not null default now(),
 player_number bigint not null unique,
 player_code text not null unique
);
create table if not exists private.player_credentials (
 profile_id uuid primary key references public.profiles(id) on delete cascade,
 login_email text not null unique
);
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select, update(display_name) on public.profiles to authenticated;
drop policy if exists arc_profile_read on public.profiles;
create policy arc_profile_read on public.profiles for select to authenticated using (true);
drop policy if exists arc_profile_edit on public.profiles;
create policy arc_profile_edit on public.profiles for update to authenticated
 using (id = (select auth.uid())) with check (id = (select auth.uid()));

create or replace function private.create_profile_for_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare n bigint;
begin
 if new.email is null then raise exception 'Email-backed identity required'; end if;
 n := nextval('private.player_number_seq');
 insert into public.profiles(id, display_name, avatar_seed, player_number, player_code)
 values(new.id, left(coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'),''),'Contender'),40),
 new.id::text, n, 'player' || lpad(n::text, greatest(3,length(n::text)), '0'));
 insert into private.player_credentials values(new.id,new.email);
 return new;
end $$;
-- Remove the old profile-creation trigger by its function, regardless of its name.
do $$ declare t record; begin
 for t in select tgname from pg_trigger where tgrelid='auth.users'::regclass
 and tgfoid='private.create_profile_for_user()'::regprocedure loop
 execute format('drop trigger %I on auth.users',t.tgname);
 end loop;
end $$;
create trigger arc_create_profile after insert on auth.users
 for each row execute function private.create_profile_for_user();
create or replace function private.resolve_player_login(target_player_code text) returns text
language sql stable security definer set search_path='' as $$
 select c.login_email from private.player_credentials c join public.profiles p on p.id=c.profile_id
 where p.player_code=lower(trim(target_player_code))
$$;
create or replace function public.resolve_player_login(target_player_code text) returns text
language sql stable security invoker set search_path='' as $$
 select private.resolve_player_login(target_player_code)
$$;
revoke all on function private.create_profile_for_user() from public, anon, authenticated;
revoke all on function private.resolve_player_login(text), public.resolve_player_login(text) from public;
grant usage on schema private to anon, authenticated;
grant execute on function private.resolve_player_login(text), public.resolve_player_login(text) to anon, authenticated;
