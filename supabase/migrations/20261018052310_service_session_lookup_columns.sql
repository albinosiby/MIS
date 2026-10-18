-- Permit only the two identifiers needed by the service-only revocation check.
grant select(id,user_id) on auth.sessions to service_role;
