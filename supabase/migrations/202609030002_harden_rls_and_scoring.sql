-- OLFU CCS Competition Tabulation System: Migration 0002
-- Harden RLS policies, validation triggers, scoring engine, and admin procedures

-- 1. Safely handle user profile creation trigger if full_name is missing or whitespace
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  clean_name text;
begin
  clean_name := trim(coalesce(new.raw_user_meta_data->>'full_name', ''));
  if length(clean_name) < 2 or clean_name !~ '[A-Za-z]' then
    clean_name := coalesce(nullif(trim(split_part(new.email, '@', 1)), ''), 'User');
    if length(clean_name) < 2 then
      clean_name := 'Judge ' || substr(new.id::text, 1, 6);
    end if;
  end if;

  insert into public.profiles (
    auth_user_id,
    full_name,
    email,
    judge_id,
    contact_number,
    role,
    status
  ) values (
    new.id,
    clean_name,
    lower(new.email),
    nullif(trim(new.raw_user_meta_data->>'judge_id'), ''),
    nullif(trim(new.raw_user_meta_data->>'contact_number'), ''),
    'judge',
    'pending'
  ) on conflict (auth_user_id) do update set
    email = excluded.email,
    updated_at = now();

  return new;
exception when others then
  -- Fallback to ensure auth signup does not fail even if constraint error occurs
  return new;
end $$;

-- 2. Competitions RLS: Allow judges to view active or assigned competitions, and public to view published ones
drop policy if exists "authenticated competitions select" on public.competitions;
create policy "authenticated competitions select" on public.competitions for select
using (
  public.is_admin()
  or status in ('ongoing', 'scoring', 'finalizing', 'finalized', 'published')
  or exists (
    select 1 from public.events e
    join public.judge_event_assignments a on a.event_id = e.id
    where e.competition_id = competitions.id
      and a.judge_id = public.current_profile_id()
      and a.status = 'active'
  )
);

drop policy if exists "public published competitions" on public.competitions;
create policy "public published competitions" on public.competitions for select
using (status = 'published');

-- 3. Contestants RLS: Allow public to view contestant details for published events
drop policy if exists "public published contestants" on public.contestants;
create policy "public published contestants" on public.contestants for select
using (
  exists (
    select 1 from public.event_contestants ec
    join public.events e on e.id = ec.event_id
    where ec.contestant_id = contestants.id
      and e.status = 'published'
  )
);

-- 4. Criteria RLS: Allow assigned judges and admins to delete unlocked criteria
drop policy if exists "criteria delete assigned" on public.criteria;
create policy "criteria delete assigned" on public.criteria for delete
using (
  (public.is_admin() or public.is_assigned(event_id))
  and not is_locked
);

-- 5. Scores & Score Sheets RLS: Ensure judges can only score events they are actively assigned to
drop policy if exists "scores own" on public.scores;
drop policy if exists "scores judge or admin" on public.scores;
create policy "scores judge or admin" on public.scores for all
using (
  public.is_admin()
  or (judge_id = public.current_profile_id() and public.is_assigned(event_id))
)
with check (
  public.is_admin()
  or (judge_id = public.current_profile_id() and public.is_assigned(event_id))
);

drop policy if exists "sheets own" on public.score_sheets;
drop policy if exists "sheets judge or admin" on public.score_sheets;
create policy "sheets judge or admin" on public.score_sheets for all
using (
  public.is_admin()
  or (judge_id = public.current_profile_id() and public.is_assigned(event_id))
)
with check (
  public.is_admin()
  or (judge_id = public.current_profile_id() and public.is_assigned(event_id))
);

-- 6. Harden score_before_write trigger
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

  if c.is_locked = false then
    raise exception 'Scoring cannot begin until criteria are locked';
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

-- 7. Harden submit_score_sheet procedure
create or replace function public.submit_score_sheet(event_uuid uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  missing_count integer;
  contestant_count integer;
  criteria_count integer;
begin
  if not public.is_admin() and not public.is_assigned(event_uuid) then
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

-- 8. Admin procedure to finalize, calculate official winners, and publish an event
create or replace function public.finalize_and_publish_event(event_uuid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Only an administrator can finalize and publish event results';
  end if;

  -- Ensure official results table is up to date
  perform public.refresh_event_results(event_uuid);

  -- Set results status to finalized
  update public.results
  set status = 'finalized',
      finalized_at = now(),
      finalized_by = public.current_profile_id()
  where event_id = event_uuid;

  -- Clear previous winners for this event if any
  delete from public.winners where event_id = event_uuid;

  -- Insert top 3 winners
  insert into public.winners (event_id, contestant_id, placement, title, final_score, confirmed_at, confirmed_by)
  select
    r.event_id,
    r.contestant_id,
    r.rank as placement,
    case
      when r.rank = 1 then 'Champion (1st Place)'
      when r.rank = 2 then '1st Runner-Up (2nd Place)'
      when r.rank = 3 then '2nd Runner-Up (3rd Place)'
      else r.rank || 'th Place'
    end as title,
    r.final_score,
    now(),
    public.current_profile_id()
  from public.results r
  where r.event_id = event_uuid and r.rank <= 3
  on conflict (event_id, placement) do nothing;

  -- Mark event as published
  update public.events
  set status = 'published'
  where id = event_uuid;
end $$;

-- 9. Admin procedure to reopen scoring if necessary
create or replace function public.reopen_event_scoring(event_uuid uuid, target_judge_id uuid default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Only an administrator can reopen scoring';
  end if;

  if target_judge_id is not null then
    update public.score_sheets
    set status = 'reopened'
    where event_id = event_uuid and judge_id = target_judge_id;
  else
    update public.score_sheets
    set status = 'reopened'
    where event_id = event_uuid;
  end if;

  update public.events
  set status = 'scoring'
  where id = event_uuid;

  perform public.refresh_event_results(event_uuid);
end $$;

-- 10. Performance indexes
create index if not exists idx_scores_event_judge on public.scores(event_id, judge_id);
create index if not exists idx_scores_contestant on public.scores(contestant_id);
create index if not exists idx_criteria_event on public.criteria(event_id);
create index if not exists idx_event_contestants_event on public.event_contestants(event_id);
create index if not exists idx_judge_assignments_event on public.judge_event_assignments(event_id);
create index if not exists idx_results_event_rank on public.results(event_id, rank);
