create sequence private.player_number_seq as bigint start with 1;

alter table public.profiles
  add column player_number bigint,
  add column player_code text;

with numbered as (
  select id, row_number() over (order by created_at, id) as number
  from public.profiles
)
update public.profiles as profile
set
  player_number = numbered.number,
  player_code = 'player' || lpad(numbered.number::text, 3, '0')
from numbered
where profile.id = numbered.id;

select setval(
  'private.player_number_seq',
  coalesce((select max(player_number) from public.profiles), 0) + 1,
  false
);

alter table public.profiles
  alter column player_number set not null,
  alter column player_code set not null,
  add constraint profiles_player_number_unique unique (player_number),
  add constraint profiles_player_code_unique unique (player_code),
  add constraint profiles_player_code_format check (player_code ~ '^player[0-9]{3,}$');

create table private.player_credentials (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  login_email text not null unique
);

insert into private.player_credentials (profile_id, login_email)
select profile.id, auth_user.email
from public.profiles as profile
join auth.users as auth_user on auth_user.id = profile.id
where auth_user.email is not null;

create or replace function private.create_profile_for_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  assigned_number bigint;
  first_account boolean;
  assigned_name text;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('winter_arc_first_account', 0));
  first_account := not exists (select 1 from public.profiles);
  assigned_number := nextval('private.player_number_seq');

  if first_account then
    update auth.users
    set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
    where id = new.id;
  end if;

  assigned_name := case
    when first_account or coalesce(new.raw_app_meta_data->>'role', '') = 'admin' then 'Legend'
    else left(coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), 'Contender'), 40)
  end;

  insert into public.profiles (id, player_number, player_code, display_name, avatar_seed)
  values (
    new.id,
    assigned_number,
    'player' || lpad(assigned_number::text, 3, '0'),
    assigned_name,
    new.id::text
  );

  insert into private.player_credentials (profile_id, login_email)
  values (new.id, new.email);

  return new;
end;
$$;

revoke execute on function private.create_profile_for_user() from public, anon, authenticated;

create function private.resolve_player_login(target_player_code text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select credential.login_email
  from private.player_credentials as credential
  join public.profiles as profile on profile.id = credential.profile_id
  where profile.player_code = lower(trim(target_player_code))
  limit 1
$$;

create function public.resolve_player_login(target_player_code text)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select private.resolve_player_login(target_player_code)
$$;

revoke execute on function private.resolve_player_login(text) from public;
revoke execute on function public.resolve_player_login(text) from public;
grant usage on schema private to anon, authenticated;
grant execute on function private.resolve_player_login(text) to anon, authenticated;
grant execute on function public.resolve_player_login(text) to anon, authenticated;
