-- Revocation is security metadata, separate from immutable issued/archived contents.
create table public.mis_publication_revocations (
 school_id text not null references public.mis_schools(id),academic_year_id text not null,publication_id text not null,
 reference text not null,reason text not null check(length(reason) between 8 and 500),revoked_by uuid not null references auth.users(id),revoked_at timestamptz not null default now(),
 primary key(school_id,academic_year_id,publication_id)
);
create index mis_publication_revocations_reference_idx on public.mis_publication_revocations(school_id,academic_year_id,reference);
create index mis_publication_revocations_actor_idx on public.mis_publication_revocations(revoked_by);
alter table public.mis_publication_revocations enable row level security;
revoke all on public.mis_publication_revocations from public,anon,authenticated;
grant select,insert on public.mis_publication_revocations to service_role;
create function public.mis_revoke_publication(p_actor uuid,p_school text,p_year text,p_publication text,p_reason text) returns void
language plpgsql security invoker set search_path='' as $$
declare doc jsonb;pub jsonb;current_revision bigint;
begin
 if not exists(select 1 from public.mis_effective_memberships where user_id=p_actor and school_id=p_school and active and role in ('admin','principal')) then raise exception 'Administrator required' using errcode='PT403';end if;
 if length(btrim(p_reason)) not between 8 and 500 then raise exception 'Reason required' using errcode='PT400';end if;
 select document,revision into doc,current_revision from mis_private.workspace_documents where school_id=p_school;
 select publication into pub from jsonb_array_elements(doc->'years') year_doc cross join lateral jsonb_array_elements(coalesce(year_doc#>'{workflows,publications}','[]'::jsonb)) publication where year_doc#>>'{setup,calendar,year,id}'=p_year and publication->>'id'=p_publication;
 if pub is null then raise exception 'Publication unavailable' using errcode='PT404';end if;
 insert into public.mis_publication_revocations(school_id,academic_year_id,publication_id,reference,reason,revoked_by) values(p_school,p_year,p_publication,pub->>'reference',btrim(p_reason),p_actor) on conflict(school_id,academic_year_id,publication_id) do nothing;
 if found then insert into mis_private.audit_events(school_id,actor_id,action,revision) values(p_school,p_actor,'Publication revoked: '||p_publication,current_revision);end if;
end $$;
revoke all on function public.mis_revoke_publication(uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.mis_revoke_publication(uuid,text,text,text,text) to service_role;
