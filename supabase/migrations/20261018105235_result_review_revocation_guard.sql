-- Revocation and workspace commits already serialize on the school document row.
-- Recheck detached revocations for newly requested/accepted result reviews in
-- that transaction, so a concurrent revocation cannot approve stale marks.
create function mis_private.guard_result_review_sources() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if exists (
  select 1 from jsonb_array_elements(new.document->'years') year_doc
  cross join lateral jsonb_array_elements(coalesce(year_doc#>'{workflows,resultReviews}','[]'::jsonb)) review
  join public.mis_publication_revocations revoked
   on revoked.school_id=new.school_id
   and revoked.academic_year_id=year_doc#>>'{setup,calendar,year,id}'
   and revoked.publication_id=review->>'publicationId'
  where review->>'status' in ('submitted','approved') and not exists (
   select 1 from jsonb_array_elements(coalesce(old.document->'years','[]'::jsonb)) old_year
   cross join lateral jsonb_array_elements(coalesce(old_year#>'{workflows,resultReviews}','[]'::jsonb)) saved
   where old_year#>>'{setup,calendar,year,id}'=year_doc#>>'{setup,calendar,year,id}'
    and saved->>'id'=review->>'id' and saved->>'status'=review->>'status'
  )
 ) then raise exception 'Result review source was revoked' using errcode='PT403';end if;
 return new;
end $$;
create trigger mis_guard_result_review_sources before insert or update on mis_private.workspace_documents
for each row execute function mis_private.guard_result_review_sources();
revoke all on function mis_private.guard_result_review_sources() from public,anon,authenticated;
grant execute on function mis_private.guard_result_review_sources() to service_role;
