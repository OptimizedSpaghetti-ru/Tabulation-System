-- Competitions can be created directly without a series.
-- Preserve existing links and records for compatibility.
alter table public.events alter column competition_id drop not null;
