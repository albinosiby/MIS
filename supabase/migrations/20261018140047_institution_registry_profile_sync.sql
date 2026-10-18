-- Platform institution summaries follow the active academic year's actual school profile.
create function mis_private.sync_institution_registry_profile() returns trigger language plpgsql security invoker set search_path='' as $$
declare profile jsonb;
begin
 select y#>'{setup,school}' into profile from jsonb_array_elements(new.document->'years') y where y#>>'{setup,calendar,year,id}'=new.document->>'activeYearId';
 if profile is not null then update public.mis_institution_registry set name=profile->>'name',contact_email=profile->>'email' where school_id=new.school_id;end if;
 return new;
end $$;
revoke all on function mis_private.sync_institution_registry_profile() from public,anon,authenticated;
grant execute on function mis_private.sync_institution_registry_profile() to service_role;
create trigger mis_sync_institution_registry_profile after insert or update on mis_private.workspace_documents for each row execute function mis_private.sync_institution_registry_profile();
