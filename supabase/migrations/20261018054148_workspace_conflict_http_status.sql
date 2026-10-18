-- Stale revisions are application conflicts, not retryable database serialization failures.
create or replace function public.mis_commit_workspace(p_school_id text,p_expected_revision bigint,p_document jsonb,p_actor_id uuid,p_action text)
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
  if v_revision is null then raise exception 'Workspace changed. Reload before saving.' using errcode='PT409'; end if;
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

-- Anonymous web visitors never get a canonical document or a direct write grant.
-- Only the server's narrowly validated public intake adapter can invoke this function.
create or replace function public.mis_public_intake(p_school_id text,p_expected_revision bigint,p_year_id text,p_kind text,p_record jsonb)
returns bigint language plpgsql security invoker set search_path='' as $$
declare doc jsonb; idx integer; year_doc jsonb; path text[]; collection_name text;
begin
  select document into doc from mis_private.workspace_documents where school_id=p_school_id and revision=p_expected_revision for update;
  if doc is null then raise exception 'Workspace changed. Please retry.' using errcode='PT409'; end if;
  if (select count(*) from mis_private.audit_events where school_id=p_school_id and actor_id is null and created_at>now()-interval '1 minute')>=20 then
    raise exception 'Too many public requests. Please try later.' using errcode='P0001';
  end if;
  select (ordinality-1)::integer,value into idx,year_doc from jsonb_array_elements(doc->'years') with ordinality where value#>>'{setup,calendar,year,id}'=p_year_id;
  if idx is null or (year_doc->>'locked')::boolean then raise exception 'Academic year is unavailable'; end if;
  if jsonb_typeof(p_record)<>'object' or p_record->>'schoolId'<>p_school_id or p_record->>'academicYearId'<>p_year_id or octet_length(p_record::text)>100000 then raise exception 'Invalid public request'; end if;
  if p_kind='inquiries' then
    if p_record->>'stage'<>'new' or p_record->>'source'<>'Website' or not (year_doc#>>'{records,admissionForms,0,accepting}')::boolean then raise exception 'Admission intake is not available'; end if;
    path=array['years',idx::text,'records','inquiries']; collection_name='inquiries';
  elsif p_kind='tenant-requests' then
    if p_record->>'kind'<>'tenant-requests' or p_record->>'status'<>'requested' then raise exception 'Invalid school request'; end if;
    path=array['years',idx::text,'extensions']; collection_name='extension:tenant-requests';
  else raise exception 'Public request kind is unavailable'; end if;
  if exists(select 1 from jsonb_array_elements(doc#>path) v where v->>'id'=p_record->>'id') then raise exception 'Request already exists'; end if;
  doc=jsonb_set(doc,path,(doc#>path)||jsonb_build_array(p_record));
  doc=jsonb_set(doc,'{revision}',to_jsonb(p_expected_revision+1));
  update mis_private.workspace_documents set document=doc,revision=p_expected_revision+1,updated_at=now() where school_id=p_school_id and revision=p_expected_revision;
  insert into mis_private.module_records(school_id,academic_year_id,collection,id,document) values(p_school_id,p_year_id,collection_name,p_record->>'id',p_record);
  insert into mis_private.audit_events(school_id,actor_id,action,revision) values(p_school_id,null,'Public intake: '||p_kind,p_expected_revision+1);
  return p_expected_revision+1;
end;
$$;
