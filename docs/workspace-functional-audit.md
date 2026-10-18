# School workspace functional audit

17 October 2026. Scope: the connected dummy-data application, including the eight school setup steps, 60 workspace routes, navigation, forms, record actions, exports and recovery. Live authentication, payment gateways, messaging providers and government services remain outside this workspace.

## Method

- Reviewed 275 button/link control bindings in the source: 100 navigation bindings, 162 click handlers, seven child links, five form submissions and one intentionally disabled design-system sample. No unexplained unbound controls remained.
- Used a separate local application origin, port 3001, for record creation, approvals, payment simulation, imports, resets and rollover. The existing port-3000 workspace was exported before testing and was not used for destructive tests.
- Exercised browser workflows against the production build. The individual results and route/control inventory are saved in `workspace-browser-audit.json`.
- Added regression tests for the actual failures and boundary cases. Shared schemas and canonical models remain reused across modules.

## Fixed issues

| Finding | Resolution |
| --- | --- |
| Valid amounts such as ₹1.15 failed integer minor-unit validation | Correct binary floating-point noise while continuing to reject genuinely fractional minor units. |
| A visible date could be submitted as an old/empty value | Serialize displayed form controls on submit, including date/time, numbers, checkbox groups and optional values; revalidate through existing feature schemas. |
| Editing a table record moved it to the last page | Update records in place instead of removing and appending them. |
| Student selections disappeared between the registry and ID cards | Retain scoped, transient UI selection across module navigation, and clear it when replacing/resetting the workspace. |
| Guardian “manage links” navigation only exposed contact editing | Added a composed shared-schema request and working relationship/notice-permission editor. |
| Imported students without demographic profiles were omitted from notice targeting | Treat missing demographic profiles as incomplete active records; continue excluding explicitly inactive students. |
| Setup invitation/notification logs did not reach operational screens | Connect newly prepared setup messages to the shared noticeboard and notification feed without duplicating them on retries. |
| Published notice edits retained old delivery acknowledgments | Return changed notices to draft and clear recipients/acknowledgments for a new publish. |
| Approved lesson edits retained approval | Return changed approved lesson content to draft. |
| Renamed subjects left teaching allocations using the old name | Synchronize the existing allocation projection when a canonical subject is renamed. |
| Approved leave left existing period marks present | Reconcile both daily and period marks as excused. Bulk marking preserves approved leave. |
| Foreign-scope payment retries could return before scope checks | Check invoice/school/year scope before processing idempotent replays. |
| Completed examinations could be republished by a domain call | Require the approval-based unlock path. |
| New exam creation/overview navigation could select the first old cycle | Carry the selected exam ID through creation and marks/overview links. |
| Form defaults used invalid October dates for custom years | Choose defaults inside the selected academic year and align substitution dates to the slot weekday. |
| Room availability used a weekday tab instead of the booking date | Calculate availability using the booking date. Added reservation and substitution cancellation actions. |
| Exam scheduling and facility booking used separate occupancy checks | Share a date/period room ledger across availability, reservations and exam scheduling; reject double bookings. |
| Timetable reset left referenced substitution records | Remove linked allotments atomically with reset slots. |
| Rollover dropped custom bus routes or produced oversized carry-forward references | Retain routes and assignments, and generate bounded new references. |
| Archived setup forms still offered saving | Disable archived form controls while keeping navigation, viewing and exports available. |
| Archived report export attempted to mutate locked history | Generate/download historical reports without writing an export job into the archived year. |
| Invalid person links silently displayed the first person | Show an explicit record-not-found state. |
| Public admission form asked for seeded contact fields twice | Reuse canonical core values and keep additional configured answers separate. |
| Custom admission answers/documents were not visible to staff | Include configured answers and document metadata in the applicant details editor. |
| Optional additional date/select answers could become invalid nulls | Preserve blank strings for additional answer fields; retain nulls for canonical nullable fields. |
| Marks CSV advertised larger batches but reused the 500-student parser limit | Move the generic parser to shared data utilities and give marks imports an explicit 20,000-row bound. Test a valid 505-mark batch. |
| Scheduler normalized impossible calendar dates | Parse scheduler dates through the shared local-date schema. |
| Notification indicator and academic-year context were inconsistent in setup | Use the shared unread count and year selector; retain read-only historical context. |
| Calendar navigation and greeting dates lost academic context | Retain the created event’s month and display a workspace date appropriate to the selected year. |

## Browser scenarios

Coverage includes enquiry progression through assessment, offer and enrolment; linked student/guardian/invoice creation; decimal collection, receipts, reversal, invoice batches, fee reminders and concessions; existing-record edit/save flows; lesson submission/return/approval; grading; staff onboarding and document review; student import and guarded merge; certificates; scoped ID-card selection; guardian permissions; all attendance registers; timetable creation/removal/publication/reset; substitution and room reservation lifecycles; published notice revision and scheduling; report preview/export/schedules; full backup restore; malformed-backup rejection; reset cancellation, fresh start and sample reset; all eight setup saves; year rollover, retained routes and read-only archives; historical exports; and stale-tab conflict/reload recovery.

Repeated table-row controls share the same handlers. Browser scenarios test representative records and state transitions, rather than claiming every possible data combination was exhaustively tested. Print controls use the browser’s Print / Save PDF facility; physical printer output is not part of automated verification. Attachments retain workspace metadata, not uploaded document bytes.

## Final verification

- 52 automated tests passed, including room occupancy, ownership boundaries, persistence contracts and invalid inputs.
- TypeScript checking and the production build passed.
- 94 recorded browser workflow checks passed. All 60 workspace routes and eight setup steps were revisited after the final build.
- The binding audit found 275 controls with zero unexplained unbound controls.

## Repeatable checks

```sh
npm test
npm run typecheck
npm run build
npm run audit:ui
npm run fixture:ui -- /tmp/mis-ui-audit.json
```

Import the generated fixture only into an isolated workspace origin. It contains completed setup, processed approvals/leaves, locked results, reviewed retention directives and a custom bus route for rollover testing. Full backup/reset actions always require confirmation in the application.
