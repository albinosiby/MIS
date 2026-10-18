-- Optional restrictions default to none and cannot expand a fixed role's authority.
create table public.mis_role_restrictions (
 school_id text not null references public.mis_schools(id),
 role text not null check(role in ('admin','principal','teacher','staff','accountant','parent','student','driver','librarian','hr','nurse','counsellor','transport','inventory','warden')),
 blocked text[] not null default '{}' check(blocked <@ array['billing','employment','attendance','teaching','operations','configuration','publications','documents','communication']::text[] and cardinality(blocked)<=9),
 updated_by uuid not null references auth.users(id),updated_at timestamptz not null default now(),primary key(school_id,role)
);
create index mis_role_restrictions_actor_idx on public.mis_role_restrictions(updated_by);
alter table public.mis_role_restrictions enable row level security;
revoke all on public.mis_role_restrictions from public,anon,authenticated;
grant select,insert,update on public.mis_role_restrictions to service_role;
create function mis_private.audit_role_access_change() returns trigger language plpgsql security invoker set search_path='' as $$
declare actor uuid; action text; current_revision bigint;
begin
 if tg_table_name='mis_role_grants' then actor=new.granted_by;action='Additional role '||new.role||' for '||new.user_id::text||' active='||new.active::text;
 else actor=new.updated_by;action='Role restrictions '||new.role||': '||array_to_string(new.blocked,',');end if;
 select revision into current_revision from mis_private.workspace_documents where school_id=new.school_id;
 insert into mis_private.audit_events(school_id,actor_id,action,revision) values(new.school_id,actor,left(action,300),coalesce(current_revision,0));return new;
end $$;
create trigger mis_audit_role_grant after insert or update on public.mis_role_grants for each row execute function mis_private.audit_role_access_change();
create trigger mis_audit_role_restriction after insert or update on public.mis_role_restrictions for each row execute function mis_private.audit_role_access_change();
revoke all on function mis_private.audit_role_access_change() from public,anon,authenticated;
grant execute on function mis_private.audit_role_access_change() to service_role;
