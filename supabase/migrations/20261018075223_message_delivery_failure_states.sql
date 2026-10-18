-- Keep sender-visible delivery states aligned with durable failures/cancellation.
alter table public.mis_messages drop constraint mis_messages_status_check;
alter table public.mis_messages add constraint mis_messages_status_check check(status in ('queued','sent','withdrawn','failed'));
create function mis_private.sync_message_job_state() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.kind='message-delivery' and old.status is distinct from new.status then
  update public.mis_messages set status=case when new.status='cancelled' then 'withdrawn' when new.status='failed' then 'failed' when new.status in ('retry','pending','running') and status='failed' then 'queued' else status end
  where id=(new.payload->>'messageId')::uuid and status<>'sent';
 end if;
 return new;
end $$;
create trigger mis_sync_message_job_state after update of status on public.mis_jobs for each row execute function mis_private.sync_message_job_state();
revoke all on function mis_private.sync_message_job_state() from public,anon,authenticated;
grant execute on function mis_private.sync_message_job_state() to service_role;
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
 select job.school_id,p.user_id,'New private message',left(thread.subject,160),'/communication/inbox?thread='||thread.id::text,'message:'||msg.id::text
 from public.mis_conversation_participants p join public.mis_memberships m on m.user_id=p.user_id and m.school_id=job.school_id and m.active
 where p.conversation_id=thread.id and p.active and p.user_id<>msg.sender_id and p.user_id=any(p_recipients)
 on conflict(school_id,user_id,source_key) do nothing;
 update public.mis_messages set status='sent',sent_at=coalesce(sent_at,now()) where id=msg.id and status in ('queued','failed');
 perform public.mis_finish_job(p_job,p_lease,'completed','In-app message delivered');
end $$;

revoke all on function public.mis_deliver_message(uuid,uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.mis_deliver_message(uuid,uuid,uuid[]) to service_role;
