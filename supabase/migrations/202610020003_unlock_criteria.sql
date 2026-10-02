begin;

create or replace function public.unlock_criteria_for_editing(event_uuid uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  event_status public.record_status;
begin
  if not public.is_admin() then
    raise exception 'Only an administrator can unlock criteria';
  end if;
  select status into event_status from public.events where id = event_uuid for update;
  if not found then
    raise exception 'Competition not found';
  end if;
  if event_status in ('finalizing', 'finalized', 'published', 'archived') then
    raise exception 'Criteria cannot be unlocked after result finalization begins';
  end if;
  -- Row locks also serialize against score writes referencing these criteria.
  perform id from public.criteria where event_id = event_uuid for update;
  if exists(select 1 from public.scores where event_id = event_uuid)
    or exists(select 1 from public.score_sheets where event_id = event_uuid and status = 'submitted') then
    raise exception 'Criteria cannot be unlocked after scores have been entered';
  end if;
  update public.criteria set is_locked = false where event_id = event_uuid;
  update public.events set status = 'draft' where id = event_uuid;
end $$;

revoke all on function public.unlock_criteria_for_editing(uuid) from public;
grant execute on function public.unlock_criteria_for_editing(uuid) to authenticated;

commit;