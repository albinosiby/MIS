# End-to-end school product expansion

Prepared 18 October 2026. Status: approved by the user on 18 October 2026. The local dummy-data implementation is documented in role-based-workspace.md. Supabase foundation and five-role cloud verification are documented in supabase-connection.md. The remaining production gaps and acceptance gates are tracked in production-readiness-audit.md; the approved plan below describes target scope, not completed production behavior.

## Product analysis

The existing application has 60 workspace routes, eight setup steps, shared runtime schemas, validated domain workflows and browser-local persistence. The approved expansion request is to complete the missing school operations screens and add administrator, teacher, staff, parent and student access. Supabase is the chosen database/authentication direction. Payment screens are in scope now; gateway integration follows later.

Target users: school owner/admin, principal/coordinator, admissions officer, accountant, HR, class/subject teacher, front office, librarian, transport manager/driver, hostel warden, inventory manager, nurse, counsellor, parent/guardian and student. Platform operator and group owner have separate management areas. Multiple roles can belong to one account.

Reuse current admissions, people, attendance, timetable, academics, exams, fees, notices, reports, setup, audit and rollover workflows rather than rebuilding them. Existing routes remain stable. The project research remains the product reference, not an instruction to implement every premium integration or AI proposal.

Success means a complete workflow with validation, persisted records, permitted views, failures and recovery, rather than a collection of menu pages. Relevant product positioning remains straightforward migration, fast daily tasks, consistent school records and useful parent access, as documented in PROJECT_CONTEXT.md; no new competitor/pricing claims are made here.

## Assumptions and scope boundaries

- Initial delivery is one responsive Next.js web application. Parent, student and teacher layouts work on mobile; native store apps are a separate delivery.
- Email/password means Supabase email/password authentication, accepting Gmail or other valid email addresses. It does not mean Google OAuth. Google sign-in is a later optional provider.
- Initial academic examples use the existing Indian school fixtures and currency. Country-specific payroll/tax/statutory formats require a selected rule pack before live use.
- Accounts are invitation-based for staff, parents and students. Public signup cannot grant school roles or child relationships. Platform provisioning creates the first school administrator through an explicit bootstrap process.
- All previously identified missing modules are in this expansion backlog, including operational extensions and website/CMS. Hostel and other modules can be disabled per school without deleting their records.
- Payment provider calls, automated external messages, GPS hardware, biometric devices, accounting sync and board/government connections are adapters to integrate later. Corresponding screens expose provider-unavailable, simulated and connected states distinctly.
- No actual money moves during workspace checkout/refund testing. No stored payment-card data. A workspace success never establishes a live invoice as paid.
- Supabase project access, identity/email setup and database availability are external dependencies. Do not report real login, applied migrations, storage policies or database isolation as working before they have been tested against the intended project.
- Existing IndexedDB records are preserved. They are not automatically uploaded or adopted as authoritative production records.

## Frontend design and screen inventory

Preserve Poppins, the supplied colour/spacing tokens, existing form/table primitives and the desktop admin shell. New authentication pages use a compact branded form layout. Teacher, parent and student areas use task-focused headers, mobile navigation and accessible cards/tables. Do not copy the entire admin menu into every portal. Existing Figma fallback permission continues; exact visual parity for new pages is unverified until frame access is available.

Each applicable screen includes loading, empty, validation, save/pending, error, success, forbidden, not-found and archived/read-only states. Forms compose shared schemas; list filters/pagination use URL state; transient dialogs/selections stay local. Sensitive role-specific projections are returned by the server, not filtered from a complete school dataset in the browser.

### Identity and access

| Route family | Screens and behaviour |
| --- | --- |
| `/login`, `/login/admin`, `/login/teacher`, `/login/staff`, `/login/parent`, `/login/student` | Role-specific entry presentation with the same identity service. The selected entry never grants the selected role. Successful login resolves actual school memberships. |
| `/forgot-password`, `/reset-password`, `/verify-email`, `/auth/confirm` | Recovery request, recovery completion, verification status and validated callback handling. Missing, expired and used links have recovery paths. |
| `/accept-invitation` | Preview intended school/role, authenticate/activate identity, accept only the intended unexpired invitation. No client-editable role grant. |
| `/select-school`, `/select-role` | Show only verified memberships; switch context and clear scoped private client caches. |
| `/account/security`, `/account/sessions` | Password/security settings, MFA enrollment/challenge, active sessions and revocation. |
| `/access-denied`, session-expired state | Safe navigation/re-authentication; preserve only validated same-origin return paths. |
| `/settings/users`, `/settings/invitations` | Account directory/detail, school-role assignments, invite/resend/revoke, deactivate/reactivate. Self-escalation and removal of the final active administrator are rejected. |

### Role-specific portals

| Portal | Screens and connected actions |
| --- | --- |
| `/teacher/*` | Today; assigned classes/student summaries; daily and period attendance; timetable and substitutions; homework create/edit/submissions/feedback; lesson plans; resources; marks entry; behaviour quick log; notices; messages; own leave; own profile/security. Subject and class access follows dated assignments. |
| `/staff-portal/*` | Today; own attendance; leave application/history; documents; profile; payslips; training; notices/messages. Operational staff also get permission-scoped shortcuts to the appropriate admin module. |
| `/parent/*` | Dashboard/child switcher; attendance calendar; timetable; homework and feedback; published results/report cards; invoices, checkout, pending/failed/simulated outcome, receipts/history; notices/read acknowledgment; messages; leave requests; transport; events/consent; PTM; document requests; profile/preferences/help. Links and custody restrictions determine visibility. |
| `/student/*` | Home; own timetable/attendance; homework/submission attachments; published marks; notices/messages; library catalogue/my loans; fee view; requests; activities; own profile. Accounts are school/guardian provisioned, not public child self-signup. |
| `/driver/*` | Assigned trips; start/stop; assigned roster; boarding/alighting; vehicle checklist; incident/SOS report. Live location is unavailable until a GPS/provider path is configured. |

### School administrator and operational extensions

These are planned route families, not a claim that the pages already exist. Reuse existing actions/screens where appropriate and add focused detail pages only where the workflow needs them.

| Area / route family | Complete screens and operations |
| --- | --- |
| People / `/students`, `/guardians`, `/staff` | Extend existing profiles with permitted timeline tabs, document access, guardian invitation status/communication rights, class-placement history and withdrawal/transfer review. Retain existing import, merge, ID and certificate workflows. |
| Finance / `/fees/*` | Existing invoice/collection/concession flows plus fee assignments, dues/defaulters, payment attempts, receipts, refunds/approval, reconciliation, day-book/ledger, payment plans, fee certificates, gateway status and receipt templates. Reversal, refund and gateway payment are separate operations. |
| Exams / `/exams/*` | Grading-scale versions, weights, seating, moderation/review, report-card templates/preview, generate/publish, re-evaluation, transcript/consolidated results and analytics. Published result versions remain historical records. |
| Communication / `/communication/*` | Channel-specific compose, audience preview, reusable templates, schedules, delivery attempts/failures/retry, read statistics, moderated chat inbox, emergency broadcast, PTM slots/bookings, surveys, consent and newsletters/gallery. workspace acknowledgments cannot masquerade as real delivery. |
| HR / `/hr/*` | Departments/designations, leave policies, contracts, payroll configuration/runs/review, payslips, expenses, appraisals, training, vacancies/applicants and hiring decisions. Tax packs and statutory payroll exports remain explicitly unconfigured until validated. |
| Transport / `/transport/*` | Routes/stops/map, vehicles/documents, drivers, student allocation, trip plan/history, boarding log, live-map placeholder/status, alerts, maintenance, fee linkage. Existing route assignments are migrated/reused. |
| Library / `/library/*` | Titles/copies, members, circulation desk, issue/return/renewal, reservations, fines, stocktake/reports and student OPAC. Distinguish a title from a physical copy. |
| Inventory / `/inventory/*` | Items, stock movements, vendors, requisitions, purchase orders/approval, goods receipts, departmental issues/returns, assets, maintenance and stocktake. Stock changes use immutable movements. |
| Hostel / `/hostel/*` | Buildings/rooms/beds, allocation, roll call, outpasses/approval, visitors, mess/menu, incidents and fee linkage. Reject overlapping occupancy. |
| Behaviour / `/wellbeing/*` | Incident list/detail/review, positive/house points, detentions, escalation, restricted counselling/interventions, SEN/IEP and safeguarding case access. Restricted cases use separate data access and audits. |
| Health / `/health/*` | Permitted summary, clinic visits, medication administration, immunisation/check-up records, emergency incidents and consent/access settings. Ordinary teachers receive only explicitly permitted summary fields. |
| Activities / `/activities/*` | Clubs/teams, capacity/enrolment, events/trips, consent, linked charges, participation and achievements. Reuse academic calendar events. |
| Documents / `/documents`, `/certificates/*` | Private upload/review/download, request queue, template/serial register, bulk issue, revoke and limited public verification. Digital signing/DigiLocker remain unconfigured adapters. |
| LMS / `/learning/*` | Resources/study materials, video/live-class links, quizzes, attempts/results and assignment grading. Reuse existing homework rather than duplicating it. External classroom/LTI/SCORM connectors are later integrations. |
| Front office / `/front-office/*` | Visitors/check-in/out, gate passes, phone/enquiry log, appointment diary and links to collection/certificate tasks. |
| Reports / `/reports/*` | Existing catalogue plus saved views, bounded report builder, schedules/run history, role dashboards, data-quality review and selected statutory pack exports. Country formats require explicit acceptance samples. |
| Administration / `/settings/*` | Existing school/year/settings plus users, branding/languages, integrations, webhook/API-key lifecycle, import job review, backup/restore jobs, subscription/usage and module enablement. Never display stored provider secrets. |
| Website / `/website/*` | Pages/navigation, news/events, gallery, admission form placement, draft/preview/publish, domain status and basic SEO/localisation. Published public content is separated from private school records. |

### Group and platform areas

- `/group/*`: authorised schools, consolidated dashboards/finance, common policy masters with per-school overrides, cross-school reports and user administration. Group access is a separate permission; it is not inferred from school-admin status.
- `/platform/*`: school provisioning/detail/status, plans/usage/invoices, module flags, support tickets, service status, message credits and audited time-limited support grants. No silent unrestricted impersonation.
- Public vendor pages: landing/features/pricing, workspace request, signup/provisioning entry, help/status and privacy/terms pages. School CMS is a different product surface.
- Alumni: former-student profile, events and transcript/document requests; donation UI can be provider-unavailable until payments are integrated. Reseller/partner management remains an optional commercial extension rather than an accidental school permission.

## System architecture

Keep Next.js 16 App Router, React, TypeScript, existing tokens and primitives. Add Supabase Auth, PostgreSQL and private Storage. Use a modular monolith within the existing repository: small server data-access modules and domain operations, not an additional backend framework solely for this expansion.

Flow: route -> verified session -> membership/permission lookup -> schema parse -> domain operation -> database transaction + audit/outbox -> minimal permitted projection -> UI. Cookie refresh uses the installed Next.js 16 conventions and current Supabase SSR guidance. Proxy redirects are navigation assistance; every server data access and mutation authorises again.

Production does not expose the current whole-school workspace document to parents/students. Database mode loads scoped relational projections and applies multi-entity mutations in transactions. workspace mode keeps synthetic IndexedDB records, clearly labelled; it is selected explicitly in development and never automatically substituted when live authentication/database calls fail.

One login identity can have multiple school memberships/roles. A school staff/student/guardian record is distinct from an Auth identity and can exist before account activation. One student keeps identity across academic years; enrolment/placement records preserve year/class history. Account email matching alone never creates guardian access.

### Folder changes

```text
src/app/(auth)/                  # identity entry and recovery routes
src/app/(school)/                # existing admin routes retained
src/app/(portals)/               # teacher, staff-portal, parent, student, driver
src/app/(admin)/              # platform and group contexts
src/app/(public)/                # public vendor/CMS/limited verification
src/features/<module>/
  schemas/ models/ domain/ data/ components/
  server/                       # actual server-only queries/mutations when needed
src/shared/schemas/              # exact reusable runtime schema imports
src/shared/models/               # inferred shared contracts
src/shared/auth/                 # permission vocabulary/context contracts
src/lib/supabase/                # browser/server clients and session refresh
supabase/migrations/            # CLI-generated migrations after design approval
tests/                          # domain, access and migration regression cases
```

Do not create empty module trees or duplicate canonical School, Staff, Student, Guardian or AcademicYear shapes. Schema-inferred feature contracts cover requests/responses and document named presentation projections. Client responses remain unknown until parsed. Generate database types after actual schema creation; map database rows to domain contracts explicitly.

## Database design

Use normalised tables with `school_id`, academic-year ownership where meaningful, timestamps, audit actor and concurrency/version fields where edited. School-owned child relationships use composite school-scoped foreign keys. Stable persons/documents/catalogue items do not receive artificial year ownership; their operational enrolments, allocations and transactions carry the appropriate year/date scope.

| Domain | Proposed table families and relationships |
| --- | --- |
| Identity / tenancy | `schools`, `campuses`, `profiles` linked to `auth.users`, `memberships`, `roles`, `permissions`, `role_permissions`, membership-role assignments, `invitations`, authorised person-account links, group/school links |
| Academic foundations | `academic_years`, `terms`, `grades`, `sections`, `subjects`, `class_subjects`, `staff_assignments`, `houses`, grading versions |
| People / admissions | school-scoped students/staff/guardians, guardian links with rights/status, enrolments, dated placements, enquiries/applications, assessments/offers, consent and document links |
| Attendance / scheduling | sessions/entries/change history, leave requests/decisions, timetable entries/publication versions, substitutions, rooms/bookings |
| Academics / exams | syllabus units, lessons/reviews, resources, homework/submissions/feedback, cycles/papers/seating, marks/moderation, report templates/published versions, re-evaluation |
| Finance | structures/versions/assignments, invoices/lines, payments/allocations, receipts, refund requests/refunds, concessions, reconciliation items, balanced journal headers/lines, gateway attempts/events |
| Communication / events | notices/recipients, conversations/membership/messages, deliveries/attempts, PTM slots/bookings, surveys/responses, consent requests/responses, events/participants |
| Operational modules | payroll runs/items, contracts/applicants/training, vehicles/stops/trips/boarding, library titles/copies/loans/fines, stock movements/orders/assets, hostel beds/allocations/outpasses, activity enrolments |
| Restricted records | health records/clinic/medication, wellbeing incidents/case access/notes, permission-scoped attachments and explicit sensitive-access audit |
| Platform / publishing | feature/plan assignments, usage, support grants/tickets, CMS pages/versions/publications, alumni links and request records |
| Infrastructure | private document metadata, import/export jobs, audit events, idempotency records, outbox/jobs/delivery attempts |

Index actual query paths: `(school_id, academic_year_id, class_section_id)`, student admission number unique per school, active account memberships, attendance unique per session/enrolment, loan copy active constraints, trip/student uniqueness, scoped invoice/receipt sequence, payment external event IDs, audit/date, outbox status/available-at. Add overlapping-date/period/bed-allocation constraints or transaction-safe checks appropriate to each resource.

Money remains integer minor units plus currency; posted finance records are immutable and corrected by explicit reversal/refund. Marks retain missing/absent/exempt distinctions. Stored dates and instants have explicit school-timezone semantics. Recurring events, full accounting and payroll policies require dedicated contracts rather than unrestricted JSON fields.

### RLS and storage

- Enable RLS on all exposed school-owned tables, with explicit read/write policies and grants; membership checks apply to both existing rows and replacement ownership.
- Parent queries require an active verified guardian link and permitted field/action. Student queries require an authorised person-account link. Teacher queries require current assignment; finance/health/HR permissions are separate.
- Ordinary users cannot edit their own membership roles, verification status or guardian rights. User-editable Auth metadata never determines permissions.
- Restrict sensitive health/counselling data through separate tables/server projections; do not rely on hiding profile tabs.
- Private storage uses school/record ownership and short-lived authorised downloads. Validate content type/size and quarantine until scan/review where required. No public student-document bucket.
- Normal requests use the caller's verified session and RLS. Administrative Auth operations are server-only, permission-checked and audited. Secret/service-role keys never enter client bundles.

### Migration and existing-data strategy

1. Connect the intended development project and inspect its existing schemas, extensions, migrations and settings before changing it.
2. Create migrations in ordered feature slices using the Supabase CLI workflow. Apply only to the identified project/environment; preserve migration history and run advisors/verification queries.
3. Bootstrap one school/admin through an explicitly controlled operation, not open self-assignment.
4. Map existing string IDs to database keys explicitly during opt-in validated import; retain source IDs/import provenance. Never mass upload browser data on login.
5. Migrate foundations/people first, then operational dependencies. Reconcile totals, counts, relationship consistency and ledger balances before accepting import.
6. Test restore/rollback or forward repair on development/staging before production. Report migrations as prepared versus applied versus verified separately.

## API design

Prefer feature-owned Server Actions for first-party forms and server data access for page projections. Add HTTP endpoints only for public intake, imports/downloads, provider webhooks and independently consumed interfaces. Avoid duplicating every Server Action as REST.

| Contract | Input / output and requirements |
| --- | --- |
| Sign-in | `{email,password,returnTo?}` -> authenticated membership resolution; password handled by Supabase, no application password table/logging. Role parameter is presentation context only. |
| Invite member | `{email,roleIds,personLink?,expectedVersion}` -> `{invitationId,status,expiresAt}`; authorised administrator, bounded roles and intended relationship checks. |
| Save attendance | `{sessionId,expectedVersion,entries:[{enrolmentId,status,note?}]}` -> `{version,savedCount,notificationState}`; assigned teacher/admin and school/year consistency. |
| Parent home | current permitted child -> attendance/homework/published-result/invoice summaries; child ID checked against active rights on each read. |
| Payment simulation | `{invoiceId,amountMinor,idempotencyKey}` -> `{attemptId,mode:"workspace",status}`; no provider reference or live payment mutation inferred. |
| Real checkout later | permitted payer + invoice -> provider checkout attempt; only signed verified events/reconciliation establish success. |
| Document request/download | scoped record/document + purpose -> request status or short-lived authorised access; restricted record checks and audit. |
| Module mutation | schema-parsed feature request + expected version -> persisted permitted projection; transaction, actor, audit and outbox where appropriate. |

Use safe error contracts `{code,message,fieldErrors?,requestId}`. Distinguish unauthenticated, forbidden, not-found, validation, stale/conflicting update, unavailable provider and retryable failure. Mutation retries are idempotent where duplicate effects matter. Validate same-origin redirect targets, upload limits, pagination bounds and allowed sorts/filters. Jobs are durable server work with retries/lease/dead-letter visibility, not browser timers.

## Security and operational risks

Main risks are scope breadth, accidental whole-school data exposure to portals, finance discrepancies, guardian/child mis-linking, stale permissions and unsupported statutory assumptions. Build and test one identity-to-record vertical slice before parallel breadth. Preserve the existing visual system and shared contracts to limit regression risk.

Validate identity/session server-side; authorise every query/mutation and database row. Protect privileged finance/admin actions with the agreed MFA policy. Invite acceptance binds to intended identity and relationship; revoked access is tested immediately. Apply rate limits and generic recovery responses, safe redirects, CSRF/origin protection appropriate to Server Actions and routes, private caching and audit redaction. Use no sensitive records in telemetry.

For restricted wellbeing, medical and custody workflows, confirm actual school policies before real use. Provider terms, payroll rules, document signing and government exports need specific validation; this proposal does not establish legal compliance.

## Development plan and acceptance gates

All rows are part of the requested expansion. Phasing establishes dependencies; a milestone is not called complete merely because routes exist.

| Milestone | Scope | Acceptance gate |
| --- | --- | --- |
| 1. Identity and access | Auth pages, role entry, memberships/invitations, school/role selection, user admin, protected layouts, explicit workspace mode and Supabase adapter boundary | Every persona enters the right context; forged role/child/school IDs fail; expired/revoked invites and sessions have tested outcomes. |
| 2. Relational foundations | Supabase project connection, schema/RLS/storage, bootstrap, people/academic migration and repository adapters | Real read/write persistence; cross-school tests; preserved relationships; migration/import/restore checks. Blocked on project access. |
| 3. Portals and daily work | Teacher, staff, parent and student dashboards/records/attendance/homework/leave/notices; driver entry | Same saved school records appear only for authorised people; teacher -> parent workflow passes. |
| 4. Finance and results | Missing fees/accounting screens, workspace checkout/refund states; grading/templates/moderation/publication | Ledger/receipt correctness; duplicate retry tests; parent sees published results only; gateway absence is explicit. |
| 5. Communication and documents | Chat, PTM, surveys/consent, delivery status, secure files and certificate requests/templates/verification | Audience and attachment permissions checked; retries/expiry/revocation visible; external delivery not falsely reported. |
| 6. Operations | HR/payroll, transport, library, inventory, hostel, health/wellbeing, activities and front office | Each module has a complete create -> review/action -> report/history workflow and scoped portal connections. |
| 7. Extended product | LMS, website/CMS, advanced reports, group/platform controls, alumni/support/billing surfaces | Public/private separation; module gating; group/support grants tested; unavailable integrations labelled. |
| 8. Release readiness | Cross-role regression, responsive/accessibility checks, security tests, staging, observability, migration/restore drill and user guides | Agreed school acceptance workflows pass with no unresolved access or finance defects. |

Use short implementation batches within each milestone: contracts/permissions -> database or workspace adapter -> screens/actions -> cross-role scenario -> regression checks. Detailed dates depend on confirmed school policies, design access, provider onboarding and team capacity. This is a multi-release scope; a reliable calendar estimate follows milestone 1/2 integration measurements, not a screen count alone.

### Verification

- Preserve and extend existing 52 automated tests; run `npm test`, `npm run typecheck` and `npm run build` for contract changes.
- Test database policies using real nonprivileged sessions for at least two schools, two unrelated families, a teacher with limited assignment and a revoked membership. Privileged SQL-only tests do not establish RLS correctness.
- Cover login/recovery/invitation expiry, invalid inputs, last-admin guard, route/record denial, multi-role context, stale updates, attachments and callback replay.
- E2E: school setup -> invite -> enrol -> teacher attendance -> permitted parent view; invoice -> simulated checkout/counter payment -> receipt -> refund/reconciliation; homework -> child submission -> teacher feedback; marks -> approval -> published report; library/transport/hostel flows; year rollover preserving history.
- Run failure/retry tests for outbox/jobs and finance idempotency. Test phone layouts and keyboard flows; save visual evidence. External providers are verified only after connection.

## DevOps and documentation

Keep development/staging/production environments separate. CI runs tests/typecheck/build, relevant migration/RLS integration tests, dependency/secret checks and controlled deploys. Never run schema changes against an inferred project. Deploy the web application and durable workers with environment-specific configuration; public URL/key are separate from server-only credentials.

Monitor request errors/latency, auth failures, denied access spikes, database/queue load, stale jobs, notification failures and finance reconciliation discrepancies with redacted request IDs. Record actor/action/scope for sensitive changes and restricted accesses. Establish database and document backup/restore procedures and test them before launch. Provider credentials use secret storage and documented rotation.

Deliver setup/environment guide, generated database types, migration/import/rollback notes, action/API contracts, permission matrix, module workflows, administrator/teacher/parent guides and operational runbooks. Update the current route catalogue and audit evidence as each milestone is accepted.

## Supabase connection handoff

When the user has created the intended development project:

1. Prefer connecting the Supabase app/MCP with project-scoped access. Supply the intended project URL/reference so it can be positively identified; do not guess among unrelated projects.
2. Put the project URL and publishable key into local environment configuration using the documented setup process. These identify/connect the frontend; they are not migration credentials.
3. Configure Email provider, allowed site/redirect URLs and email delivery for invitations/recovery. Initial examples will document localhost URLs; production domains are configured separately.
4. Use the authenticated connector/CLI or an appropriately scoped management credential for migrations. Do not paste passwords, personal access tokens or service-role secrets into chat. Do not put privileged values in `NEXT_PUBLIC_*`.
5. Inspect project state, prepare reviewed changes, apply development migrations and run policy/transaction verification. Only then enable live database mode.

Official references checked during planning: Supabase [SSR clients](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [email/password authentication](https://supabase.com/docs/guides/auth/passwords), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [MCP connection](https://supabase.com/docs/guides/ai-tools/mcp) and [changelog](https://supabase.com/changelog). Implementation must recheck relevant package/API versions. Installed Next.js authentication guide was also read.

## Approval requested

Approve this screen/role/data design using the existing visual system, invitation-based email/password identity and the milestone sequence above. The human-supplied project instructions require design approval before generating code; the dashboard skill repeats that requirement for substantial expansions. Supabase connection is needed for live integration, but is not required to begin approved UI and contract implementation.
