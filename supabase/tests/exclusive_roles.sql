-- Run after all migrations against a disposable Supabase database.
begin;
insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-000000000001', 'role-admin@example.test', '{"full_name":"Role Admin"}'),
 ('00000000-0000-0000-0000-000000000002', 'role-judge@example.test', '{"full_name":"Role Judge"}');
update public.profiles set role = 'admin', status = 'active' where auth_user_id = '00000000-0000-0000-0000-000000000001';
update public.profiles set status = 'active' where auth_user_id = '00000000-0000-0000-0000-000000000002';
insert into public.competitions (id, name, academic_year, start_date, end_date) values
 ('00000000-0000-0000-0000-000000000003', 'Role Test', '2026', '2026-10-02', '2026-10-02');
insert into public.events (id, competition_id, name, event_type, participation_type) values
 ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000003', 'Test Event', 'test', 'individual');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
do $$
declare rejected boolean := false;
begin
  begin
    insert into public.judge_event_assignments (judge_id, event_id)
    values (public.current_profile_id(), '00000000-0000-0000-0000-000000000004');
  exception when others then
    if sqlerrm not like 'Only judge accounts%' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'FAIL: admin assigned as judge'; end if;
  rejected := false;
  begin
    perform public.submit_score_sheet('00000000-0000-0000-0000-000000000004');
  exception when others then
    if sqlerrm <> 'You are not assigned to this event' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'FAIL: admin submitted scores'; end if;
  rejected := false;
  begin
    update public.profiles set role = 'judge' where id = public.current_profile_id();
  exception when others then
    if sqlerrm not like 'Account role and identity%' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'FAIL: browser changed account role'; end if;
  insert into public.judge_event_assignments (judge_id, event_id)
    select id, '00000000-0000-0000-0000-000000000004' from public.profiles
    where auth_user_id = '00000000-0000-0000-0000-000000000002';
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
do $$
declare rejected boolean := false;
begin
  if public.is_admin() or not public.is_assigned('00000000-0000-0000-0000-000000000004') then
    raise exception 'FAIL: judge permissions incorrect';
  end if;
  begin
    insert into public.competitions (name, academic_year, start_date, end_date)
    values ('Unauthorized', '2026', '2026-10-02', '2026-10-02');
  exception when insufficient_privilege then rejected := true;
  end;
  if not rejected then raise exception 'FAIL: judge created a competition'; end if;
end $$;
rollback;
