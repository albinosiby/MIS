-- Anonymous web visitors never get a canonical document or a direct write grant.
-- Only the server's narrowly validated public intake adapter can invoke this function.
create function public.mis_public_intake(p_school_id text,p_expected_revision bigint,p_year_id text,p_kind text,p_record jsonb)
returns bigint language plpgsql security invoker set search_path='' as $$
declare doc jsonb; idx integer; year_doc jsonb; path text[]; collection_name text;
begin
  select document into doc from mis_private.workspace_documents where school_id=p_school_id and revision=p_expected_revision for update;
  if doc is null then raise exception 'Workspace changed. Please retry.' using errcode='40001'; end if;
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
revoke all on function public.mis_public_intake(text,bigint,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.mis_public_intake(text,bigint,text,text,jsonb) to service_role;
