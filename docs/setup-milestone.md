# Persistent school setup milestone

## Delivered scope

One responsive school admin web workspace, one school and one active academic year. The Figma setup overview and existing design system are retained; all eight phases now have linked, editable forms. Student and staff setup directories share the same saved records. Additional MIS modules remain outside this milestone.

The new step forms extend the retrieved Figma pipeline and existing primitives; no separate step-form frames were supplied in the retrieved setup context. Student/Staff auxiliary directories use the roster/table patterns inspected at nodes `1106:23713` and `1106:27181`. They do not claim to reproduce the full hubs or provide all HR/student workflows.

## Architecture and data flow

Thin Next.js routes → feature components → schema-validated workflow operations → feature workspace context → framework-independent IndexedDB adapter. Transactions commit before UI state changes; revision checks reject stale tabs. Storage/version parsing occurs at the adapter consumer boundary. No API or server database is needed for this browser-local workspace. Future authenticated adapters must enforce school membership and revalidate mutations on the server.

Shared entities compose SchoolProfile, AcademicCalendar, ClassSection, StaffSummary, EnrolledStudent, GuardianContact and GuardianRelationship. Feature contracts add bell slots, fee heads, allocations, portal settings, completed prerequisite steps, reviews, audit entries and simulated notifications. Screen projections derive canonical names/sections from these records. No screen declares another School/Student/Staff interface.

CSV import atomically creates student, guardian and relationship records. Students reference an existing section in the selected school/year. Capacity cannot fall below current enrolment; referenced sections and staff cannot be removed. Dates and bell times cannot overlap; section/subject allocations are unique. Step completion is an ordered prefix, never a collection of independently forged checkboxes. Editing earlier configuration invalidates its successors. Optional simulated portal invitations are recorded once when first prepared and never delivered.

## Runtime walkthrough

1. Open `/school-setup`. The sample school starts with six valid signed-off steps and eight ingestion exceptions.
2. Open any completed card to edit its configuration. Save a changed earlier step to see later steps require fresh sign-off.
3. Use “Start fresh” to clear sign-offs while retaining sample data for a complete step-one walkthrough.
4. In step seven download the CSV template or paste data, preview validation, confirm import, and review each exception with an 8–500-character note.
5. Sign off ingestion, acknowledge workspace mode in step eight, select portals and optionally prepare simulated invitations. Complete setup.
6. Refresh: records, settings, reviews, notifications, audit and 8/8 completion remain saved.
7. Open `/students` or `/staff` to search, paginate and edit the same records. Edits require relevant setup sign-offs again.
8. Export a JSON backup. Restore it through validation and confirmation; reset options also require confirmation.

## Verification evidence

- Domain tests cover seed parsing, all eight steps from fresh, locked-step rejection, forged completion, invalidation, field ownership, new section allocation coverage, time overlaps, foreign-school records, class capacity, money calculations, quoted CSV parsing, atomic import, duplicates and unsafe backups.
- Browser: empty school name rejected; steps one through six saved and navigated; changed bell label persisted after reload and invalidated later steps; one student imported through preview/confirmation; ingestion sign-off rejected while exceptions remained; all eight exception reviews saved; portal completion reached 8/8 and survived refresh.
- Browser: JSON backup downloaded and restored into a separate production origin; restored student appeared in the directory with its guardian. Desktop overview at 1440px had no document overflow and no broken image assets.
- Browser: mobile school-profile form and setup overview at 375px showed no document overflow; displayed images loaded. Student/guardian editing dialogs and directory search were inspected in the production preview. Browser error/warning logs were empty during the checked production interactions. A final refresh of the old development error tab was blocked by the browser URL policy after the dev-server restart; the error-page restriction was not bypassed.
- Final automated checks: 24 domain tests, TypeScript type checking and the Webpack production build passed. The build includes the overview, dynamic step routes, student roster and staff roster. Historical checks for the initial static preview remain in `setup-wizard-verification.md`; this document supersedes that preview's persistence limitations.

## Security, deployment and limitations

Use synthetic data only. Client checks demonstrate rules, not authentication or authorization. No passwords, provider secrets, real payments, messages or government checks are implemented. This browser-local store is inspectable by the browser user. Corrupt storage is reported without automatic replacement; browser storage failures prevent a false successful save. Stale tab writes fail with reload guidance rather than silently overwriting another tab.

The workspace can run through `npm run dev` or a production `npm run build` and `npm start`. No deployment or CI provider has been configured. For future CI run tests, type checking and build; add automated browser tests when a browser runner is selected. Monitoring here consists of visible errors and a bounded local audit trail; it is not centralized monitoring. Recovery uses explicit JSON export/restore, not remote retention guarantees.

Real authentication, multi-school/year switching, attendance, admissions, timetable generation, invoicing/payments, exams, reports, external sync, mobile apps and full student/HR module screens remain later milestones. The full eight-step setup workspace is independently usable without those services.
