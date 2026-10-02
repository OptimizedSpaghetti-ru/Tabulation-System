-- Run after migrations on a disposable Supabase database. Fixtures roll back.
begin;
insert into auth.users (id,email,raw_user_meta_data) values
('e0000000-0000-0000-0000-000000000001','visibility-admin@example.test','{"full_name":"Visibility Admin"}'),
('e0000000-0000-0000-0000-000000000002','visibility-judge@example.test','{"full_name":"Visibility Judge"}'),
('e0000000-0000-0000-0000-000000000003','visibility-other@example.test','{"full_name":"Visibility Other"}');
update public.profiles set role='admin',status='active' where auth_user_id='e0000000-0000-0000-0000-000000000001';
update public.profiles set status='active' where auth_user_id in ('e0000000-0000-0000-0000-000000000002','e0000000-0000-0000-0000-000000000003');
insert into public.events(id,name,event_type,participation_type) values
('e0000000-0000-0000-0000-000000000004','Visibility Event','test','individual'),
('e0000000-0000-0000-0000-000000000005','Other Event','test','individual');
insert into public.contestants(id,contestant_number,full_name,course) values
('e0000000-0000-0000-0000-000000000006','VIS-1','Assigned Contestant','BSIT'),
('e0000000-0000-0000-0000-000000000007','VIS-2','Other Contestant','BSIT');
-- Registration IDs deliberately differ from contestant IDs.
insert into public.event_contestants(id,event_id,contestant_id) values
('e0000000-0000-0000-0000-000000000008','e0000000-0000-0000-0000-000000000004','e0000000-0000-0000-0000-000000000006'),
('e0000000-0000-0000-0000-000000000009','e0000000-0000-0000-0000-000000000005','e0000000-0000-0000-0000-000000000007');
insert into public.judge_event_assignments(judge_id,event_id)
select id,'e0000000-0000-0000-0000-000000000004' from public.profiles where auth_user_id='e0000000-0000-0000-0000-000000000002';
select set_config('request.jwt.claim.sub','e0000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
do $$ begin
  if (select count(*) from public.contestants where contestant_number in ('VIS-1','VIS-2')) <> 2 then
    raise exception 'FAIL: admin cannot see both contestants';
  end if;
end $$;
select set_config('request.jwt.claim.sub','e0000000-0000-0000-0000-000000000002',true);
do $$ begin
  if not exists(select 1 from public.event_contestants ec join public.contestants c on c.id=ec.contestant_id
    where ec.event_id='e0000000-0000-0000-0000-000000000004' and c.full_name='Assigned Contestant') then
    raise exception 'FAIL: assigned judge cannot load registered contestant for score sheet';
  end if;
  if exists(select 1 from public.contestants where id='e0000000-0000-0000-0000-000000000007') then
    raise exception 'FAIL: judge can see contestant in unassigned event';
  end if;
end $$;
select set_config('request.jwt.claim.sub','e0000000-0000-0000-0000-000000000003',true);
do $$ begin
  if exists(select 1 from public.contestants where contestant_number in ('VIS-1','VIS-2')) then
    raise exception 'FAIL: unassigned judge can see contestants';
  end if;
end $$;
reset role;
update public.judge_event_assignments set status='inactive' where event_id='e0000000-0000-0000-0000-000000000004';
select set_config('request.jwt.claim.sub','e0000000-0000-0000-0000-000000000002',true);
set local role authenticated;
do $$ begin
  if exists(select 1 from public.contestants where id='e0000000-0000-0000-0000-000000000006') then
    raise exception 'FAIL: inactive assignment still grants contestant access';
  end if;
end $$;
rollback;
select 'PASS: contestant visibility for admin, assigned, unassigned, and inactive judges' as result;
