-- Private conversations and durable work. Application ACL checks accompany service-only functions.
create table public.mis_conversations (
 id uuid primary key default gen_random_uuid(), school_id text not null, academic_year_id text not null,
 student_id text, subject text not null check(length(subject) between 2 and 160), created_by uuid not null references auth.users(id),
 client_key uuid not null, state text not null default 'open' check(state in ('open','closed','flagged')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(school_id,academic_year_id) references public.mis_academic_years(school_id,id),
 foreign key(school_id,student_id) references public.mis_people(school_id,id), unique(school_id,created_by,client_key)
);
create table public.mis_conversation_participants (
 conversation_id uuid not null references public.mis_conversations(id), user_id uuid not null references auth.users(id),
 active boolean not null default true, last_read_at timestamptz, primary key(conversation_id,user_id)
);
create table public.mis_messages (
 id uuid primary key default gen_random_uuid(), conversation_id uuid not null references public.mis_conversations(id),
 sender_id uuid not null references auth.users(id), client_key uuid not null, body text not null check(length(body) between 1 and 4000),
 attachment_ids uuid[] not null default '{}' check(cardinality(attachment_ids)<=5),
 status text not null default 'queued' check(status in ('queued','sent','withdrawn')),
 created_at timestamptz not null default now(), sent_at timestamptz, unique(conversation_id,sender_id,client_key)
);
create table public.mis_communication_settings (
 school_id text primary key references public.mis_schools(id), enabled boolean not null default false,
 quiet_start integer not null default 22 check(quiet_start between 0 and 23), quiet_end integer not null default 7 check(quiet_end between 0 and 23),
 timezone text not null default 'Asia/Kolkata', check(not enabled or quiet_start<>quiet_end)
);
create table public.mis_jobs (
 id uuid primary key default gen_random_uuid(), school_id text not null references public.mis_schools(id),
 kind text not null check(kind in ('message-delivery','notice-delivery','attendance-alert','report-export')),
 payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=20000),
 dedupe_key text not null check(length(dedupe_key) between 1 and 250), created_by uuid references auth.users(id),
 status text not null default 'pending' check(status in ('pending','running','retry','completed','failed','cancelled','blocked')),
 run_at timestamptz not null default now(), attempts integer not null default 0 check(attempts between 0 and 10),
 max_attempts integer not null default 5 check(max_attempts between 1 and 10), lease_token uuid, lease_until timestamptz,
 last_error text check(length(last_error)<=500), created_at timestamptz not null default now(), completed_at timestamptz,
 unique(school_id,dedupe_key)
);
create table public.mis_job_attempts (
 id bigint generated always as identity primary key, job_id uuid not null references public.mis_jobs(id), attempt integer not null,
 outcome text not null check(outcome in ('completed','retry','failed','cancelled','blocked')), detail text not null check(length(detail)<=500), created_at timestamptz not null default now()
);
create table public.mis_inbox_notifications (
 id uuid primary key default gen_random_uuid(), school_id text not null references public.mis_schools(id), user_id uuid not null references auth.users(id),
 title text not null check(length(title)<=160), body text not null check(length(body)<=2000), href text not null check(href like '/%' and length(href)<=300),
 source_key text not null check(length(source_key)<=250), created_at timestamptz not null default now(), read_at timestamptz,
 unique(school_id,user_id,source_key)
);
create index mis_conversations_scope_idx on public.mis_conversations(school_id,academic_year_id,updated_at desc,id);
create index mis_conversations_student_idx on public.mis_conversations(school_id,student_id);
create index mis_conversations_creator_idx on public.mis_conversations(created_by);
create index mis_conversation_user_idx on public.mis_conversation_participants(user_id,active,conversation_id);
create index mis_messages_thread_idx on public.mis_messages(conversation_id,created_at,id);
create index mis_messages_sender_idx on public.mis_messages(sender_id);
create index mis_jobs_due_idx on public.mis_jobs(run_at,id) where status in ('pending','retry','running');
create index mis_jobs_school_idx on public.mis_jobs(school_id,created_at desc);
create index mis_jobs_creator_idx on public.mis_jobs(created_by);
create index mis_job_attempts_job_idx on public.mis_job_attempts(job_id,created_at desc);
create index mis_inbox_user_idx on public.mis_inbox_notifications(school_id,user_id,created_at desc);
create index mis_inbox_auth_user_idx on public.mis_inbox_notifications(user_id);

do $$ declare name text; begin
 foreach name in array array['mis_conversations','mis_conversation_participants','mis_messages','mis_communication_settings','mis_jobs','mis_job_attempts','mis_inbox_notifications'] loop
  execute format('alter table public.%I enable row level security',name);
  execute format('revoke all on public.%I from public,anon,authenticated',name);
  execute format('grant all on public.%I to service_role',name);
 end loop;
end $$;
grant usage,select on sequence public.mis_job_attempts_id_seq to service_role;

create function public.mis_create_conversation(p_actor uuid,p_school text,p_year text,p_student text,p_subject text,p_participants uuid[],p_key uuid) returns jsonb
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
  if not exists(select 1 from public.mis_memberships where user_id=participant and school_id=p_school and active and role not in ('platform','group')) then raise exception 'Participant unavailable' using errcode='PT403'; end if;
 end loop;
 insert into public.mis_conversations(school_id,academic_year_id,student_id,subject,created_by,client_key) values(p_school,p_year,p_student,p_subject,p_actor,p_key) returning * into result;
 insert into public.mis_conversation_participants(conversation_id,user_id) select result.id, id from unnest(p_participants||array[p_actor]) id on conflict do nothing;
 return to_jsonb(result);
end $$;

create function public.mis_send_message(p_actor uuid,p_conversation uuid,p_body text,p_attachments uuid[],p_key uuid,p_run_at timestamptz) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare thread public.mis_conversations; msg public.mis_messages;
begin
 select * into thread from public.mis_conversations where id=p_conversation for update;
 perform mis_private.assert_document_actor(p_actor,thread.school_id);
 if thread.id is null or thread.state<>'open' or not exists(select 1 from public.mis_conversation_participants where conversation_id=p_conversation and user_id=p_actor and active) or exists(select 1 from public.mis_academic_years where school_id=thread.school_id and id=thread.academic_year_id and locked) then raise exception 'Conversation unavailable' using errcode='PT403'; end if;
 select * into msg from public.mis_messages where conversation_id=p_conversation and sender_id=p_actor and client_key=p_key;
 if msg.id is not null then
  if msg.body<>p_body or msg.attachment_ids<>p_attachments then raise exception 'Message key reused' using errcode='PT409'; end if;
  return to_jsonb(msg);
 end if;
 if exists(select 1 from unnest(p_attachments) a where not exists(select 1 from public.mis_documents d where d.id=a and d.school_id=thread.school_id and d.status='ready')) then raise exception 'Attachment unavailable' using errcode='PT403'; end if;
 if (select count(*) from public.mis_messages where sender_id=p_actor and created_at>now()-interval '1 minute') >= 30 then raise exception 'Message rate limit reached' using errcode='PT429'; end if;
 insert into public.mis_messages(conversation_id,sender_id,body,attachment_ids,client_key) values(p_conversation,p_actor,p_body,p_attachments,p_key) returning * into msg;
 insert into public.mis_jobs(school_id,kind,payload,dedupe_key,created_by,run_at) values(thread.school_id,'message-delivery',jsonb_build_object('messageId',msg.id),'message:'||msg.id::text,p_actor,greatest(now(),p_run_at)) on conflict(school_id,dedupe_key) do nothing;
 update public.mis_conversations set updated_at=now() where id=p_conversation;
 return to_jsonb(msg);
end $$;

create function public.mis_claim_jobs(p_limit integer default 1) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 if p_limit not between 1 and 10 then raise exception 'Invalid claim size'; end if;
 update public.mis_jobs set status='failed',last_error='Worker lease expired at maximum attempts',lease_token=null,lease_until=null where status='running' and lease_until<=now() and attempts>=max_attempts;
 with picked as (
  select id from public.mis_jobs where run_at<=now() and attempts<max_attempts and (status in ('pending','retry') or (status='running' and lease_until<=now())) order by run_at,id for update skip locked limit p_limit
 ), claimed as (
  update public.mis_jobs j set status='running',attempts=attempts+1,lease_token=gen_random_uuid(),lease_until=now()+interval '5 minutes' from picked p where j.id=p.id returning j.*
 ) select coalesce(jsonb_agg(to_jsonb(c)),'[]') into result from claimed c;
 return result;
end $$;

create function public.mis_finish_job(p_id uuid,p_lease uuid,p_outcome text,p_detail text default '') returns void
language plpgsql security invoker set search_path='' as $$
declare job public.mis_jobs; next_status text;
begin
 select * into job from public.mis_jobs where id=p_id for update;
 if job.status<>'running' or job.lease_token is distinct from p_lease or job.lease_until<=now() then raise exception 'Lease expired' using errcode='PT409'; end if;
 if p_outcome not in ('completed','retry','cancelled','blocked') then raise exception 'Invalid job outcome'; end if;
 next_status=case when p_outcome='retry' and job.attempts>=job.max_attempts then 'failed' else p_outcome end;
 insert into public.mis_job_attempts(job_id,attempt,outcome,detail) values(p_id,job.attempts,next_status,left(p_detail,500));
 update public.mis_jobs set status=next_status,last_error=case when next_status='completed' then null else left(p_detail,500) end,
  run_at=case when next_status='retry' then now()+make_interval(secs=>least(3600,15*power(2,job.attempts-1))::integer) else run_at end,
  completed_at=case when next_status='completed' then now() else null end,lease_token=null,lease_until=null where id=p_id;
end $$;

create function public.mis_deliver_message(p_job uuid,p_lease uuid,p_recipients uuid[]) returns void
language plpgsql security invoker set search_path='' as $$
declare job public.mis_jobs; msg public.mis_messages; thread public.mis_conversations;
begin
 select * into job from public.mis_jobs where id=p_job for update;
 if job.status<>'running' or job.kind<>'message-delivery' or job.lease_token is distinct from p_lease or job.lease_until<=now() then raise exception 'Lease expired' using errcode='PT409'; end if;
 select * into msg from public.mis_messages where id=(job.payload->>'messageId')::uuid for update;
 select * into thread from public.mis_conversations where id=msg.conversation_id;
 if msg.id is null or thread.school_id<>job.school_id or thread.state='closed' then raise exception 'Conversation unavailable' using errcode='PT403'; end if;
 insert into public.mis_inbox_notifications(school_id,user_id,title,body,href,source_key)
 select job.school_id,p.user_id,'New private message',left(thread.subject,160),'/communication/inbox?thread='||thread.id::text,'message:'||msg.id::text
 from public.mis_conversation_participants p join public.mis_memberships m on m.user_id=p.user_id and m.school_id=job.school_id and m.active
 where p.conversation_id=thread.id and p.active and p.user_id<>msg.sender_id and p.user_id=any(p_recipients)
 on conflict(school_id,user_id,source_key) do nothing;
 update public.mis_messages set status='sent',sent_at=coalesce(sent_at,now()) where id=msg.id and status='queued';
 perform public.mis_finish_job(p_job,p_lease,'completed','In-app message delivered');
end $$;

create function public.mis_deliver_notification(p_job uuid,p_lease uuid,p_recipients uuid[],p_title text,p_body text,p_href text) returns void
language plpgsql security invoker set search_path='' as $$
declare job public.mis_jobs;
begin
 select * into job from public.mis_jobs where id=p_job for update;
 if job.status<>'running' or job.lease_token is distinct from p_lease or job.lease_until<=now() or job.kind not in ('notice-delivery','attendance-alert','report-export') then raise exception 'Lease expired' using errcode='PT409'; end if;
 insert into public.mis_inbox_notifications(school_id,user_id,title,body,href,source_key)
 select job.school_id,m.user_id,left(p_title,160),left(p_body,2000),p_href,job.dedupe_key from public.mis_memberships m where m.school_id=job.school_id and m.active and m.user_id=any(p_recipients)
 on conflict(school_id,user_id,source_key) do nothing;
 perform public.mis_finish_job(p_job,p_lease,'completed','In-app notification delivered');
end $$;

create function mis_private.queue_workspace_events() returns trigger
language plpgsql security invoker set search_path='' as $$
declare year jsonb; old_year jsonb; row jsonb; prior jsonb; actor_text text; actor uuid; run_at timestamptz;
begin
 for year in select value from jsonb_array_elements(new.document->'years') loop
  select value into old_year from jsonb_array_elements(old.document->'years') where value#>>'{setup,calendar,year,id}'=year#>>'{setup,calendar,year,id}';
  actor_text=year#>>'{setup,audit,-1,actor,accountId}';
  actor=case when actor_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then actor_text::uuid else null end;
  if coalesce((year->>'locked')::boolean,false) then continue; end if;
  for row in select value from jsonb_array_elements(year#>'{records,notices}') where value->>'status' in ('published','scheduled') loop
   select value into prior from jsonb_array_elements(coalesce(old_year#>'{records,notices}','[]')) where value->>'id'=row->>'id';
   if prior is not null and prior->>'status'=row->>'status' and prior->>'scheduledFor' is not distinct from row->>'scheduledFor' then continue; end if;
   run_at=case when row->>'status'='scheduled' then ((row->>'scheduledFor')::date+time '08:00') at time zone 'Asia/Kolkata' else now() end;
   insert into public.mis_jobs(school_id,kind,payload,dedupe_key,created_by,run_at) values(new.school_id,'notice-delivery',jsonb_build_object('yearId',year#>>'{setup,calendar,year,id}','noticeId',row->>'id'),'notice:'||(year#>>'{setup,calendar,year,id}')||':'||(row->>'id'),actor,run_at) on conflict(school_id,dedupe_key) do nothing;
  end loop;
  for row in select value from jsonb_array_elements(year#>'{records,attendance}') where value->>'personType'='student' and value->>'status'='absent' loop
   select value into prior from jsonb_array_elements(coalesce(old_year#>'{records,attendance}','[]')) where value->>'id'=row->>'id';
   if prior is not null and prior->>'status'='absent' then continue; end if;
   insert into public.mis_jobs(school_id,kind,payload,dedupe_key,created_by) values(new.school_id,'attendance-alert',jsonb_build_object('yearId',year#>>'{setup,calendar,year,id}','attendanceId',row->>'id'),'absence:'||(year#>>'{setup,calendar,year,id}')||':'||(row->>'id'),actor) on conflict(school_id,dedupe_key) do nothing;
  end loop;
 end loop;
 return new;
end $$;
create trigger mis_queue_workspace_events after update on mis_private.workspace_documents for each row execute function mis_private.queue_workspace_events();
revoke all on function mis_private.queue_workspace_events() from public,anon,authenticated;
grant execute on function mis_private.queue_workspace_events() to service_role;
revoke all on function public.mis_create_conversation(uuid,text,text,text,text,uuid[],uuid),public.mis_send_message(uuid,uuid,text,uuid[],uuid,timestamptz),public.mis_claim_jobs(integer),public.mis_finish_job(uuid,uuid,text,text),public.mis_deliver_message(uuid,uuid,uuid[]),public.mis_deliver_notification(uuid,uuid,uuid[],text,text,text) from public,anon,authenticated;
grant execute on function public.mis_create_conversation(uuid,text,text,text,text,uuid[],uuid),public.mis_send_message(uuid,uuid,text,uuid[],uuid,timestamptz),public.mis_claim_jobs(integer),public.mis_finish_job(uuid,uuid,text,text),public.mis_deliver_message(uuid,uuid,uuid[]),public.mis_deliver_notification(uuid,uuid,uuid[],text,text,text) to service_role;
