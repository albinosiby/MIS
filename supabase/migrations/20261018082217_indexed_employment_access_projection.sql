-- Indexed private projections keep access checks independent of workspace document size.
create table public.mis_school_runtime (
 school_id text primary key references public.mis_schools(id),timezone text not null default 'Asia/Kolkata'
);
create table public.mis_staff_access_directory (
 school_id text not null references public.mis_schools(id),person_id text not null,current boolean not null,primary key(school_id,person_id)
);
create table public.mis_employment_access_events (
 school_id text not null references public.mis_schools(id),academic_year_id text not null,id text not null,person_id text not null,
 kind text not null check(kind in ('joined','exited','contract-renewed')),effective_on date not null,actor_id text not null,
 primary key(school_id,academic_year_id,id)
);
create index mis_employment_access_person_date_idx on public.mis_employment_access_events(school_id,person_id,effective_on desc);
alter table public.mis_school_runtime enable row level security;
alter table public.mis_staff_access_directory enable row level security;
alter table public.mis_employment_access_events enable row level security;
revoke all on public.mis_school_runtime,public.mis_staff_access_directory,public.mis_employment_access_events from public,anon,authenticated;
grant select,insert,update on public.mis_school_runtime,public.mis_staff_access_directory,public.mis_employment_access_events to service_role;
create function mis_private.refresh_employment_access(p_school text,p_doc jsonb) returns void
language plpgsql security invoker set search_path='' as $$
declare current_year jsonb; year_doc jsonb; person jsonb; event jsonb;
begin
 select value into current_year from jsonb_array_elements(p_doc->'years') where value#>>'{setup,calendar,year,id}'=p_doc->>'activeYearId';
 insert into public.mis_school_runtime(school_id,timezone) values(p_school,coalesce(current_year#>>'{workflows,advanced,timezone}','Asia/Kolkata')) on conflict(school_id) do update set timezone=excluded.timezone;
 update public.mis_staff_access_directory set current=false where school_id=p_school and current;
 for person in select value from jsonb_array_elements(current_year#>'{setup,staff}') loop
  insert into public.mis_staff_access_directory(school_id,person_id,current) values(p_school,person->>'id',true) on conflict(school_id,person_id) do update set current=true;
 end loop;
 for year_doc in select value from jsonb_array_elements(p_doc->'years') loop
  for event in select value from jsonb_array_elements(coalesce(year_doc#>'{workflows,employmentEvents}','[]'::jsonb)) loop
   insert into public.mis_employment_access_events(school_id,academic_year_id,id,person_id,kind,effective_on,actor_id)
   values(p_school,year_doc#>>'{setup,calendar,year,id}',event->>'id',event->>'staffId',event->>'kind',(event->>'date')::date,event->>'actorId') on conflict(school_id,academic_year_id,id) do nothing;
  end loop;
 end loop;
end $$;
create function mis_private.sync_employment_access() returns trigger language plpgsql security invoker set search_path='' as $$
begin perform mis_private.refresh_employment_access(new.school_id,new.document);return new;end $$;
create trigger mis_sync_employment_access after insert or update on mis_private.workspace_documents for each row execute function mis_private.sync_employment_access();
revoke all on function mis_private.refresh_employment_access(text,jsonb),mis_private.sync_employment_access() from public,anon,authenticated;
grant execute on function mis_private.refresh_employment_access(text,jsonb),mis_private.sync_employment_access() to service_role;
do $$ declare row record;begin for row in select school_id,document from mis_private.workspace_documents loop perform mis_private.refresh_employment_access(row.school_id,row.document);end loop;end $$;
create or replace function mis_private.employment_role_active(p_school text,p_role text,p_person text) returns boolean
language plpgsql stable security invoker set search_path='' as $$
declare event_kind text;today date;
begin
 if p_role not in ('teacher','staff','accountant','driver','librarian','hr','nurse','counsellor','transport','inventory','warden') or p_person is null then return true;end if;
 if not exists(select 1 from public.mis_staff_access_directory where school_id=p_school and person_id=p_person and current) then return false;end if;
 select (now() at time zone timezone)::date into today from public.mis_school_runtime where school_id=p_school;
 select kind into event_kind from public.mis_employment_access_events where school_id=p_school and person_id=p_person and kind in ('joined','exited') and effective_on<=today order by effective_on desc,id desc limit 1;
 if event_kind is not null then return event_kind<>'exited';end if;
 return not exists(select 1 from public.mis_employment_access_events where school_id=p_school and person_id=p_person and kind='joined');
end $$;
revoke all on function mis_private.employment_role_active(text,text,text) from public,anon,authenticated;
grant execute on function mis_private.employment_role_active(text,text,text) to service_role;
