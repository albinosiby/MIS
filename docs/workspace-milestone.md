# Connected school workspace

Implemented on 17 October 2026. This extends the approved persistent dummy-data milestone. No live backend, external messaging, payment processing, identity checks, authentication or enforceable server permissions are included.

## Product and implementation scope

School administrators can complete the eight setup steps and operate admissions, students, staff, attendance, timetables, academics, exams, fees, communication, reports and settings. Calendar, approvals, audit, profile, notifications and year rollover are connected supporting workflows. This is a local workspace for workflow review, not a system for real student data.

The original product analysis and proposed production architecture remain in PROJECT_CONTEXT.md. This milestone implements the browser workspace portion; it does not introduce a database server, API endpoints, deployment, CI or monitoring service.

## Design fidelity

Albino's Figma MCP quota prevented inspection of many frames. The user approved using the pasted screen content and supplied design system, with differences flagged.

- Admissions hub (1106:5246), timetable hub (1106:32046), and settings master console (1106:3211) use retrieved Figma context and locally stored assets. Original setup and previously retrieved student/staff references remain available.
- Dashboard, calendar and academics returned sparse metadata, not sufficient visual specifications.
- Other newly implemented screens follow the pasted content, Poppins, existing tokens, sidebar and component structure. Their exact spacing, component placement, chart shapes, table density and individual modal designs are **not verified against Figma**.
- Supporting workflow pages without supplied frame IDs are explicitly recorded with a null source ID. No frame IDs or visual parity claims were invented.
- 135 downloaded Figma assets are local in `public/assets/workspace`; no temporary Figma asset URLs are required at runtime.

The complete route/source catalogue is `src/features/workspace/data/screen-catalog.ts`: 60 workspace routes, plus school setup overview, eight setup forms and design-system showcase.

## Architecture and data flow

Thin Next.js routes render the existing school shell and lazy feature modules. Feature `schemas`, schema-inferred `models`, `domain`, `data` and `components` follow AGENTS.md. Canonical school, academic year, enrolled student, guardian, staff, subject and attachment contracts are reused rather than screen-specific copies.

`WorkspaceProvider` owns a versioned root with academic-year workspaces. All feature mutations clone the current workspace, apply a domain operation, validate complete relationships, then atomically commit with IndexedDB compare-and-swap revision checking. The UI publishes saved state only after the transaction completes. A second tab cannot silently overwrite a newer revision; reload the saved data when a conflict is reported.

Storage: database `school-mis-workspace`, object store `documents`, document `workspace-v2`. First load migrates validated `setup-v1` data without deleting it. Malformed saved records show a recovery screen and are not silently replaced. Full JSON export/restore includes every module and academic year; legacy setup-only backups can be imported and populated with workspace operations. Restore and reset require a concrete replacement confirmation in the app.

Owned records retain school and academic-year scope. Full validation checks referenced records, unique IDs, class/route capacities, timetable clashes, paper allocations, marks bounds, invoice totals and notice recipients. Browser scope checks are consistency checks, not authorization.

## Connected workflows

| Module | Working workspace behavior |
| --- | --- |
| Dashboard | Live projections, capacity, fee balances, approvals, calendar and audit links |
| Admissions | Enquiry creation and stage progression, counselor/assessment edits, seat projections, offers linked to enrolment, public form/QR, configurable additional fields, intake pause, document metadata requirement and reenrolment intents |
| Students | Four-step enrolment, guardian links and contacts, profiles, CSV import, reviewed promotions, QR ID cards, certificates/TC, route capacity and controlled duplicate merge |
| Staff | Onboarding, profiles, role permission configuration, documentation review and class allocations |
| Attendance | Student/staff daily and period registers, bulk marking, leave requests and decisions; approved leave remains excused |
| Timetable | Class master view, weekly builder, edit/remove/publish, room reservations and substitute assignments with conflict checks |
| Academics | Subjects, syllabus progress, lesson submission/review, homework assignment, simulated submissions, grading and feedback |
| Exams | Exam cycles, manual/automatic paper scheduling, publish, marks entry/atomic CSV import, result locking/unlock approvals and report cards |
| Fees | Repeat-safe invoice batches, balance ledger, idempotent simulated payments, reversals, concessions, reminders and printable workspace receipts |
| Communication | Draft/publish/schedule notices, linked recipients and simulated acknowledgments |
| Reports | 32 data projections, CSV snapshots/downloads, printable previews, persistent schedules and manual local scheduler |
| Settings | Institution preferences, academic configuration, profile, notifications, backups and checked academic-year rollover |

Year rollover requires all eight setup sign-offs, resolved exceptions, processed approvals/leaves, completed exams and promotion/retention directives for active students. It archives the old year read-only, creates a separately scoped year, applies directives, carries outstanding invoice balances, resets operational histories and retains the old ledgers. Prepare missing retention directives on the promotions page, review individually, then perform rollover in settings. Class changes are applied in the new year so the current year's marks/homework history remains consistent.

## Explicit workspace limits

- Role permissions and MFA preferences are configuration records only. There is no authenticated session or server enforcement.
- Public admission URLs work on the same running origin; they are not a deployed public admissions service. Application fee values are configuration, not a charge.
- Uploaded documents retain validated name/type/size/review metadata, not document file bytes. No document download or remote storage is claimed.
- Messaging, receipts, reminders and acknowledgments are explicitly simulated. No emails/SMS/WhatsApp are sent and no money moves.
- Schedulers run when the workspace scheduler button is pressed. There is no unattended background service.
- Duplicate merges with attendance, financial or academic history are intentionally blocked; no conflicting history is silently discarded.
- Grades and certificates are workspace outputs, without board certification or digital signatures.
- Calendar imports support bounded nonrecurring events. Recurrence rules are rejected. External timezone conversion is not implemented; use dates/floating local times.
- Printable outputs use the browser's Print / Save PDF facility. CSV exports include formula-injection escaping.
- Storage is browser-local and bounded for workspace usage. Production needs a server database, object storage, authenticated permissions and server-side validation before handling real records.

## Verification

`npm test`: 35 tests covering setup and new cross-module workflows, invalid/foreign references, duplicate admissions, public form requirements, payment idempotency/overpayment, concession decisions, approved leave, marks maxima/locking, timetable conflicts, notice recipients, report scheduler repeat safety, CSV safety, calendar imports, full backup round trips and rollover/history preservation.

`npm run typecheck` and `npm run build` are required for schema/model changes. Browser checks and exact final outcomes are recorded separately below after completion. No claim of an automated end-to-end test for every action is made.

## Production continuation

The existing domain operations and inferred request schemas are the starting point for a future API boundary. Keep responses unknown until parsed; authenticate each mutation, derive school membership from the server session, enforce permissions and tenancy there, and persist multi-entity changes in database transactions. Introduce migrations, unique indexes on scoped business identifiers, secure object storage, audit ownership, backup recovery drills and a deployment pipeline with health checks before live rollout.

Browser verification: all 60 catalogue routes rendered in the production preview with no captured console errors. The existing 101-student setup migrated, and a newly submitted synthetic enquiry persisted across app restart and full navigation. Desktop screenshot proof is in `docs/screenshots/workspace-persistence.png`. Mobile dashboard rendering was also inspected. These smoke checks confirm page rendering, not exhaustive interaction or pixel comparison of every screen.

Final checks: `npm test` passed 35/35, `npm run typecheck` passed, and the final `npm run build` completed. The marks import dialog was checked with both an invalid row (visible validation message) and a valid synthetic mark; the saved value appeared in the marks registry and report card. Screenshots: `workspace-marks-import.png` and `workspace-dashboard.png`. The production preview is running on port 3000 through `npm start`; use `npm run dev -- --webpack` when resuming development after stopping that process.
