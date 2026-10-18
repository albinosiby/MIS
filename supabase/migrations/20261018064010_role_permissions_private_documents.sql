-- Private immutable binaries. No browser metadata or Storage policies are granted.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('mis-private-documents','mis-private-documents',false,5000000,array['application/pdf','image/png','image/jpeg'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create table public.mis_documents (
 id uuid primary key,
 school_id text not null references public.mis_schools(id),
 academic_year_id text not null,
 owner_type text not null check(owner_type in ('school','student','staff')),
 owner_id text not null,
 category text not null check(category in ('general','identity','academic','employment','medical','counselling','finance')),
 filename text not null check(length(filename) between 1 and 180 and filename !~ '[\/\\]'),
 mime_type text not null check(mime_type in ('application/pdf','image/png','image/jpeg')),
 byte_size integer not null check(byte_size between 1 and 5000000),
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 object_path text not null unique,
 created_by uuid not null references auth.users(id),
 status text not null default 'uploading' check(status in ('uploading','ready','superseded','revoked','deleting','deleted')),
 version integer not null check(version > 0),
 replaces_id uuid references public.mis_documents(id),
 created_at timestamptz not null default now(),
 retain_until timestamptz not null default (now() + interval '30 days'),
 foreign key(school_id,academic_year_id) references public.mis_academic_years(school_id,id),
 check(owner_type <> 'school' or (owner_id=school_id and category='general')),
 check(category <> 'employment' or owner_type='staff'),
 check(category <> 'academic' or owner_type='student')
);
create index mis_documents_scope_idx on public.mis_documents(school_id,academic_year_id,created_at desc,id);
create index mis_documents_owner_idx on public.mis_documents(school_id,owner_type,owner_id,category);
create index mis_documents_actor_idx on public.mis_documents(created_by);
create unique index mis_documents_successor_idx on public.mis_documents(replaces_id) where status in ('uploading','ready');
create table public.mis_document_events (
 id bigint generated always as identity primary key,
 document_id uuid not null references public.mis_documents(id),
 actor_id uuid not null references auth.users(id),
 event text not null check(event in ('upload','ready','failed','download','revoke','purge-start','purged')),
 created_at timestamptz not null default now()
);
create index mis_document_events_document_idx on public.mis_document_events(document_id,created_at desc);
create index mis_document_events_actor_idx on public.mis_document_events(actor_id);
alter table public.mis_documents enable row level security;
alter table public.mis_document_events enable row level security;
revoke all on public.mis_documents,public.mis_document_events from public,anon,authenticated;
grant select,insert,update,delete on public.mis_documents,public.mis_document_events to service_role;
grant usage,select on sequence public.mis_document_events_id_seq to service_role;

create function mis_private.assert_document_actor(p_actor uuid,p_school text) returns void
language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.mis_memberships where user_id=p_actor and school_id=p_school and active and role not in ('platform','group')) then raise exception 'School access denied' using errcode='PT403'; end if;
end $$;
revoke all on function mis_private.assert_document_actor(uuid,text) from public,anon,authenticated;
grant execute on function mis_private.assert_document_actor(uuid,text) to service_role;

create function public.mis_begin_document(p_actor uuid,p_document jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare d public.mis_documents; prev public.mis_documents;
begin
 d.id=(p_document->>'id')::uuid; d.school_id=p_document->>'school_id';
 perform mis_private.assert_document_actor(p_actor,d.school_id);
 if not exists(select 1 from public.mis_academic_years where school_id=d.school_id and id=p_document->>'academic_year_id' and not locked) then raise exception 'Year is archived or unavailable' using errcode='PT403'; end if;
 if p_document->>'owner_type' <> 'school' and not exists(select 1 from public.mis_people where school_id=d.school_id and id=p_document->>'owner_id' and kind=p_document->>'owner_type') then raise exception 'Owner is unavailable' using errcode='PT403'; end if;
 if nullif(p_document->>'replaces_id','') is not null then
  select * into prev from public.mis_documents where id=(p_document->>'replaces_id')::uuid for update;
  if prev.id is null or prev.status <> 'ready' or prev.school_id<>d.school_id or prev.academic_year_id<>p_document->>'academic_year_id' or prev.owner_type<>p_document->>'owner_type' or prev.owner_id<>p_document->>'owner_id' or prev.category<>p_document->>'category' then raise exception 'Replacement target changed' using errcode='PT409'; end if;
 end if;
 insert into public.mis_documents(id,school_id,academic_year_id,owner_type,owner_id,category,filename,mime_type,byte_size,sha256,object_path,created_by,version,replaces_id)
 values(d.id,d.school_id,p_document->>'academic_year_id',p_document->>'owner_type',p_document->>'owner_id',p_document->>'category',p_document->>'filename',p_document->>'mime_type',(p_document->>'byte_size')::integer,p_document->>'sha256',d.school_id||'/'||d.id::text,p_actor,coalesce(prev.version,0)+1,prev.id) returning * into d;
 insert into public.mis_document_events(document_id,actor_id,event) values(d.id,p_actor,'upload');
 return to_jsonb(d);
end $$;

create function public.mis_document_lifecycle(p_actor uuid,p_id uuid,p_action text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare d public.mis_documents; actor_role text;
begin
 select * into d from public.mis_documents where id=p_id for update;
 if d.id is null then raise exception 'File unavailable' using errcode='PT404'; end if;
 perform mis_private.assert_document_actor(p_actor,d.school_id);
 select role into actor_role from public.mis_memberships where user_id=p_actor;
 if p_action='ready' and d.status='uploading' and d.created_by=p_actor then
  if d.replaces_id is not null then
   update public.mis_documents set status='superseded' where id=d.replaces_id and status='ready';
   if not found then raise exception 'Replacement target changed' using errcode='PT409'; end if;
  end if;
  update public.mis_documents set status='ready' where id=p_id;
 elsif p_action='failed' and d.status='uploading' and d.created_by=p_actor then
  update public.mis_documents set status='deleted',retain_until=now() where id=p_id;
 elsif p_action='download' and d.status='ready' then null;
 elsif p_action='revoke' and d.status in ('ready','superseded') then
  update public.mis_documents set status='revoked' where id=p_id;
 elsif p_action='purge-start' and actor_role in ('admin','principal') and d.status in ('revoked','superseded','deleted','deleting') and d.retain_until<=now() then
  update public.mis_documents set status='deleting' where id=p_id;
 elsif p_action='purged' and actor_role in ('admin','principal') and d.status='deleting' then
  update public.mis_documents set status='deleted' where id=p_id;
 else raise exception 'File state does not permit this action' using errcode='PT409';
 end if;
 insert into public.mis_document_events(document_id,actor_id,event) values(p_id,p_actor,p_action);
 select * into d from public.mis_documents where id=p_id;
 return to_jsonb(d);
end $$;
revoke all on function public.mis_begin_document(uuid,jsonb),public.mis_document_lifecycle(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.mis_begin_document(uuid,jsonb),public.mis_document_lifecycle(uuid,uuid,text) to service_role;
