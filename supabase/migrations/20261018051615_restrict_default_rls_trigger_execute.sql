-- Keep the platform's RLS-enabling event trigger; it is not an application RPC.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
