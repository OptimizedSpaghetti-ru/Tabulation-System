begin;

-- Qualify the outer contestant ID: bare `id` resolves to event_contestants.id
-- inside this subquery and silently hides contestants from assigned judges.
drop policy if exists "judge contestants" on public.contestants;
create policy "judge contestants" on public.contestants for select
using (
  exists (
    select 1
    from public.event_contestants ec
    where ec.contestant_id = contestants.id
      and public.is_assigned(ec.event_id)
  )
);

commit;
