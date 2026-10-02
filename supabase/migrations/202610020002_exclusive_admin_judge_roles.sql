-- Keep administration and judging exclusive at the database boundary.
begin;

create or replace function public.is_judge()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles
    where auth_user_id = auth.uid() and role = 'judge' and status = 'active');
$$;

create or replace function public.is_assigned(event_uuid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_judge() and exists(select 1 from public.judge_event_assignments
    where judge_id = public.current_profile_id() and event_id = event_uuid and status = 'active');
$$;

-- Registration can never create an administrator or activate itself.
drop policy if exists "profile registration" on public.profiles;
create policy "profile registration" on public.profiles for insert to authenticated
with check (auth_user_id = auth.uid() and role = 'judge' and status = 'pending');

-- Role changes require trusted provisioning, not the browser API.
create or replace function public.guard_profile_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.role, new.auth_user_id) is distinct from (old.role, old.auth_user_id)
    and auth.uid() is not null and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Account role and identity cannot be changed through the application';
  end if;
  if new.role <> 'judge' and (
    exists(select 1 from public.judge_event_assignments where judge_id = old.id)
    or exists(select 1 from public.scores where judge_id = old.id)
    or exists(select 1 from public.score_sheets where judge_id = old.id)
  ) then
    raise exception 'An account with judging records cannot become an administrator or viewer';
  end if;
  return new;
end $$;
create trigger guard_profile_role before update on public.profiles
for each row execute function public.guard_profile_role();

-- An admin profile cannot be used as a judge, even by a trusted API client.
create or replace function public.guard_judge_reference()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  judge_role public.user_role;
  judge_status text;
begin
  select role, status into judge_role, judge_status from public.profiles
    where id = new.judge_id for update;
  if judge_role is distinct from 'judge'::public.user_role then
    raise exception 'Only judge accounts can have assignments or score sheets';
  end if;
  if tg_table_name = 'judge_event_assignments' then
    if new.status = 'active' and judge_status <> 'active' then
      raise exception 'Only active judges can be assigned to competitions';
    end if;
  end if;
  if tg_table_name in ('scores', 'score_sheets') and not exists(
    select 1 from public.judge_event_assignments
    where judge_id = new.judge_id and event_id = new.event_id and status = 'active'
  ) then
    raise exception 'Judge is not assigned to this event';
  end if;
  return new;
end $$;
create trigger guard_judge_assignment before insert or update on public.judge_event_assignments
for each row execute function public.guard_judge_reference();
create trigger guard_score_judge before insert or update on public.scores
for each row execute function public.guard_judge_reference();
create trigger guard_sheet_judge before insert or update on public.score_sheets
for each row execute function public.guard_judge_reference();

-- Admins review scores; only assigned judges write their own scores.
drop policy if exists "scores own" on public.scores;
drop policy if exists "scores judge or admin" on public.scores;
create policy "scores review" on public.scores for select to authenticated
using (public.is_admin() or (judge_id = public.current_profile_id() and public.is_assigned(event_id)));
create policy "scores judge insert" on public.scores for insert to authenticated
with check (judge_id = public.current_profile_id() and public.is_assigned(event_id));
create policy "scores judge update" on public.scores for update to authenticated
using (judge_id = public.current_profile_id() and public.is_assigned(event_id))
with check (judge_id = public.current_profile_id() and public.is_assigned(event_id));
create policy "scores judge delete" on public.scores for delete to authenticated
using (judge_id = public.current_profile_id() and public.is_assigned(event_id));

drop policy if exists "sheets own" on public.score_sheets;
drop policy if exists "sheets judge or admin" on public.score_sheets;
create policy "sheets review" on public.score_sheets for select to authenticated
using (public.is_admin() or (judge_id = public.current_profile_id() and public.is_assigned(event_id)));
create policy "sheets judge insert" on public.score_sheets for insert to authenticated
with check (judge_id = public.current_profile_id() and public.is_assigned(event_id));
create policy "sheets judge update" on public.score_sheets for update to authenticated
using (judge_id = public.current_profile_id() and public.is_assigned(event_id))
with check (judge_id = public.current_profile_id() and public.is_assigned(event_id));

-- Admin reopening still uses the existing protected security-definer procedure.
create or replace function public.submit_score_sheet(event_uuid uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  missing_count integer;
  contestant_count integer;
  criteria_count integer;
begin
  if not public.is_judge() or not public.is_assigned(event_uuid) then
    raise exception 'You are not assigned to this event';
  end if;

  select count(*) into contestant_count from public.event_contestants where event_id = event_uuid;
  if contestant_count = 0 then
    raise exception 'Cannot submit scores: no contestants registered for this event';
  end if;

  select count(*) into criteria_count from public.criteria where event_id = event_uuid and is_locked = true;
  if criteria_count = 0 then
    raise exception 'Cannot submit scores: criteria are not locked or configured for this event';
  end if;

  select count(*) into missing_count
  from public.event_contestants ec
  cross join public.criteria c
  where ec.event_id = event_uuid
    and c.event_id = event_uuid
    and not exists (
      select 1 from public.scores s
      where s.event_id = event_uuid
        and s.judge_id = public.current_profile_id()
        and s.contestant_id = ec.contestant_id
        and s.criterion_id = c.id
    );

  if missing_count > 0 then
    raise exception 'Score sheet cannot be submitted: % score(s) are missing', missing_count;
  end if;

  insert into public.score_sheets (judge_id, event_id, status, submitted_at, submitted_by)
  values (public.current_profile_id(), event_uuid, 'submitted', now(), public.current_profile_id())
  on conflict (judge_id, event_id) do update set
    status = 'submitted',
    submitted_at = now(),
    submitted_by = public.current_profile_id();

  perform public.refresh_event_results(event_uuid);
end $$;
commit;
