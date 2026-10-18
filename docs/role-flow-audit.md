# Five-role functional audit

Audited 18 October 2026 using synthetic records in a separate browser origin, `http://127.0.0.1:3003`. The user's main workspace at port 3000 was preserved. This extends the earlier route and workflow evidence in `role-workspace-browser-audit.json`.

## Changes

- Failed sign-in keeps the entered account and password for correction. Switching the role entry remounts the form with that role's example account. Credentials still determine the role; the entry page does not grant access. The password input has an explicit accessible label.
- Native date/time input events now update the shared editor before another field can rerender it. Leave and operational records retain the dates actually selected, including when the reason/description is edited afterwards.
- Changing the teacher attendance date clears the previous date's unsaved marks. Date controls show academic-year bounds, and register lookup distinguishes student records from staff records. Existing workspace validation continues to reject dates outside the year and preserve approved leave.
- Staff can prepare and submit their own expense/training records. They cannot approve, complete, cancel after submission, or alter claims awaiting review. The same domain policy controls the displayed buttons and rejects invalid mutations.
- Family request controls follow the permitted workflow: no unsupported cancel/self-approval buttons, no editing school-reviewed requests, and no editing records authored by another account.
- Pending homework cannot be graded through the domain operation. Teacher work creation now validates school/year, the teacher identity, and both class and subject allocation. New lessons start as drafts; only owned draft/returned lessons can be submitted. These operations live in the portal domain instead of component callbacks.
- Collection projections reject a different school even for records without a student link. Staff portal summary cards no longer aggregate all student records. Student portal introductory text addresses the student directly.

## Verification

Final results: 73 automated tests passed; `npm run typecheck`, `npm run build` and `npm run audit:ui` passed. Browser checks passed for all 28 named scenarios, 60 admin routes and 48 portal navigation routes. The 354-control source inventory has zero unexplained unbound controls and one deliberately disabled design-system sample.

The automated suite covers invalid and boundary inputs, relationships, role entry/access, one-use recovery, account revocation, cross-role submissions, classroom attendance, school/year isolation, staff review boundaries, teacher work creation and existing operational workflows. See `tests/role-portals.test.ts` and the remaining tests under `tests/`.

Browser scenarios cover invalid login/retry, protected deep links, portal navigation, selected-date persistence, teacher-created homework through student submission and teacher feedback, staff claim submission through school approval, parent document requests through issue, and parent/teacher leave through school review and excused attendance. Exact results and rendered routes are recorded in `five-role-browser-audit.json` after the final build.

The control-binding audit complements browser scenarios; a bound handler alone is not proof of correct behaviour. Navigation checks are route smoke checks, not an exhaustive interaction test of every record combination. Printing, real provider delivery, real payments, live Supabase authentication/database policies and exact Figma parity remain outside this local workspace verification. Password completion is verified in isolated identity adapter tests rather than automated browser credential changes.

## Run

Node 24; `npm test`, `npm run typecheck`, `npm run build`, `npm start`. The current project already has a local workspace session secret configured. Do not expose it. Open `/login`; seeded workspace account emails and the initial password are documented in `role-based-workspace.md`. No new package or data reset is required.
