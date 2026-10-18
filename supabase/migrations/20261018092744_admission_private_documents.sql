alter table public.mis_documents drop constraint mis_documents_owner_type_check;
alter table public.mis_documents add constraint mis_documents_owner_type_check check(owner_type in ('school','student','staff','admission'));
alter table public.mis_documents add constraint mis_documents_admission_category_check check(owner_type <> 'admission' or category in ('general','identity'));
create or replace function public.mis_begin_document(p_actor uuid,p_document jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare d public.mis_documents; prev public.mis_documents;
begin
 d.id=(p_document->>'id')::uuid; d.school_id=p_document->>'school_id';
 perform mis_private.assert_document_actor(p_actor,d.school_id);
 if not exists(select 1 from public.mis_academic_years where school_id=d.school_id and id=p_document->>'academic_year_id' and not locked) then raise exception 'Year is archived or unavailable' using errcode='PT403'; end if;
 if p_document->>'owner_type'='admission' then
  if not exists(select 1 from public.mis_effective_memberships where user_id=p_actor and school_id=d.school_id and active and role in ('admin','principal')) or not exists(select 1 from mis_private.module_records where school_id=d.school_id and academic_year_id=p_document->>'academic_year_id' and collection='inquiries' and id=p_document->>'owner_id') then raise exception 'Application owner is unavailable' using errcode='PT403';end if;
 elsif p_document->>'owner_type' <> 'school' and not exists(select 1 from public.mis_people where school_id=d.school_id and id=p_document->>'owner_id' and kind=p_document->>'owner_type') then raise exception 'Owner is unavailable' using errcode='PT403'; end if;
 if nullif(p_document->>'replaces_id','') is not null then
  select * into prev from public.mis_documents where id=(p_document->>'replaces_id')::uuid for update;
  if prev.id is null or prev.status <> 'ready' or prev.school_id<>d.school_id or prev.academic_year_id<>p_document->>'academic_year_id' or prev.owner_type<>p_document->>'owner_type' or prev.owner_id<>p_document->>'owner_id' or prev.category<>p_document->>'category' then raise exception 'Replacement target changed' using errcode='PT409'; end if;
 end if;
 insert into public.mis_documents(id,school_id,academic_year_id,owner_type,owner_id,category,filename,mime_type,byte_size,sha256,object_path,created_by,version,replaces_id)
 values(d.id,d.school_id,p_document->>'academic_year_id',p_document->>'owner_type',p_document->>'owner_id',p_document->>'category',p_document->>'filename',p_document->>'mime_type',(p_document->>'byte_size')::integer,p_document->>'sha256',d.school_id||'/'||d.id::text,p_actor,coalesce(prev.version,0)+1,prev.id) returning * into d;
 insert into public.mis_document_events(document_id,actor_id,event) values(d.id,p_actor,'upload');
 return to_jsonb(d);
end $$;


-- Required files are checked against ready private objects, never checklist metadata.
create function mis_private.guard_admission_files() returns trigger language plpgsql security invoker set search_path='' as $$
declare year_doc jsonb;application jsonb;file_id uuid;
begin
 for year_doc in select value from jsonb_array_elements(new.document->'years') loop
  if coalesce((year_doc#>>'{records,admissionForms,0,requireDocuments}')::boolean,false) then
   for application in select value from jsonb_array_elements(coalesce(year_doc#>'{records,inquiries}','[]'::jsonb)) where value->>'stage'='enrolled' loop
    if not exists(select 1 from mis_private.module_records saved where saved.school_id=new.school_id and saved.academic_year_id=year_doc#>>'{setup,calendar,year,id}' and saved.collection='inquiries' and saved.id=application->>'id' and saved.document->>'stage'='enrolled') then
     select id into file_id from public.mis_documents where school_id=new.school_id and academic_year_id=year_doc#>>'{setup,calendar,year,id}' and owner_type='admission' and owner_id=application->>'id' and status='ready' order by id limit 1 for share;
     if file_id is null then raise exception 'Upload the required private application documents before enrolment' using errcode='PT403';end if;
    end if;
   end loop;
  end if;
 end loop;
 return new;
end $$;
create trigger mis_guard_admission_files before insert or update on mis_private.workspace_documents for each row execute function mis_private.guard_admission_files();
revoke all on function mis_private.guard_admission_files() from public,anon,authenticated;
grant execute on function mis_private.guard_admission_files() to service_role;
