-- Remove criterion locking; rubric completeness alone enables scoring.
begin;
drop policy if exists "criteria edit assigned" on public.criteria;
create policy "criteria edit assigned" on public.criteria for update
using (public.is_admin() or public.is_assigned(event_id))
with check (public.is_admin() or public.is_assigned(event_id));
drop policy if exists "criteria delete assigned" on public.criteria;
create policy "criteria delete assigned" on public.criteria for delete
using (public.is_admin() or public.is_assigned(event_id));

create or replace function public.criteria_before_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists(select 1 from public.scores where criterion_id = old.id)
    and (new.name,new.description,new.weight_percentage,new.max_score,new.display_order)
      is distinct from (old.name,old.description,old.weight_percentage,old.max_score,old.display_order) then
    raise exception 'Criteria cannot change after scores exist';
  end if;
  return new;
end $$;

create or replace function public.score_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  c public.criteria;
begin
  -- Validate judge assignment
  if not public.is_admin() and not exists (
    select 1 from public.judge_event_assignments
    where judge_id = new.judge_id and event_id = new.event_id and status = 'active'
  ) then
    raise exception 'Judge is not assigned to this event';
  end if;

  -- Validate contestant belongs to this event
  if not exists (
    select 1 from public.event_contestants
    where event_id = new.event_id and contestant_id = new.contestant_id
  ) then
    raise exception 'Contestant is not registered for this event';
  end if;

  -- Validate criterion
  select * into c from public.criteria where id = new.criterion_id and event_id = new.event_id;
  if not found then
    raise exception 'Criterion does not belong to this event';
  end if;

  if new.raw_score < 0 then
    raise exception 'Score cannot be negative';
  end if;

  if new.raw_score > c.max_score then
    raise exception 'Score exceeds maximum allowed score (%)', c.max_score;
  end if;

  if (select coalesce(sum(weight_percentage), 0) from public.criteria where event_id = new.event_id) <> 100 then
    raise exception 'Criteria weights must total exactly 100 before scoring';
  end if;

  if exists (
    select 1 from public.score_sheets
    where judge_id = new.judge_id and event_id = new.event_id and status = 'submitted'
  ) and not public.is_admin() then
    raise exception 'Submitted score sheets cannot be modified';
  end if;

  new.weighted_score := round(new.raw_score * c.weight_percentage / 100, 4);
  return new;
end $$;

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

  select count(*) into criteria_count from public.criteria where event_id = event_uuid;
  if criteria_count = 0 then
    raise exception 'Cannot submit scores: criteria are not configured for this event';
  end if;

  if (select coalesce(sum(weight_percentage), 0) from public.criteria where event_id = event_uuid) <> 100 then
    raise exception 'Criteria weights must total exactly 100 before submission';
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
drop function if exists public.lock_criteria_for_scoring(uuid);
drop function if exists public.unlock_criteria_for_editing(uuid);
alter table public.criteria drop column is_locked;
commit;
