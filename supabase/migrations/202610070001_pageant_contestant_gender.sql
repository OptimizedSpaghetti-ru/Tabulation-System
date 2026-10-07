-- Mr. and Ms. CCS only. Keep contestants, scores, and result relationships intact.
begin;

alter table public.contestants add column gender text
  check (gender in ('Male', 'Female'));

-- Derived keys on the existing registration enable race-safe per-event uniqueness.
-- NULL keys leave every other event's numbering rules unchanged.
alter table public.event_contestants
  add column pageant_number text,
  add column pageant_gender text check (pageant_gender in ('Male', 'Female'));
create unique index event_contestants_pageant_number_gender
  on public.event_contestants(event_id, pageant_number, pageant_gender)
  where pageant_gender is not null;

create function public.is_ccs_pageant(event_name text)
returns boolean language sql immutable set search_path = public as $$
  select regexp_replace(replace(lower(event_name), '&', 'and'), '[^a-z0-9]', '', 'g')
    in ('mrandmsccs', 'mrandmsccscompetition');
$$;

create function public.set_pageant_registration_keys()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  event_name text;
  contestant_gender text;
  contestant_no text;
begin
  select name into event_name from public.events where id = new.event_id;
  if public.is_ccs_pageant(event_name) then
    -- Serialize registration with changes to the same contestant's gender/number.
    select gender, trim(contestant_number) into contestant_gender, contestant_no
      from public.contestants where id = new.contestant_id for update;
    if contestant_gender is null or contestant_gender not in ('Male', 'Female') then
      raise exception using errcode = '23514', message = 'Select Male or Female for the Mr. and Ms. CCS contestant.';
    end if;
    if contestant_no is null or contestant_no = '' then
      raise exception using errcode = '23514', message = 'Contestant number is required.';
    end if;
    new.pageant_number := contestant_no;
    new.pageant_gender := contestant_gender;
  else
    new.pageant_number := null;
    new.pageant_gender := null;
  end if;
  return new;
end;
$$;

create trigger set_pageant_registration_keys
before insert or update on public.event_contestants
for each row execute function public.set_pageant_registration_keys();

create function public.sync_pageant_contestant_keys()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- The registration trigger validates and derives the new keys. Its unique index
  -- also rejects edits that would duplicate another contestant of the same gender.
  update public.event_contestants ec set pageant_number = trim(new.contestant_number)
    from public.events e
    where ec.contestant_id = new.id and e.id = ec.event_id and public.is_ccs_pageant(e.name);
  return new;
end;
$$;

create trigger sync_pageant_contestant_keys
after update on public.contestants
for each row execute function public.sync_pageant_contestant_keys();

-- Do not guess the gender of existing records or modify their IDs/assignments.
-- Their NULL keys remain until an administrator supplies gender through editing.
revoke all on function public.set_pageant_registration_keys() from public;
revoke all on function public.sync_pageant_contestant_keys() from public;

commit;
