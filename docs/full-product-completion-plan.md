# Full school-web completion workstream

Authorized 18 October 2026: implement and test the remaining school-web scope in the approved 17-area checklist. User confirmed India/CBSE and external delivery providers later. Payment gateway remains deferred. Preserve the Figma-derived tokens, feature folders, shared Zod models, existing records and Auth IDs.

## Architecture and acceptance

Use the existing Next.js modular monolith with authenticated server endpoints, schema-parsed feature contracts, framework-independent domain commands and Supabase repositories. Introduce additive, private relational repositories for conversations, jobs/outbox, workflow settings, immutable publications and commercial tenancy. Existing school-document modules are migrated incrementally; never replace a user's workspace with fresh fixture data. Preserve expected-revision checks and add command-specific invariants around compatibility writes.

Milestone 1: shared completion contracts and protection of issued/posted/published records; private participant-scoped conversations and attachments; durable leased/retryable jobs, in-app delivery and scheduled execution without a browser. Test cross-school, cross-guardian and expired-access attacks and duplicate delivery.

Milestone 2: school-owned curriculum/custom forms/localization/approval settings; multi-role membership and school selection; configurable permission restrictions; actual MFA enrollment/challenge UI, and invitation/recovery lifecycle. No new privileged memberships or real emails are created merely to demonstrate UI.

Milestone 3: finish connected admissions, people/HR, attendance/timetable, teaching/exams, offline finance, operations, health/wellbeing/activity and LMS workflows. Published results, certificates, payroll and financial postings retain immutable versions. Apply downstream effects transactionally/idempotently and expose actual outcomes in existing screens.

Milestone 4: generated PDF/Excel artifacts, report builder/schedules, CMS publication and front-office workflows; tenant provisioning, plan/usage/feature controls and group projections. Custom domains, verified signing, SMTP/SMS/WhatsApp/push, hardware, video/LMS and country filing adapters require configured external providers. Report them as disconnected, never successful.

Milestone 5: regression and real connected-database verification, browser role journeys, failure/retry/concurrency checks, local worker execution, CI gates, operational and backup/restore runbooks. Hosting, certified payroll/statutory validation, provider delivery and restore drills require their external environment and are not claimed verified by a local build.

## Product and design

Target users remain the approved school roles, families, platform and school groups. A screen is complete when its permitted action causes the expected persisted business outcome, with errors and recovery. Keep existing tables/forms/shells and add focused screens only where a workflow is absent. No competitor research or product redesign is required.

## Testing and delivery tracking

Every completed area must link implementation and executable validation. Record remaining external configuration and unverified scenarios separately from passing tests. Existing test accounts use @greenfield.test; never change their passwords or reset the school to run tests. Use synthetic records, scope all queries and clean up only artifacts created by the test where retention permits.
