-- Serialize revocation and canonical commits on the same school document row.
create or replace function public.mis_revoke_publication(p_actor uuid,p_school text,p_year text,p_publication text,p_reason text) returns void
language plpgsql security invoker set search_path='' as $$
declare doc jsonb;pub jsonb;current_revision bigint;
begin
 if not exists(select 1 from public.mis_effective_memberships where user_id=p_actor and school_id=p_school and active and role in ('admin','principal')) then raise exception 'Administrator required' using errcode='PT403';end if;
 if length(btrim(p_reason)) not between 8 and 500 then raise exception 'Reason required' using errcode='PT400';end if;
 select document,revision into doc,current_revision from mis_private.workspace_documents where school_id=p_school for update;
 select publication into pub from jsonb_array_elements(doc->'years') year_doc cross join lateral jsonb_array_elements(coalesce(year_doc#>'{workflows,publications}','[]'::jsonb)) publication where year_doc#>>'{setup,calendar,year,id}'=p_year and publication->>'id'=p_publication;
 if pub is null then raise exception 'Publication unavailable' using errcode='PT404';end if;
 insert into public.mis_publication_revocations(school_id,academic_year_id,publication_id,reference,reason,revoked_by) values(p_school,p_year,p_publication,pub->>'reference',btrim(p_reason),p_actor) on conflict(school_id,academic_year_id,publication_id) do nothing;
 if found then insert into mis_private.audit_events(school_id,actor_id,action,revision) values(p_school,p_actor,'Publication revoked: '||p_publication,current_revision);end if;
end $$;

create function mis_private.guard_publication_dependencies() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if exists(
  select 1 from jsonb_array_elements(new.document->'years') year_doc
  cross join lateral jsonb_array_elements(coalesce(year_doc#>'{workflows,publications}','[]'::jsonb)) pub
  cross join lateral jsonb_array_elements(case when pub->>'kind'='transcript' then coalesce(pub#>'{snapshot,assessments}','[]'::jsonb) else '[]'::jsonb end) assessment
  join public.mis_publication_revocations revoked on revoked.school_id=new.school_id and revoked.reference=assessment->>'reference'
  where pub->>'kind'='transcript' and not exists(
   select 1 from public.mis_publication_directory saved where saved.school_id=new.school_id and saved.academic_year_id=year_doc#>>'{setup,calendar,year,id}' and saved.id=pub->>'id'
  )
 ) then raise exception 'A source publication was revoked' using errcode='PT403';end if;
 return new;
end $$;
create trigger mis_guard_publication_dependencies before insert or update on mis_private.workspace_documents for each row execute function mis_private.guard_publication_dependencies();
revoke all on function mis_private.guard_publication_dependencies() from public,anon,authenticated;
grant execute on function mis_private.guard_publication_dependencies() to service_role;
