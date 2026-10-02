-- Temporary fixtures and all assertions are rolled back.
begin;
insert into auth.users (id,email,raw_user_meta_data) values
('f0000000-0000-0000-0000-000000000001','photo-admin@example.test','{"full_name":"Photo Admin"}'),
('f0000000-0000-0000-0000-000000000002','photo-judge@example.test','{"full_name":"Photo Judge"}'),
('f0000000-0000-0000-0000-000000000003','photo-other@example.test','{"full_name":"Photo Other"}');
update public.profiles set role='admin',status='active' where auth_user_id='f0000000-0000-0000-0000-000000000001';
update public.profiles set status='active' where auth_user_id in ('f0000000-0000-0000-0000-000000000002','f0000000-0000-0000-0000-000000000003');
insert into public.competitions(id,name,academic_year,start_date,end_date) values
('f0000000-0000-0000-0000-000000000004','Photo Test','2026','2026-10-02','2026-10-02');
insert into public.events(id,competition_id,name,event_type,participation_type) values
('f0000000-0000-0000-0000-000000000005','f0000000-0000-0000-0000-000000000004','Photo Event','test','individual');
insert into public.contestants(id,contestant_number,full_name,course,photo_path) values
('f0000000-0000-0000-0000-000000000006','PHOTO-TEST','Photo Contestant','BS Information Technology','f0000000-0000-0000-0000-000000000006/test.png');
insert into public.event_contestants(event_id,contestant_id) values
('f0000000-0000-0000-0000-000000000005','f0000000-0000-0000-0000-000000000006');
insert into public.judge_event_assignments(judge_id,event_id)
select id,'f0000000-0000-0000-0000-000000000005' from public.profiles where auth_user_id='f0000000-0000-0000-0000-000000000002';
do $$ begin
  if not exists(select 1 from storage.buckets where id='contestant-photos' and public=false and file_size_limit=5242880 and allowed_mime_types=array['image/jpeg','image/png','image/webp']) then
    raise exception 'FAIL: photo bucket configuration';
  end if;
end $$;
select set_config('request.jwt.claim.sub','f0000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
insert into storage.objects(bucket_id,name) values ('contestant-photos','f0000000-0000-0000-0000-000000000006/test.png');
do $$ begin
  if not exists(select 1 from storage.objects where bucket_id='contestant-photos' and name='f0000000-0000-0000-0000-000000000006/test.png') then raise exception 'FAIL: admin cannot read photo'; end if;
end $$;
select set_config('request.jwt.claim.sub','f0000000-0000-0000-0000-000000000002',true);
do $$ declare rejected boolean:=false; begin
  if not exists(select 1 from storage.objects where bucket_id='contestant-photos' and name='f0000000-0000-0000-0000-000000000006/test.png') then raise exception 'FAIL: assigned judge cannot read photo'; end if;
  begin
    insert into storage.objects(bucket_id,name) values ('contestant-photos','f0000000-0000-0000-0000-000000000006/judge.png');
  exception when insufficient_privilege then rejected:=true;
  end;
  if not rejected then raise exception 'FAIL: judge uploaded photo'; end if;
end $$;
select set_config('request.jwt.claim.sub','f0000000-0000-0000-0000-000000000003',true);
do $$ begin
  if exists(select 1 from storage.objects where bucket_id='contestant-photos' and name='f0000000-0000-0000-0000-000000000006/test.png') then raise exception 'FAIL: unassigned judge can read photo'; end if;
end $$;
set local role anon;
do $$ begin
  if exists(select 1 from storage.objects where bucket_id='contestant-photos' and name='f0000000-0000-0000-0000-000000000006/test.png') then raise exception 'FAIL: anonymous user can read photo'; end if;
end $$;
rollback;
select 'PASS: photo bucket configuration and admin / assigned judge / unassigned judge / anonymous access' as result;
