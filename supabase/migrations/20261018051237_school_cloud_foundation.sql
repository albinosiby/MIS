-- School cloud foundation. Private workflow documents preserve the existing validated contracts.
-- Module-specific relational repositories can replace these documents without changing screen models.
create schema mis_private;
revoke all on schema mis_private from public, anon, authenticated;
grant usage on schema mis_private to service_role;

create table public.mis_schools (
  id text primary key check(length(id) between 1 and 128),
  name text not null check(length(name) between 1 and 160),
  created_at timestamptz not null default now()
);
create table public.mis_academic_years (
  school_id text not null references public.mis_schools(id),
  id text not null,
  name text not null,
  starts_on date not null,
  ends_on date not null check(ends_on >= starts_on),
  locked boolean not null default false,
  primary key(school_id,id)
);
create table public.mis_people (
  school_id text not null references public.mis_schools(id),
  id text not null,
  kind text not null check(kind in ('student','staff','guardian')),
  display_name text not null,
  primary key(school_id,id)
);
create table public.mis_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  school_id text not null references public.mis_schools(id),
  role text not null check(role in ('admin','principal','teacher','staff','accountant','parent','student','driver','librarian','hr','nurse','counsellor','transport','inventory','warden','platform','group')),
  person_id text,
  display_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  foreign key(school_id,person_id) references public.mis_people(school_id,id)
);
create index mis_memberships_school_person_idx on public.mis_memberships(school_id,person_id);
create table public.mis_class_sections (
  school_id text not null,
  academic_year_id text not null,
  id text not null,
  grade text not null,
  section text not null,
  primary key(school_id,academic_year_id,id),
  foreign key(school_id,academic_year_id) references public.mis_academic_years(school_id,id)
);
create table public.mis_student_enrolments (
  school_id text not null,
  academic_year_id text not null,
  student_id text not null,
  class_section_id text not null,
  admission_number text not null,
  primary key(school_id,academic_year_id,student_id),
  unique(school_id,academic_year_id,admission_number),
  foreign key(school_id,student_id) references public.mis_people(school_id,id),
  foreign key(school_id,academic_year_id,class_section_id) references public.mis_class_sections(school_id,academic_year_id,id)
);
create index mis_enrolments_class_idx on public.mis_student_enrolments(school_id,academic_year_id,class_section_id);
create table public.mis_guardian_links (
  school_id text not null,
  academic_year_id text not null,
  student_id text not null,
  guardian_id text not null,
  can_view_records boolean not null default false,
  can_receive_notices boolean not null default false,
  primary key(school_id,academic_year_id,student_id,guardian_id),
  foreign key(school_id,academic_year_id,student_id) references public.mis_student_enrolments(school_id,academic_year_id,student_id),
  foreign key(school_id,guardian_id) references public.mis_people(school_id,id)
);
create index mis_guardian_links_guardian_idx on public.mis_guardian_links(school_id,guardian_id);
create table public.mis_teaching_assignments (
  school_id text not null,
  academic_year_id text not null,
  id text not null,
  staff_id text not null,
  class_section_id text not null,
  subject text not null,
  primary key(school_id,academic_year_id,id),
  foreign key(school_id,staff_id) references public.mis_people(school_id,id),
  foreign key(school_id,academic_year_id,class_section_id) references public.mis_class_sections(school_id,academic_year_id,id)
);
create index mis_teaching_staff_idx on public.mis_teaching_assignments(school_id,staff_id);
create index mis_teaching_class_idx on public.mis_teaching_assignments(school_id,academic_year_id,class_section_id);

create table mis_private.workspace_documents (
  school_id text primary key references public.mis_schools(id),
  revision bigint not null check(revision >= 0),
  document jsonb not null check(jsonb_typeof(document)='object' and document->>'version'='2'),
  updated_at timestamptz not null default now()
);
create table mis_private.module_records (
  school_id text not null,
  academic_year_id text not null,
  collection text not null,
  id text not null,
  document jsonb not null check(jsonb_typeof(document)='object'),
  primary key(school_id,academic_year_id,collection,id),
  foreign key(school_id,academic_year_id) references public.mis_academic_years(school_id,id)
);
create table mis_private.audit_events (
  id bigint generated always as identity primary key,
  school_id text not null references public.mis_schools(id),
  actor_id uuid references auth.users(id),
  action text not null check(length(action) between 1 and 300),
  revision bigint not null,
  created_at timestamptz not null default now()
);
create index mis_audit_school_time_idx on mis_private.audit_events(school_id,created_at desc);
create index mis_audit_actor_idx on mis_private.audit_events(actor_id);

-- Membership authority is server-controlled; users may read only their own active membership.
alter table public.mis_memberships enable row level security;
create policy own_membership on public.mis_memberships for select to authenticated
  using(user_id=(select auth.uid()) and active);
grant select on public.mis_memberships to authenticated;

-- Foundation rows are not directly exposed to browsers until dedicated field-level policies exist.
alter table public.mis_schools enable row level security;
alter table public.mis_academic_years enable row level security;
alter table public.mis_people enable row level security;
alter table public.mis_class_sections enable row level security;
alter table public.mis_student_enrolments enable row level security;
alter table public.mis_guardian_links enable row level security;
alter table public.mis_teaching_assignments enable row level security;
alter table mis_private.workspace_documents enable row level security;
alter table mis_private.module_records enable row level security;
alter table mis_private.audit_events enable row level security;
revoke all on public.mis_schools,public.mis_academic_years,public.mis_people,public.mis_class_sections,public.mis_student_enrolments,public.mis_guardian_links,public.mis_teaching_assignments from anon,authenticated;
grant all on all tables in schema mis_private to service_role;
grant usage,select on all sequences in schema mis_private to service_role;
grant all on public.mis_schools,public.mis_academic_years,public.mis_people,public.mis_memberships,public.mis_class_sections,public.mis_student_enrolments,public.mis_guardian_links,public.mis_teaching_assignments to service_role;

create function public.mis_read_workspace(p_school_id text) returns jsonb
language sql security invoker set search_path='' as $$
  select document from mis_private.workspace_documents where school_id=p_school_id;
$$;
revoke all on function public.mis_read_workspace(text) from public,anon,authenticated;
grant execute on function public.mis_read_workspace(text) to service_role;

create function public.mis_commit_workspace(p_school_id text,p_expected_revision bigint,p_document jsonb,p_actor_id uuid,p_action text)
returns bigint language plpgsql security invoker set search_path='' as $$
declare v_revision bigint; y jsonb; r jsonb; col record;
begin
  if not exists(select 1 from public.mis_memberships where user_id=p_actor_id and school_id=p_school_id and active) then
    raise exception 'Active school membership required' using errcode='42501';
  end if;
  if jsonb_typeof(p_document)<>'object' or p_document->>'version'<>'2'
    or (p_document->>'revision')::bigint<>p_expected_revision+1
    or jsonb_array_length(p_document->'years') not between 1 and 10
    or octet_length(p_document::text)>20000000 then raise exception 'Invalid workspace document'; end if;
  update mis_private.workspace_documents set document=p_document,revision=p_expected_revision+1,updated_at=now()
    where school_id=p_school_id and revision=p_expected_revision returning revision into v_revision;
  if v_revision is null then raise exception 'Workspace changed. Reload before saving.' using errcode='40001'; end if;
  for y in select value from jsonb_array_elements(p_document->'years') loop
    if y#>>'{setup,school,id}'<>p_school_id then raise exception 'School mismatch'; end if;
    insert into public.mis_academic_years(school_id,id,name,starts_on,ends_on,locked)
      values(p_school_id,y#>>'{setup,calendar,year,id}',y#>>'{setup,calendar,year,name}',(y#>>'{setup,calendar,year,startDate}')::date,(y#>>'{setup,calendar,year,endDate}')::date,(y->>'locked')::boolean)
      on conflict(school_id,id) do update set name=excluded.name,starts_on=excluded.starts_on,ends_on=excluded.ends_on,locked=excluded.locked;
    for col in select * from (values('students','student'),('staff','staff'),('guardians','guardian')) v(key,kind) loop
      for r in select value from jsonb_array_elements(y->'setup'->col.key) loop
        insert into public.mis_people(school_id,id,kind,display_name) values(p_school_id,r->>'id',col.kind,r->>'displayName')
          on conflict(school_id,id) do update set display_name=excluded.display_name;
      end loop;
    end loop;
    for r in select value from jsonb_array_elements(y#>'{setup,classes}') loop
      insert into public.mis_class_sections values(p_school_id,y#>>'{setup,calendar,year,id}',r->>'id',r->>'grade',r->>'section')
        on conflict(school_id,academic_year_id,id) do update set grade=excluded.grade,section=excluded.section;
    end loop;
    delete from public.mis_guardian_links where school_id=p_school_id and academic_year_id=y#>>'{setup,calendar,year,id}';
    delete from public.mis_student_enrolments where school_id=p_school_id and academic_year_id=y#>>'{setup,calendar,year,id}';
    insert into public.mis_student_enrolments select p_school_id,y#>>'{setup,calendar,year,id}',v->>'id',v->>'classSectionId',v->>'admissionNumber' from jsonb_array_elements(y#>'{setup,students}') v;
    insert into public.mis_guardian_links select p_school_id,y#>>'{setup,calendar,year,id}',v->>'studentId',v->>'guardianId',(v->>'canViewRecords')::boolean,(v->>'canReceiveNotices')::boolean from jsonb_array_elements(y#>'{setup,relationships}') v;
    delete from public.mis_teaching_assignments where school_id=p_school_id and academic_year_id=y#>>'{setup,calendar,year,id}';
    insert into public.mis_teaching_assignments select p_school_id,y#>>'{setup,calendar,year,id}',v->>'id',v->>'staffId',v->>'classSectionId',v->>'subject' from jsonb_array_elements(y#>'{setup,allocations}') v;
    delete from mis_private.module_records where school_id=p_school_id and academic_year_id=y#>>'{setup,calendar,year,id}';
    for col in select key,value from jsonb_each(y->'records') where jsonb_typeof(value)='array' loop
      insert into mis_private.module_records select p_school_id,y#>>'{setup,calendar,year,id}',col.key,v->>'id',v from jsonb_array_elements(col.value) v;
    end loop;
    insert into mis_private.module_records select p_school_id,y#>>'{setup,calendar,year,id}','extension:'||(v->>'kind'),v->>'id',v from jsonb_array_elements(y->'extensions') v;
  end loop;
  update public.mis_schools set name=p_document#>>'{years,0,setup,school,name}' where id=p_school_id;
  insert into mis_private.audit_events(school_id,actor_id,action,revision) values(p_school_id,p_actor_id,p_action,v_revision);
  return v_revision;
end;
$$;
revoke all on function public.mis_commit_workspace(text,bigint,jsonb,uuid,text) from public,anon,authenticated;
grant execute on function public.mis_commit_workspace(text,bigint,jsonb,uuid,text) to service_role;
