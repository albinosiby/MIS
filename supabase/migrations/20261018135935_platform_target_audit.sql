-- Retain exact account/ticket target identifiers without logging credentials or content.
create or replace function public.mis_platform_command(p_actor uuid,p_action text,p_input jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
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
  -- Auth identity/request binding is verified through the Auth Admin API before this service-only call.
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
  insert into public.mis_revoked_sessions(session_id,user_id) select id,user_id from auth.sessions where user_id=uid on conflict(session_id) do nothing;
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
 insert into public.mis_platform_audit_events(actor_id,school_id,action) values(p_actor,sid,left(p_action||case when uid is not null then ' user='||uid::text else '' end||case when row_ticket.id is not null then ' ticket='||row_ticket.id::text else '' end,500));
 return result;
end; $$;
