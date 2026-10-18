-- Global operators are deliberately separate from school memberships.
create table public.mis_platform_operators (
 user_id uuid primary key references auth.users(id), display_name text not null check(length(display_name) between 1 and 160), active boolean not null default true, created_at timestamptz not null default now()
);
create table public.mis_institution_registry (
 school_id text primary key references public.mis_schools(id), name text not null check(length(name) between 1 and 160), institution_type text not null check(institution_type in ('school','college')), status text not null default 'active' check(status in ('active','suspended')), contact_email text not null check(length(contact_email) between 3 and 254), created_at timestamptz not null default now()
);
insert into public.mis_institution_registry(school_id,name,institution_type,contact_email)
select id,name,'school',coalesce((select w.document#>>'{years,0,setup,school,email}' from mis_private.workspace_documents w where w.school_id=s.id),'contact@school.invalid') from public.mis_schools s;
create table public.mis_platform_requests (
 id uuid primary key, actor_id uuid not null references auth.users(id), kind text not null check(kind in ('institution','account')), payload jsonb not null, school_id text not null, status text not null default 'pending' check(status in ('pending','complete')), user_id uuid references auth.users(id), created_at timestamptz not null default now()
);
create table public.mis_account_activation (user_id uuid primary key references auth.users(id), must_change_password boolean not null default true, updated_at timestamptz not null default now());
create table public.mis_support_tickets (
 id uuid primary key, school_id text not null references public.mis_schools(id), requester_id uuid not null references auth.users(id), requester_name text not null, reply_email text not null check(length(reply_email) between 3 and 254), subject text not null check(length(subject) between 3 and 160), description text not null check(length(description) between 10 and 4000), category text not null check(category in ('technical','account','data','other')), status text not null default 'open' check(status in ('open','in-progress','resolved','closed')), version integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.mis_support_events (
 id uuid primary key default gen_random_uuid(), ticket_id uuid not null references public.mis_support_tickets(id), actor_id uuid not null references auth.users(id), kind text not null check(kind in ('created','status','internal-note','manual-contact')), note text not null check(length(note)<=2000), created_at timestamptz not null default now()
);
create table public.mis_platform_audit_events (
 id bigint generated always as identity primary key, actor_id uuid not null references auth.users(id), school_id text references public.mis_schools(id), action text not null check(length(action) between 1 and 500), created_at timestamptz not null default now()
);
create index mis_registry_status_date_idx on public.mis_institution_registry(status,created_at desc);
create index mis_platform_requests_actor_idx on public.mis_platform_requests(actor_id);
create index mis_platform_requests_user_idx on public.mis_platform_requests(user_id);
create index mis_support_school_date_idx on public.mis_support_tickets(school_id,created_at desc);
create index mis_support_requester_date_idx on public.mis_support_tickets(requester_id,created_at desc);
create index mis_support_status_date_idx on public.mis_support_tickets(status,created_at desc);
create index mis_support_events_ticket_idx on public.mis_support_events(ticket_id,created_at);
create index mis_support_events_actor_idx on public.mis_support_events(actor_id);
create index mis_platform_audit_school_idx on public.mis_platform_audit_events(school_id,created_at desc);
create index mis_platform_audit_actor_idx on public.mis_platform_audit_events(actor_id);
alter table public.mis_platform_operators enable row level security;
alter table public.mis_institution_registry enable row level security;
alter table public.mis_platform_requests enable row level security;
alter table public.mis_account_activation enable row level security;
alter table public.mis_support_tickets enable row level security;
alter table public.mis_support_events enable row level security;
alter table public.mis_platform_audit_events enable row level security;
revoke all on public.mis_platform_operators,public.mis_institution_registry,public.mis_platform_requests,public.mis_account_activation,public.mis_support_tickets,public.mis_support_events,public.mis_platform_audit_events from public,anon,authenticated;
grant all on public.mis_platform_operators,public.mis_institution_registry,public.mis_platform_requests,public.mis_account_activation,public.mis_support_tickets,public.mis_support_events,public.mis_platform_audit_events to service_role;
grant usage,select on sequence public.mis_platform_audit_events_id_seq to service_role;

create function public.mis_platform_command(p_actor uuid,p_action text,p_input jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare req public.mis_platform_requests; sid text; uid uuid; row_ticket public.mis_support_tickets; prev_status text; result jsonb; desired text;
begin
 if not exists(select 1 from public.mis_platform_operators where user_id=p_actor and active) then raise exception 'Platform administrator required' using errcode='PT403'; end if;
 if p_action='reserve' then
  insert into public.mis_platform_requests(id,actor_id,kind,payload,school_id) values((p_input->>'requestId')::uuid,p_actor,p_input->>'kind',p_input->'payload',p_input->>'schoolId') on conflict(id) do nothing;
  select * into strict req from public.mis_platform_requests where id=(p_input->>'requestId')::uuid for update;
  if req.actor_id<>p_actor or req.kind<>p_input->>'kind' or req.payload<>p_input->'payload' or req.school_id<>p_input->>'schoolId' then raise exception 'Request already used for different data' using errcode='PT409'; end if;
  return to_jsonb(req);
 elsif p_action='provision' then
  select * into strict req from public.mis_platform_requests where id=(p_input->>'requestId')::uuid for update;
  if req.actor_id<>p_actor then raise exception 'Request unavailable' using errcode='PT403'; end if;
  if req.status='complete' then return to_jsonb(req); end if;
  sid=req.school_id; uid=(p_input->>'userId')::uuid;
  if not exists(select 1 from auth.users where id=uid and raw_app_meta_data->>'platform_request'=req.id::text) then raise exception 'Account request mismatch'; end if;
  if req.kind='institution' then
   if p_input#>>'{document,years,0,setup,school,id}'<>sid or p_input#>>'{document,revision}'<>'0' then raise exception 'Workspace scope mismatch'; end if;
   insert into public.mis_schools(id,name) values(sid,req.payload#>>'{school,name}');
   insert into public.mis_institution_registry(school_id,name,institution_type,contact_email) values(sid,req.payload#>>'{school,name}',req.payload->>'institutionType',req.payload#>>'{school,email}');
   insert into mis_private.workspace_documents(school_id,revision,document) values(sid,0,p_input->'document');
   insert into public.mis_memberships(user_id,school_id,role,display_name,active) values(uid,sid,'admin',req.payload->>'administratorName',true);
   perform public.mis_commit_workspace(sid,0,jsonb_set(p_input->'document','{revision}','1'::jsonb),uid,'Initialise new institution');
  else
   if not exists(select 1 from public.mis_institution_registry where school_id=sid and status='active') then raise exception 'Institution unavailable'; end if;
   if req.payload->>'role' in ('platform','group') then raise exception 'Invalid school role'; end if;
   if req.payload->>'personId' is not null and not exists(select 1 from public.mis_people where school_id=sid and id=req.payload->>'personId' and kind=case when req.payload->>'role'='parent' then 'guardian' when req.payload->>'role'='student' then 'student' else 'staff' end) then raise exception 'Person outside institution'; end if;
   insert into public.mis_memberships(user_id,school_id,role,display_name,person_id,active) values(uid,sid,req.payload->>'role',req.payload->>'name',req.payload->>'personId',true);
  end if;
  insert into public.mis_account_activation(user_id) values(uid);
  update public.mis_platform_requests set status='complete',user_id=uid where id=req.id returning to_jsonb(mis_platform_requests.*) into result;
 elsif p_action='institution-status' then
  sid=p_input->>'schoolId';
  update public.mis_institution_registry set status=p_input->>'status' where school_id=sid returning to_jsonb(mis_institution_registry.*) into result;
  if result is null then raise exception 'Institution unavailable'; end if;
 elsif p_action='account-update' then
  sid=p_input->>'schoolId'; uid=(p_input->>'userId')::uuid;
  if uid=p_actor then raise exception 'Cannot change own access'; end if;
  -- Serialize administrator changes to preserve at least one active school administrator.
  perform 1 from public.mis_schools where id=sid for update;
  if not exists(select 1 from public.mis_memberships where user_id=uid and school_id=sid and role not in ('platform','group')) then raise exception 'Account unavailable'; end if;
  if p_input->>'role' in ('platform','group') then raise exception 'Invalid role'; end if;
  if exists(select 1 from public.mis_memberships where user_id=uid and role='admin' and active) and (p_input->>'role'<>'admin' or not (p_input->>'active')::boolean) and not exists(select 1 from public.mis_memberships where school_id=sid and user_id<>uid and role='admin' and active) then raise exception 'Keep one active administrator'; end if;
  if exists(select 1 from public.mis_memberships where user_id=uid and role<>p_input->>'role' and person_id is not null) then raise exception 'Unlink person before changing role'; end if;
  update public.mis_memberships set role=p_input->>'role',active=(p_input->>'active')::boolean where user_id=uid and school_id=sid returning to_jsonb(mis_memberships.*) into result;
 elsif p_action='account-reset' then
  sid=p_input->>'schoolId'; uid=(p_input->>'userId')::uuid;
  if uid=p_actor or not exists(select 1 from public.mis_memberships where user_id=uid and school_id=sid and role not in ('platform','group')) or exists(select 1 from public.mis_platform_operators where user_id=uid) then raise exception 'Account unavailable'; end if;
  insert into public.mis_account_activation(user_id) values(uid) on conflict(user_id) do update set must_change_password=true,updated_at=now();
  delete from auth.sessions where user_id=uid;
  result=jsonb_build_object('userId',uid);
 elsif p_action='ticket-update' then
  select * into strict row_ticket from public.mis_support_tickets where id=(p_input->>'ticketId')::uuid for update;
  sid=row_ticket.school_id; prev_status=row_ticket.status; desired=p_input->>'status';
  if row_ticket.version<>(p_input->>'expectedVersion')::integer then raise exception 'Ticket changed. Refresh and retry.' using errcode='PT409'; end if;
  if not ((prev_status='open' and desired in ('open','in-progress','resolved')) or (prev_status='in-progress' and desired in ('in-progress','open','resolved')) or (prev_status='resolved' and desired in ('resolved','open','closed')) or (prev_status='closed' and desired in ('closed','open'))) then raise exception 'Invalid support transition'; end if;
  if p_input->>'kind' in ('internal-note','manual-contact') and (length(trim(p_input->>'note'))<3 or desired<>prev_status) then raise exception 'Notes require text and cannot change status'; end if;
  update public.mis_support_tickets set status=desired,version=version+1,updated_at=now() where id=row_ticket.id returning to_jsonb(mis_support_tickets.*) into result;
  insert into public.mis_support_events(ticket_id,actor_id,kind,note) values(row_ticket.id,p_actor,p_input->>'kind',case when p_input->>'kind'='status' then prev_status||' → '||desired||' '||coalesce(p_input->>'note','') else p_input->>'note' end);
 else raise exception 'Unknown platform command'; end if;
 insert into public.mis_platform_audit_events(actor_id,school_id,action) values(p_actor,sid,left(p_action,500));
 return result;
end; $$;
revoke all on function public.mis_platform_command(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.mis_platform_command(uuid,text,jsonb) to service_role;

create function public.mis_support_create(p_actor uuid,p_school text,p_input jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare existing public.mis_support_tickets; actor_name text;
begin
 select display_name into actor_name from public.mis_effective_memberships where user_id=p_actor and school_id=p_school and active and role not in ('platform','group') limit 1;
 if actor_name is null or not exists(select 1 from public.mis_institution_registry where school_id=p_school and status='active') then raise exception 'School access denied' using errcode='PT403'; end if;
 select * into existing from public.mis_support_tickets where id=(p_input->>'requestId')::uuid;
 if found then
  if existing.requester_id<>p_actor or existing.school_id<>p_school or existing.subject<>p_input->>'subject' or existing.description<>p_input->>'description' or existing.reply_email<>p_input->>'replyEmail' or existing.category<>p_input->>'category' then raise exception 'Request changed' using errcode='PT409'; end if;
  return to_jsonb(existing);
 end if;
 if (select count(*) from public.mis_support_tickets where requester_id=p_actor and created_at>now()-interval '1 hour')>=20 then raise exception 'Please wait before submitting more requests'; end if;
 insert into public.mis_support_tickets(id,school_id,requester_id,requester_name,reply_email,subject,description,category) values((p_input->>'requestId')::uuid,p_school,p_actor,actor_name,p_input->>'replyEmail',p_input->>'subject',p_input->>'description',p_input->>'category') returning * into existing;
 insert into public.mis_support_events(ticket_id,actor_id,kind,note) values(existing.id,p_actor,'created','Support request submitted');
 return to_jsonb(existing);
end; $$;
revoke all on function public.mis_support_create(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.mis_support_create(uuid,text,jsonb) to service_role;
