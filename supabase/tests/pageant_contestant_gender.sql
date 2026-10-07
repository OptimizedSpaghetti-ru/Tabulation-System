-- Uses transaction-local fixtures; safe to run against a migrated database.
begin;
insert into public.competitions(id,name,academic_year,start_date,end_date) values
('a7000000-0000-0000-0000-000000000001','Gender Test','2026','2026-10-07','2026-10-07');
insert into public.events(id,competition_id,name,event_type,participation_type) values
('a7000000-0000-0000-0000-000000000002','a7000000-0000-0000-0000-000000000001','Mr. and Ms. CCS','test','individual'),
('a7000000-0000-0000-0000-000000000003','a7000000-0000-0000-0000-000000000001','Dance Competition','test','individual'),
('a7000000-0000-0000-0000-000000000004','a7000000-0000-0000-0000-000000000001','Mr. and Ms. University','test','individual');
insert into public.contestants(id,contestant_number,full_name,course,gender) values
('a7000000-0000-0000-0000-000000000011','1','Male Partner','BSIT','Male'),
('a7000000-0000-0000-0000-000000000012','1','Female Partner','BSIT','Female'),
('a7000000-0000-0000-0000-000000000013','1','Duplicate Male','BSIT','Male'),
('a7000000-0000-0000-0000-000000000014','1','No Gender','BSIT',null),
('a7000000-0000-0000-0000-000000000015','2','Other Female','BSIT','Female');
insert into public.event_contestants(event_id,contestant_id) values
('a7000000-0000-0000-0000-000000000002','a7000000-0000-0000-0000-000000000011'),
('a7000000-0000-0000-0000-000000000002','a7000000-0000-0000-0000-000000000012'),
('a7000000-0000-0000-0000-000000000002','a7000000-0000-0000-0000-000000000015');

do $$ begin
  if (select count(*) from public.event_contestants where event_id='a7000000-0000-0000-0000-000000000002') <> 3 then
    raise exception 'FAIL: partners with the same number must be distinct contestants';
  end if;
  begin
    insert into public.event_contestants(event_id,contestant_id) values
    ('a7000000-0000-0000-0000-000000000002','a7000000-0000-0000-0000-000000000013');
    raise exception 'FAIL: same-gender duplicate was allowed';
  exception when unique_violation then null; end;
  begin
    insert into public.event_contestants(event_id,contestant_id) values
    ('a7000000-0000-0000-0000-000000000002','a7000000-0000-0000-0000-000000000014');
    raise exception 'FAIL: pageant registration without gender was allowed';
  exception when check_violation then null; end;
  begin
    update public.contestants set gender='Female' where id='a7000000-0000-0000-0000-000000000011';
    raise exception 'FAIL: gender edit introduced a duplicate';
  exception when unique_violation then null; end;
  begin
    update public.contestants set contestant_number='1' where id='a7000000-0000-0000-0000-000000000015';
    raise exception 'FAIL: number edit introduced a duplicate';
  exception when unique_violation then null; end;
  begin
    update public.contestants set gender=null where id='a7000000-0000-0000-0000-000000000011';
    raise exception 'FAIL: pageant gender removed';
  exception when check_violation then null; end;
  begin
    update public.contestants set gender='Mr' where id='a7000000-0000-0000-0000-000000000011';
    raise exception 'FAIL: display label stored as gender';
  exception when check_violation then null; end;
  begin
    update public.event_contestants set contestant_id='a7000000-0000-0000-0000-000000000013'
      where event_id='a7000000-0000-0000-0000-000000000002' and contestant_id='a7000000-0000-0000-0000-000000000015';
    raise exception 'FAIL: changing registration bypassed duplicate validation';
  exception when unique_violation then null; end;
end $$;

-- Caller-supplied derived fields must never bypass the real contestant's gender.
update public.event_contestants set pageant_gender=null,pageant_number='fake'
  where event_id='a7000000-0000-0000-0000-000000000002' and contestant_id='a7000000-0000-0000-0000-000000000011';
do $$ begin
  if not exists(select 1 from public.event_contestants where event_id='a7000000-0000-0000-0000-000000000002' and contestant_id='a7000000-0000-0000-0000-000000000011' and pageant_gender='Male' and pageant_number='1') then
    raise exception 'FAIL: derived uniqueness keys can be overridden';
  end if;
end $$;

-- Other events retain their previous behavior, including duplicate numbers and no gender.
insert into public.event_contestants(event_id,contestant_id) values
('a7000000-0000-0000-0000-000000000003','a7000000-0000-0000-0000-000000000011'),
('a7000000-0000-0000-0000-000000000003','a7000000-0000-0000-0000-000000000013'),
('a7000000-0000-0000-0000-000000000003','a7000000-0000-0000-0000-000000000014'),
('a7000000-0000-0000-0000-000000000004','a7000000-0000-0000-0000-000000000014');
update public.contestants set gender='Male',contestant_number='3' where id='a7000000-0000-0000-0000-000000000015';
do $$ begin
  if not exists(select 1 from public.event_contestants where event_id='a7000000-0000-0000-0000-000000000002' and contestant_id='a7000000-0000-0000-0000-000000000015' and pageant_gender='Male' and pageant_number='3') then
    raise exception 'FAIL: changed number/gender did not synchronize';
  end if;
  if exists(select 1 from public.event_contestants where event_id='a7000000-0000-0000-0000-000000000003' and (pageant_gender is not null or pageant_number is not null)) then
    raise exception 'FAIL: pageant uniqueness rules leaked to another competition';
  end if;
end $$;
rollback;
select 'PASS: pageant gender, partner numbers, edits, and isolation from other competitions' as result;
