# Full-product workstream: implementation checkpoint

18 October 2026. The requested 17-area scope remains active and is not complete. India/CBSE is confirmed. Payment gateway, external email/SMS/WhatsApp/push, verified signing, hardware, classroom integrations and hosting credentials remain disconnected; no external delivery is simulated.

## Implemented in this workstream

- Participant-scoped private conversations, current relationship/attachment checks, idempotent create/send, quiet hours, moderation, unread notifications and a document picker.
- Durable leased jobs, retry/backoff, expiry recovery, failure/cancellation message states, notice/absence notifications and scheduled report snapshots. Independent `npm run worker` / `worker:once`; continuous local worker is running independently and passed 6/6 runtime checks; production still needs supervised hosting.
- Empty-by-default additional school-role grants, account context selection, verified-factor MFA enrollment/challenge/removal screens and server enforcement, role mutation restrictions, access auditing, and principal restrictions when managing administrator accounts. No extra access was granted to existing users and no factor was enrolled during tests.
- Advanced curricula/document locale/timezone/instructional-day settings, custom fields and record values, configured approval chains and an assigned approval queue. Submitted request details and pending policy assignments are protected.
- School-approved configurable payroll deductions, dated salary plans, daily proration, independent review, finalisation, balanced journals, payslip snapshots and working-day paid/unpaid leave quotas. India statutory rates are not assumed. Employment events stop accrual and effective staff-role access while preserving independent family roles.
- Bounded timetable generation with class/teacher/room/workload/availability constraints, immutable numbered publication snapshots with saved labels, and independently approved/explicitly published substitutions. Draft changes do not replace the current teacher/family publication. Dated cover appears in permitted portal timetables; family views omit private staff absence reasons. Cancellation retains decision history.
- Mark completeness checks, published grade/template selection, immutable report cards, weighted transcripts, publication revocation and private PDF/Excel downloads. Pre-publication moderation blocks issue until independently decided; post-publication corrections update the exact mark, create a new report version and revoke the obsolete result/dependent transcripts. Linked re-evaluation requests receive their decision/history. Detached revocation is rechecked transactionally. Hindi font shaping and spreadsheet formula-like strings are tested.
- Student class movement/transfer/withdrawal, dated class-history context for existing marks/submissions, enrolment timeline entries and inactive-enrolment write guards.
- Double-entry ledger effects for invoice accrual, concessions, collections, reversals/refunds, payroll and operational postings. Server receipt numbering; net-of-refund balances. Received purchases create stock receipts; approved instalment plans create invoices; fines link to billing; explicit capped late-charge assessment and finance ledger statements.
- Numbered bulk certificates from template snapshots; transfer effect and timeline; revocation-aware verification. Digital signing remains disconnected.
- Server-scored exact-answer quizzes, manual teacher review, attempt allowances, response ownership, answer-key redaction and saved self-reported learning progress. External classroom/live-class integrations remain disconnected.
- Typed admission save/progression/enrolment commands, score-before-offer and offer-expiry checks, linked guardian/profile/timeline records and dated application/admission fees. Application-owned private storage and required-ready-file guards are implemented in the app and database; their expanded live check passes 33/33 after the approved server restart. Invitation delivery remains unfinished.
- Admission completion includes verified person-linked private invitation preparation, confirmed continuation/retention/year-end transfer directives consumed by rollover, and dated withdrawal with operational clearance and explicit retained-balance/void-uncollected fee treatment. Historical enrolments do not consume active seats; additional enrolment preserves setup sign-offs. The older lifecycle path now enforces clearance too, and direct profile edits cannot bypass status history. Recipient password/activation acceptance remains a manual check; external invitation email remains deferred.
- Rollover now starts from the actual school, carries masters, net stock, approved configuration, salary policy and opening ledger balances, and blocks open operational requests. It never inserts fixture transactions. New/archived years require a typed server action.
- Fixed 28 form controls that previously used the shared button's non-submit default; added a structural regression guard and browser-verified configuration save and document search.
- Public website projection now removes all private workflow state. Revoked publication snapshots are withheld from client data, while separate metadata preserves the issued register. A database guard serializes revocation and rejects transcripts based on revoked results.
- Added immutable website release creation, explicit selection/restoration/withdrawal, snapshot branding and release-only public CMS projection. Domain tests cover changed drafts, invalid slugs, foreign roles and snapshot rewrites. The saved workspace and website release screen render correctly in the browser after restart. Live publication acceptance remains pending; custom-domain hosting is disconnected.
- Added CI checks and the runtime/recovery runbook. A full disaster-recovery restore has not been performed.

## Operational and reconciliation milestone (18 October)

Library reservation priority/fulfilment, renewal controls, returns, owned fines and legacy invoice linking; residence overlap checks, authenticated guardian outpass response, departure/return/roll-call/checkout; dated route/stop allocations, licensed/insured dispatch, generated passenger rosters and safe completion; complete/partial purchase deliveries, exact cost allocation, departmental stock returns and recorded vendor payouts are connected. Finance has monthly service invoices, bounded CSV bank imports, exact posted-journal matching, audited unmatching/voiding and independently reviewed reconciliation with locked bank periods. Shared models, feature schemas and the existing visual components are reused. One school Bank ledger is supported. See [operational workflow guide](operational-finance-guide.md).

Automated suite now contains **156 passing tests**. New tests include actual cloud command permission classification for finance users, minimal-profile driver/family transport projections, reservation queue order, partial receipt rounding, reconciliation corrections and bank period locks. Reviewed-record comparisons now compare JSON values independently of PostgreSQL JSONB object-key order, including a paid-fine database-round-trip regression. Existing account memberships have not been changed. **126/126 authenticated live checks pass**, covering all five existing sign-ins, reservation/circulation/fine collection and settlement, guardian outpasses and residence checkout/billing, dispatch and boarding, stock/partial receiving, vendor payouts, bank imports/matches/corrections, role denials, and preserved people/memberships. Evidence is in `operational-finance-live-verification.json`. Independent authenticated closure requires a separate finance login; successful closure is covered through the actual cloud-command/domain boundary and is not claimed as a second-login live test.

Browser acceptance also saved and posted `QA Browser verified stock receipt` through the actual form, reloaded, and confirmed its persisted posted status. The bank screen shows the saved match/correction audit and correctly disables self-review closure. Screenshots: `docs/screenshots/operational-stock-persisted.png` and `docs/screenshots/bank-reconciliation-audit.png`. The final independently restarted worker passed 6/6 runtime checks after all operational mutations.

## Verification at this checkpoint

- **156 automated tests pass**, standalone typecheck and production builds pass with the admissions/exams/timetable and operational-finance changes. Regression tests cover active-seat capacity after withdrawal, retained profiles/history, preserved setup sign-offs and continuation/transfer consumption by year rollover.
- **84/84 live lifecycle checks** pass: application/private-file/offer/enrolment, continuation, pre-publication moderation, linked review closure, corrected report versions/PDF access, atomic revocation guard, timetable snapshots, substitution review/publication/cancellation, financial withdrawal and reusing the vacated class seat while retaining historical enrolments. **46/46 additional role-boundary checks** verify all five existing logins, forbidden writes/downloads and unchanged memberships/history.
- **83/83 connected workflow checks**: existing five logins/context isolation, read-only MFA, private conversations and attachment/relationship boundaries, jobs and scheduled snapshots, export permissions, certificate verification/revocation, atomic database dependency guard, preserved people IDs and unchanged staff role.
- **27/27 learning checks** and **33/33 expanded admission lifecycle/private-file checks** pass. The restart resolved the stale permission behavior: required-ready-file checks, application PDF upload/download, unrelated-role denials and successful enrolment are verified. Synthetic verification creates labelled applications; successful enrolment runs create linked student/guardian/invoice/timeline records. No Auth accounts or invitations are created.
- **75/75 private-file checks** pass, covering permitted downloads and denied access, upload validation, version history, revocation and retention. The browser shows the ready application identity PDF and its download/version/revoke actions.
- **24/24 job lease checks**: claim isolation, expiration, retry/cancel and attempt history. **6/6 independent worker runtime checks** verified consumption and audit without a browser or publication/notification side effects.
- UI binding audit: **477 controls, no unresolved bindings**. This is a structural audit, not proof that every screen/business workflow is complete. Browser acceptance saved a synthetic continuation through the actual form, reloaded and confirmed its persisted history, and inspected the saved examination and substitution decision registers. Screenshots are in `docs/screenshots/`.
- Production dependency audit: **zero known vulnerabilities** at the time checked.
- No existing Auth IDs/passwords or role memberships were changed. Test sessions sign out locally. MFA credential enrollment/recovery and positive supplemental role grants were not exercised live.
- Dedicated browser tab 17 is the current test/output tab. The user saved their communication draft before approving restarts; original user tabs were preserved.

## Applied migrations in this workstream

- `20261018072048_conversations_durable_jobs.sql`
- `20261018075223_message_delivery_failure_states.sql`
- `20261018075409_additional_school_role_grants.sql`
- `20261018075956_role_mutation_restrictions_and_access_audit.sql`
- `20261018081911_employment_access_lifecycle.sql`
- `20261018082217_indexed_employment_access_projection.sql`
- `20261018083411_job_lease_attempt_audit.sql`
- `20261018084600_publication_revocation_registry.sql`
- `20261018085223_indexed_publication_verification.sql`
- `20261018092146_publication_dependency_guard.sql`
- `20261018092744_admission_private_documents.sql`
- `20261018105235_result_review_revocation_guard.sql`

Never edit applied migrations; use a new generated migration for corrections.

## Remaining work / verification

The complete requested product is **not finished**. Screen existence and passing scoped tests are not a launch-readiness claim.

| Area | Remaining acceptance work |
| --- | --- |
| Setup | Full custom form composition and application-wide localization; policy SLA reminders and reviewer availability/reassignment. |
| Accounts | Invitation revoke/reissue/delivery, MFA lost-factor recovery, live positive multi-role/school-switch grant tests with specifically authorized accounts. |
| Admissions | Recipient-owned invitation password/activation acceptance and external delivery; school-specific refund/withdrawal policies beyond the explicit retained-balance/void-uncollected choices. Continuation-to-rollover is domain-tested; a live rollover must use an isolated school rather than archiving the working school. |
| HR | Recruitment-to-staff linkage, appraisal outcomes, payroll corrections/payout reconciliation and reviewed India state/statutory packs. |
| Attendance | Optional devices and external absence delivery; monitor escalation operationally. |
| Timetable | Broader workload/constraint optimization and stress acceptance for large schools; automatic version restoration/editor conflicts. Snapshot publication and reviewed dated cover are implemented and tested. |
| Exams | Certified board outputs, additional approved report layouts and institution-specific multi-stage examination review policies. Core moderation/correction/version/download paths are implemented and tested. |
| Finance | Live independent closure using a second finance login, multiple bank subledgers, linked vendor-return/posted-liability correction approval and production bank-feed acceptance. CSV imports, legacy fine links, recorded vendor payouts and bank matching/period locks are implemented. Gateway remains deferred. |
| Communication | External providers remain deferred; finish attachment-picker pagination and remaining moderation/retention policies. |
| Scheduled work | Production worker supervision, operational alerting, approval reminders and additional supported report distribution policies. |
| Transport/library/hostel/inventory | Policy-driven fine automation, vendor returns with linked financial corrections and advanced route optimisation. Connected allocations, guardian outpasses, service invoices, rosters, partial receiving and bounded stock returns are implemented. Hardware/GPS integrations are separate. |
| Health/wellbeing/activities | Complete consent, restricted case escalation/SEN/safeguarding and trip/activity charge lifecycles. |
| Documents | Verified digital signing and remaining certificate templates. |
| Learning | External classroom/live-class integrations and reviewed grading rubric support. Core quiz/progress persistence is verified. |
| Reports | Additional country/board formats, report layout choices and approved distribution recipients. |
| CMS/front office | Live acceptance of saved website releases, tenant public routing, actual hosting/domain connection, visitor/gate/counter operational links. |
| Platform/group | Platform operators, fresh institution provisioning, account activation/management, read-only data inspection and requester-owned support are implemented; see platform-admin-guide.md. Subscriptions/plans/usage/module limits and real group dashboards remain. |
| Release | Actual CI execution in a repository, production worker/monitoring deployment and isolated full database/Auth/Storage recovery drill. |

Cloud mode is the verified target. Offline/browser mode does not yet apply every canonical side effect and cannot perform protected cloud downloads or private conversations. Do not describe the complete offline product as verified.

Next implementation sequence: operational business links → CMS/tenant/group services → production/recovery acceptance, with recipient invitation acceptance when a recipient is available. Keep providers disconnected until their credentials and intended delivery are configured. See `admissions-exams-timetable-guide.md` for the completed workflow paths and their acceptance boundaries.

## Local runtime

The user saved the communication draft and explicitly approved restarting the server on 18 October 2026. The final production build runs at `http://127.0.0.1:3000` with `npm start -- --port 3000`. The independent continuous worker was restarted with the updated models. Old worker processes retain imported schemas and must be restarted after deployment. User tabs were preserved; browser verification uses dedicated test tabs.

The Turbopack development server repeatedly refreshed while the workspace was loading. Restarting with webpack allowed the saved workspace and private-file table to load successfully; `npm run dev` now selects webpack, matching the existing build script. This is a local development workaround, not a confirmed diagnosis of the compiler issue. Browser evidence is saved in `docs/screenshots/admission-private-file-check.png`, showing a ready application-owned identity PDF and its download/version/revoke actions.

## Platform administration milestone (18 October)

Added an independent platform operator boundary, empty institution provisioning, user creation/role/access/reset controls, first-use password activation, app-owned session revocation, read-only year/section record inspection, audited private downloads, support submission/review/history and manual email draft handoff. New schools contain their actual administrator, initial year and no sample students or transactions. Initial production operator creation is an explicit bootstrap command; no existing school account is promoted.

**164 automated tests and 77 isolated authenticated live checks passed**, with typecheck and production build passing. Live acceptance covers two new isolated institutions, registration idempotency, activation, support ownership/internal-note isolation, last-admin protection, document download scope, suspension/reactivation, password reset session blocking and revoked operator denial. Browser acceptance saved a private support note through its form and confirmed persistence after reload; the fresh dashboard renders zero operational records and 0/8 setup steps. Evidence: platform-live-verification.json and docs/screenshots/platform-overview.png. Existing school accounts and roles were not changed. Temporary acceptance fixtures are removed after verification; see the evidence file for cleanup status.

Applied migrations: 20261018133403_platform_institutions_accounts_support.sql, 20261018135005_platform_provisioning_identity_binding.sql, 20261018135935_platform_target_audit.sql and 20261018140047_institution_registry_profile_sync.sql. The final security advisor has no new schema warnings; the existing Supabase leaked-password-protection setting remains disabled. Production bootstrap, verified MFA enrollment and Railway-hosted acceptance require the owner's chosen credentials/configuration. See platform-admin-guide.md.
