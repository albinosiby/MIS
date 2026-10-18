-- Supplemental grants are empty initially: existing roles, Auth IDs and primary memberships are preserved.
create table public.mis_role_grants (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 school_id text not null references public.mis_schools(id),
 role text not null check(role in ('admin','principal','teacher','staff','accountant','parent','student','driver','librarian','hr','nurse','counsellor','transport','inventory','warden')),
 person_id text,
 display_name text not null check(length(display_name) between 1 and 160),
 active boolean not null default false,
 granted_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 unique(user_id,school_id,role),foreign key(school_id,person_id) references public.mis_people(school_id,id)
);
create index mis_role_grants_school_person_idx on public.mis_role_grants(school_id,person_id);
create index mis_role_grants_grantor_idx on public.mis_role_grants(granted_by);
alter table public.mis_role_grants enable row level security;
revoke all on public.mis_role_grants from public,anon,authenticated;
grant all on public.mis_role_grants to service_role;
create view public.mis_effective_memberships with(security_invoker=true) as
 select 'primary:'||m.user_id::text as membership_id,m.user_id,m.school_id,m.role,m.person_id,m.display_name,m.active,m.created_at from public.mis_memberships m
 union all
 select g.id::text as membership_id,g.user_id,g.school_id,g.role,g.person_id,g.display_name,(g.active and m.active) as active,g.created_at from public.mis_role_grants g join public.mis_memberships m on m.user_id=g.user_id
 where not(g.school_id=m.school_id and g.role=m.role);
revoke all on public.mis_effective_memberships from public,anon,authenticated;
grant select on public.mis_effective_memberships to service_role;
create or replace function mis_private.assert_document_actor(p_actor uuid,p_school text) returns void
language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.mis_effective_memberships where user_id=p_actor and school_id=p_school and active and role not in ('platform','group')) then raise exception 'School access denied' using errcode='PT403'; end if;
end $$;

create or replace function public.mis_document_lifecycle(p_actor uuid,p_id uuid,p_action text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare d public.mis_documents; actor_role text;
begin
 select * into d from public.mis_documents where id=p_id for update;
 if d.id is null then raise exception 'File unavailable' using errcode='PT404'; end if;
 perform mis_private.assert_document_actor(p_actor,d.school_id);
 select role into actor_role from public.mis_effective_memberships where user_id=p_actor and school_id=d.school_id and active order by (role in ('admin','principal')) desc limit 1;
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

create or replace function public.mis_create_conversation(p_actor uuid,p_school text,p_year text,p_student text,p_subject text,p_participants uuid[],p_key uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result public.mis_conversations; participant uuid;
begin
 perform mis_private.assert_document_actor(p_actor,p_school);
 if cardinality(p_participants) not between 1 and 10 or not exists(select 1 from public.mis_academic_years where school_id=p_school and id=p_year and not locked) then raise exception 'Invalid participants or academic year' using errcode='PT403'; end if;
 select * into result from public.mis_conversations where school_id=p_school and created_by=p_actor and client_key=p_key;
 if result.id is not null then
  if result.subject<>p_subject or result.student_id is distinct from p_student or result.academic_year_id<>p_year then raise exception 'Idempotency key reused' using errcode='PT409'; end if;
  if exists((select user_id from public.mis_conversation_participants where conversation_id=result.id and active) except (select distinct unnest(p_participants||array[p_actor]))) or exists((select distinct unnest(p_participants||array[p_actor])) except (select user_id from public.mis_conversation_participants where conversation_id=result.id and active)) then raise exception 'Conversation key reused with different participants' using errcode='PT409'; end if;
  return to_jsonb(result);
 end if;
 foreach participant in array p_participants||array[p_actor] loop
  if not exists(select 1 from public.mis_effective_memberships where user_id=participant and school_id=p_school and active and role not in ('platform','group')) then raise exception 'Participant unavailable' using errcode='PT403'; end if;
 end loop;
 insert into public.mis_conversations(school_id,academic_year_id,student_id,subject,created_by,client_key) values(p_school,p_year,p_student,p_subject,p_actor,p_key) returning * into result;
 insert into public.mis_conversation_participants(conversation_id,user_id) select result.id, id from unnest(p_participants||array[p_actor]) id on conflict do nothing;
 return to_jsonb(result);
end $$;

create or replace function public.mis_deliver_message(p_job uuid,p_lease uuid,p_recipients uuid[]) returns void
language plpgsql security invoker set search_path='' as $$
declare job public.mis_jobs; msg public.mis_messages; thread public.mis_conversations;
begin
 select * into job from public.mis_jobs where id=p_job for update;
 if job.status<>'running' or job.kind<>'message-delivery' or job.lease_token is distinct from p_lease or job.lease_until<=now() then raise exception 'Lease expired' using errcode='PT409'; end if;
 select * into msg from public.mis_messages where id=(job.payload->>'messageId')::uuid for update;
 select * into thread from public.mis_conversations where id=msg.conversation_id for update;
 if msg.id is null or thread.school_id<>job.school_id or thread.state<>'open' or msg.status='withdrawn' then raise exception 'Conversation unavailable' using errcode='PT403'; end if;
 insert into public.mis_inbox_notifications(school_id,user_id,title,body,href,source_key)
 select distinct job.school_id,p.user_id,'New private message',left(thread.subject,160),'/communication/inbox?thread='||thread.id::text,'message:'||msg.id::text
 from public.mis_conversation_participants p join public.mis_effective_memberships m on m.user_id=p.user_id and m.school_id=job.school_id and m.active
 where p.conversation_id=thread.id and p.active and p.user_id<>msg.sender_id and p.user_id=any(p_recipients)
 on conflict(school_id,user_id,source_key) do nothing;
 update public.mis_messages set status='sent',sent_at=coalesce(sent_at,now()) where id=msg.id and status in ('queued','failed');
 perform public.mis_finish_job(p_job,p_lease,'completed','In-app message delivered');
end $$;

create or replace function public.mis_deliver_notification(p_job uuid,p_lease uuid,p_recipients uuid[],p_title text,p_body text,p_href text) returns void
language plpgsql security invoker set search_path='' as $$
declare job public.mis_jobs;
begin
 select * into job from public.mis_jobs where id=p_job for update;
 if job.status<>'running' or job.lease_token is distinct from p_lease or job.lease_until<=now() or job.kind not in ('notice-delivery','attendance-alert','report-export') then raise exception 'Lease expired' using errcode='PT409'; end if;
 insert into public.mis_inbox_notifications(school_id,user_id,title,body,href,source_key)
 select distinct job.school_id,m.user_id,left(p_title,160),left(p_body,2000),p_href,job.dedupe_key from public.mis_effective_memberships m where m.school_id=job.school_id and m.active and m.user_id=any(p_recipients)
 on conflict(school_id,user_id,source_key) do nothing;
 perform public.mis_finish_job(p_job,p_lease,'completed','In-app notification delivered');
end $$;

create or replace function public.mis_commit_workspace(p_school_id text,p_expected_revision bigint,p_document jsonb,p_actor_id uuid,p_action text)
returns bigint language plpgsql security invoker set search_path='' as $$
declare v_revision bigint; y jsonb; r jsonb; col record;
begin
  if not exists(select 1 from public.mis_effective_memberships where user_id=p_actor_id and school_id=p_school_id and active) then
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

