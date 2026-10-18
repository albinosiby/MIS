-- Metadata projection supports fast verification without exposing student identity or document contents.
create table public.mis_publication_directory (
 school_id text not null references public.mis_schools(id),academic_year_id text not null,id text not null,
 kind text not null,source_id text not null,reference text not null,inline_revoked_at timestamptz,
 primary key(school_id,academic_year_id,id)
);
create index mis_publication_directory_certificate_idx on public.mis_publication_directory(school_id,academic_year_id,source_id) where kind='certificate';
alter table public.mis_publication_directory enable row level security;
revoke all on public.mis_publication_directory from public,anon,authenticated;
grant select,insert,update on public.mis_publication_directory to service_role;
create index mis_certificate_reference_lookup_idx on mis_private.module_records(school_id,(document->>'reference')) where collection='certificates';
create function mis_private.refresh_publication_directory(p_school text,p_doc jsonb,p_previous jsonb default null) returns void
language plpgsql security invoker set search_path='' as $$
declare year_doc jsonb;old_year jsonb;
begin
 for year_doc in select value from jsonb_array_elements(p_doc->'years') loop
  select value into old_year from jsonb_array_elements(coalesce(p_previous->'years','[]'::jsonb)) where value#>>'{setup,calendar,year,id}'=year_doc#>>'{setup,calendar,year,id}';
  if coalesce(old_year#>'{workflows,publications}','[]'::jsonb) is not distinct from coalesce(year_doc#>'{workflows,publications}','[]'::jsonb) then continue;end if;
  insert into public.mis_publication_directory(school_id,academic_year_id,id,kind,source_id,reference,inline_revoked_at)
  select p_school,year_doc#>>'{setup,calendar,year,id}',p->>'id',p->>'kind',p->>'sourceId',p->>'reference',(p->>'revokedAt')::timestamptz from jsonb_array_elements(coalesce(year_doc#>'{workflows,publications}','[]'::jsonb)) p
  on conflict(school_id,academic_year_id,id) do update set inline_revoked_at=coalesce(mis_publication_directory.inline_revoked_at,excluded.inline_revoked_at) where mis_publication_directory.inline_revoked_at is null and excluded.inline_revoked_at is not null;
 end loop;
end $$;
create function mis_private.sync_publication_directory() returns trigger language plpgsql security invoker set search_path='' as $$
begin perform mis_private.refresh_publication_directory(new.school_id,new.document,case when tg_op='UPDATE' then old.document else null end);return new;end $$;
create trigger mis_sync_publication_directory after insert or update on mis_private.workspace_documents for each row execute function mis_private.sync_publication_directory();
revoke all on function mis_private.refresh_publication_directory(text,jsonb,jsonb),mis_private.sync_publication_directory() from public,anon,authenticated;
grant execute on function mis_private.refresh_publication_directory(text,jsonb,jsonb),mis_private.sync_publication_directory() to service_role;
do $$ declare row record;begin for row in select school_id,document from mis_private.workspace_documents loop perform mis_private.refresh_publication_directory(row.school_id,row.document);end loop;end $$;
create function public.mis_verify_certificate(p_school text,p_reference text) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare cert jsonb;year_id text;cert_id text;matches integer;school_name text;
begin
 select count(*) into matches from mis_private.module_records where school_id=p_school and collection='certificates' and document->>'reference'=p_reference and document->>'status'='issued';
 if matches<>1 then return null;end if;
 select document,academic_year_id,id into cert,year_id,cert_id from mis_private.module_records where school_id=p_school and collection='certificates' and document->>'reference'=p_reference and document->>'status'='issued';
 if exists(select 1 from public.mis_publication_directory p left join public.mis_publication_revocations r on r.school_id=p.school_id and r.academic_year_id=p.academic_year_id and r.publication_id=p.id where p.school_id=p_school and p.academic_year_id=year_id and p.kind='certificate' and p.source_id=cert_id and (p.inline_revoked_at is not null or r.publication_id is not null)) then return null;end if;
 select name into school_name from public.mis_schools where id=p_school;
 return jsonb_build_object('type',cert->>'type','issuedOn',cert->>'issuedOn','school',school_name);
end $$;
revoke all on function public.mis_verify_certificate(text,text) from public,anon,authenticated;
grant execute on function public.mis_verify_certificate(text,text) to service_role;
