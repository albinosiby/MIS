-- Evaluate effective employment for staff roles without disabling a separate family membership.
create function mis_private.employment_role_active(p_school text,p_role text,p_person text) returns boolean
language plpgsql stable security invoker set search_path='' as $$
declare doc jsonb; current_year jsonb; event_kind text; today date; has_future_join boolean;
begin
 if p_role not in ('teacher','staff','accountant','driver','librarian','hr','nurse','counsellor','transport','inventory','warden') or p_person is null then return true;end if;
 select document into doc from mis_private.workspace_documents where school_id=p_school;
 if doc is null then return false;end if;
 select value into current_year from jsonb_array_elements(doc->'years') where value#>>'{setup,calendar,year,id}'=doc->>'activeYearId';
 if not exists(select 1 from jsonb_array_elements(current_year#>'{setup,staff}') s where s->>'id'=p_person) then return false;end if;
 today=(now() at time zone coalesce(current_year#>>'{workflows,advanced,timezone}','Asia/Kolkata'))::date;
 select e->>'kind' into event_kind from jsonb_array_elements(doc->'years') y cross join lateral jsonb_array_elements(coalesce(y#>'{workflows,employmentEvents}','[]'::jsonb)) e
 where e->>'staffId'=p_person and e->>'kind' in ('joined','exited') and (e->>'date')::date<=today order by e->>'date' desc limit 1;
 if event_kind is not null then return event_kind<>'exited';end if;
 select exists(select 1 from jsonb_array_elements(doc->'years') y cross join lateral jsonb_array_elements(coalesce(y#>'{workflows,employmentEvents}','[]'::jsonb)) e where e->>'staffId'=p_person and e->>'kind'='joined') into has_future_join;
 return not has_future_join;
end $$;
revoke all on function mis_private.employment_role_active(text,text,text) from public,anon,authenticated;
grant execute on function mis_private.employment_role_active(text,text,text) to service_role;
create or replace view public.mis_effective_memberships with(security_invoker=true) as
 select 'primary:'||m.user_id::text as membership_id,m.user_id,m.school_id,m.role,m.person_id,m.display_name,(m.active and mis_private.employment_role_active(m.school_id,m.role,m.person_id)) as active,m.created_at from public.mis_memberships m
 union all
 select g.id::text as membership_id,g.user_id,g.school_id,g.role,g.person_id,g.display_name,(g.active and m.active and mis_private.employment_role_active(g.school_id,g.role,g.person_id)) as active,g.created_at from public.mis_role_grants g join public.mis_memberships m on m.user_id=g.user_id
 where not(g.school_id=m.school_id and g.role=m.role);
revoke all on public.mis_effective_memberships from public,anon,authenticated;
grant select on public.mis_effective_memberships to service_role;
