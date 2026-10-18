-- Do not inherit broad default table grants; RLS and privileges both enforce read-only membership access.
revoke all on public.mis_memberships from public, anon, authenticated;
grant select on public.mis_memberships to authenticated;
grant all on public.mis_memberships to service_role;
