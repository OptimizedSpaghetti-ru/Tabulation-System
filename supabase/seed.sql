-- Run after creating the official competition record. Replace the UUID once only.
-- This seeds event definitions only; it never creates judges, contestants, teams, or scores.
-- select public.seed_initial_events('YOUR_COMPETITION_UUID'::uuid, public.current_profile_id());

create or replace function public.seed_initial_events(target_competition uuid, actor uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only an administrator can seed event definitions'; end if;
  insert into public.events (competition_id, name, event_type, participation_type, status, created_by)
  values
    (target_competition, 'Quiz Bee', 'knowledge', 'individual', 'draft', actor),
    (target_competition, 'Programming Competition', 'technical', 'team', 'draft', actor),
    (target_competition, 'Linux Competition', 'technical', 'team', 'draft', actor),
    (target_competition, 'PC Assembly and Disassembly', 'technical', 'team', 'draft', actor),
    (target_competition, 'Dance Competition', 'performance', 'team', 'draft', actor),
    (target_competition, 'Pageant', 'performance', 'individual', 'draft', actor)
  on conflict (competition_id, name) do nothing;
end $$;
