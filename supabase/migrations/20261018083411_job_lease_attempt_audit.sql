-- An attempt is keyed by its lease, including across manual retry cycles.
alter table public.mis_job_attempts add column lease_token uuid;
create unique index mis_job_attempts_lease_idx on public.mis_job_attempts(job_id,lease_token) where lease_token is not null;
create or replace function public.mis_claim_jobs(p_limit integer default 1) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result jsonb;expired public.mis_jobs;
begin
 if p_limit not between 1 and 10 then raise exception 'Invalid claim size';end if;
 for expired in select * from public.mis_jobs where status='running' and lease_until<=now() order by lease_until for update skip locked limit 100 loop
  insert into public.mis_job_attempts(job_id,attempt,outcome,detail,lease_token) values(expired.id,expired.attempts,case when expired.attempts>=expired.max_attempts then 'failed' else 'retry' end,'Worker lease expired',expired.lease_token);
  update public.mis_jobs set status=case when attempts>=max_attempts then 'failed' else 'retry' end,last_error='Worker lease expired',lease_token=null,lease_until=null,run_at=case when attempts<max_attempts then now() else run_at end where id=expired.id;
 end loop;
 with picked as (
  select id from public.mis_jobs where run_at<=now() and attempts<max_attempts and status in ('pending','retry') order by run_at,id for update skip locked limit p_limit
 ),claimed as (
  update public.mis_jobs j set status='running',attempts=attempts+1,lease_token=gen_random_uuid(),lease_until=now()+interval '5 minutes' from picked p where j.id=p.id returning j.*
 ) select coalesce(jsonb_agg(to_jsonb(c)),'[]') into result from claimed c;
 return result;
end $$;
create or replace function public.mis_finish_job(p_id uuid,p_lease uuid,p_outcome text,p_detail text default '') returns void
language plpgsql security invoker set search_path='' as $$
declare job public.mis_jobs; next_status text;
begin
 select * into job from public.mis_jobs where id=p_id for update;
 if job.status<>'running' or job.lease_token is distinct from p_lease or job.lease_until<=now() then raise exception 'Lease expired' using errcode='PT409'; end if;
 if p_outcome not in ('completed','retry','cancelled','blocked') then raise exception 'Invalid job outcome'; end if;
 next_status=case when p_outcome='retry' and job.attempts>=job.max_attempts then 'failed' else p_outcome end;
 insert into public.mis_job_attempts(job_id,attempt,outcome,detail,lease_token) values(p_id,job.attempts,next_status,left(p_detail,500),job.lease_token);
 update public.mis_jobs set status=next_status,last_error=case when next_status='completed' then null else left(p_detail,500) end,
  run_at=case when next_status='retry' then now()+make_interval(secs=>least(3600,15*power(2,job.attempts-1))::integer) else run_at end,
  completed_at=case when next_status='completed' then now() else null end,lease_token=null,lease_until=null where id=p_id;
end $$;

revoke all on function public.mis_claim_jobs(integer),public.mis_finish_job(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.mis_claim_jobs(integer),public.mis_finish_job(uuid,uuid,text,text) to service_role;

-- Manual controls and their actor audit commit atomically.
create function public.mis_control_job(p_actor uuid,p_school text,p_id uuid,p_action text) returns void
language plpgsql security invoker set search_path='' as $$
declare job public.mis_jobs;current_revision bigint;
begin
 if not exists(select 1 from public.mis_effective_memberships where user_id=p_actor and school_id=p_school and active and role in ('admin','principal')) then raise exception 'Administrator required' using errcode='PT403';end if;
 select * into job from public.mis_jobs where id=p_id and school_id=p_school for update;
 if job.id is null or job.status in ('running','completed') then raise exception 'Job cannot be controlled' using errcode='PT409';end if;
 if p_action='retry' and job.status in ('failed','blocked','retry') then
  update public.mis_jobs set status='retry',attempts=0,run_at=now(),last_error=null,completed_at=null,lease_token=null,lease_until=null where id=p_id;
 elsif p_action='cancel' and job.status='cancelled' then return;
 elsif p_action='cancel' then update public.mis_jobs set status='cancelled',lease_token=null,lease_until=null where id=p_id;
 else raise exception 'Invalid job control' using errcode='PT403';end if;
 select revision into current_revision from mis_private.workspace_documents where school_id=p_school;
 insert into mis_private.audit_events(school_id,actor_id,action,revision) values(p_school,p_actor,'Job '||p_action||': '||p_id::text,coalesce(current_revision,0));
end $$;
revoke all on function public.mis_control_job(uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.mis_control_job(uuid,text,uuid,text) to service_role;
