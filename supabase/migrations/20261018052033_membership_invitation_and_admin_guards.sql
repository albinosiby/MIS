alter table public.mis_memberships add column invitation_pending boolean not null default false;
create function mis_private.guard_final_admin() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(old.school_id,0));
  if old.active and old.role='admin' and
    (tg_op='DELETE' or not new.active or new.role<>'admin' or new.school_id<>old.school_id) and
    not exists(select 1 from public.mis_memberships where school_id=old.school_id and role='admin' and active and user_id<>old.user_id) then
    raise exception 'The final active school administrator cannot be removed' using errcode='23514';
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end;
$$;
revoke all on function mis_private.guard_final_admin() from public,anon,authenticated;
grant execute on function mis_private.guard_final_admin() to service_role;
create trigger mis_guard_final_admin before update or delete on public.mis_memberships for each row execute function mis_private.guard_final_admin();
create function public.mis_session_active(p_user_id uuid,p_session_id uuid) returns boolean
language sql security invoker set search_path='' as $$
 select exists(select 1 from auth.sessions where id=p_session_id and user_id=p_user_id);
$$;
revoke all on function public.mis_session_active(uuid,uuid) from public,anon,authenticated;
grant execute on function public.mis_session_active(uuid,uuid) to service_role;
