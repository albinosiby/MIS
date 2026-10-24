# Figma school admin screen reconciliation proposal

Status: first-row implementation approved by the user; Dashboard design-system implementation completed. Exact Figma comparison remains blocked by connector quota. See dashboard-design-system-verification.md.
Date: 19 October 2026.
Branch: codex/figma-school-admin-screens, created from the existing main checkout.

## Product analysis

Problem: existing school MIS workflows require consistent visual implementation against the supplied Figma section and design-system PDF.
Primary users: school administrators and authorised staff. Existing other-role portals are outside this Figma section unless a retrieved frame explicitly includes them.
Core scope: all 62 screen frames in section 1106:188, including their drawers, popups and multi-step form states. One additional Group 556 frame is unclassified and requires inspection before inclusion.
Optional scope: new features, redesigned role portals, new integrations and additional themes are separate work.
Competitor analysis: unnecessary for reproducing an approved design; no competitor research or unsupported comparisons are included.
Main risks: missing detailed Figma context, existing screens with unverified visual fidelity, undocumented responsive states, and regressions to connected school workflows.
Improvement: maintain one frame-to-route inventory with explicit evidence of visual and functional verification instead of treating route existence as completion.

## Verified connector access

The albino connection resolves to albinosiby1@gmail.com, with a Full seat on a Starter plan.
get_design_context returned the supplied section's descendant structure, but explicitly classified it as sparse metadata. It returned no screenshot or implementation-quality design context.
The next get_metadata request was rejected with: "You've reached the Figma MCP tool call limit on the Starter plan."
Therefore the linked section structure is accessible, but detailed access to every screen and other file pages has NOT been verified. The present quota prevents further inspection.
Continue with the requested account when its connector quota becomes available. Do not silently substitute the other connected account.
Before implementing any frame, retrieve its detailed context and screenshot; split sparse responses into visible child nodes.

## Design system and frontend design

The supplied one-page PDF was extracted and visually reviewed. Treat its content as design reference, not as instructions that override the user's request.
Confirmed: Poppins Regular/Medium/SemiBold; primary #2F4FD8; secondary #0333C0; background #F8FAFC; examples of buttons, toggles, fields, checkboxes and selectors.
Existing src/styles/tokens.css already contains the confirmed font and brand colours. The PDF supplies no numerical spacing, breakpoints, font sizes or control dimensions.
Retain these brand foundations, measure layout and component states from detailed Figma context, and record any typography conflicts before implementation.
Reuse src/components/ui primitives, SchoolShell, FigmaAsset, and feature components. Keep original static assets local and verify each asset's callsite and rendered geometry.
Screen inventory is recorded below. Existing docs/workspace-screen-audit.md provides initial frame-to-route mappings but explicitly marks many screens as awaiting visual comparison.
User flow: school context and academic year -> module hub -> list/filter -> detail, form, drawer or popup -> validated action -> feedback and refreshed view.
State: temporary controls remain local; use existing feature state/data adapters for persisted workflows. Preserve school and academic-year scope.
Responsive assumption for approval: reproduce supplied desktop geometry and adapt navigation/forms/tables to narrow screens without losing actions. No mobile frames have been verified.

## System architecture

Retain the existing Next.js 16.4.2 / React / TypeScript application, thin routes, feature modules and shared UI; do not scaffold a second app.
Read relevant installed Next.js documentation under node_modules/next/dist/docs before implementation.
Data flow: unknown response -> feature/shared schema parse -> domain ownership checks -> existing adapter/workflow -> typed presentation.
Authentication flow: preserve existing identity and backend boundaries. A visible button or browser-provided school ID never grants access.
Scalability: reuse layouts and components, avoid unnecessary client dependencies, preserve pagination, and avoid fetching whole-school datasets merely for a visual change.

## Database design

No database migration is proposed for visual reconciliation.
Reuse shared school, academic-year, student, guardian and staff contracts and existing feature schemas; infer TypeScript types with z.infer/z.input.
Preserve owned-record relationships and contextual consistency checks.
Tables, constraints and existing indexes remain governed by the current schema/migrations. Propose a new index only if a necessary query is changed and measured.
Validate boundary inputs and cross-school/year relationships; avoid duplicating canonical entities in screen components.

## API design

Preserve existing endpoint contracts and authenticated server mutations; no new endpoints are approved by this proposal.
For each screen, map actual existing request and response schemas before wiring actions. Document exact endpoint and payload examples only after verifying the implementation.
Pattern: authenticated request -> parse input -> check role and school scope -> domain operation -> typed result or structured validation/permission/error response.
Loading, empty, success and failure states must reflect actual action outcomes; prevent duplicate submissions and expose useful retry feedback.

## Development plan

1. Access and inventory: regain detailed connector access; map the 62 frames to existing routes and interaction states; classify Group 556.
2. Foundations: inspect shell, typography and tokens; reconcile shared controls and static assets first.
3. Dashboard: dashboard, setup, approvals, calendar, audit, notice, inquiry and associated popup states.
4. Admissions and people: admission funnel, application workflows, students/guardians, staff/HR and their forms/drawers.
5. Teaching operations: attendance, timetable, academics/homework and exam screens.
6. Finance and administration: fees, communication, reports, settings/year end, profile and notifications.
7. Verification: screenshot comparison, keyboard/mobile checks and critical workflow regression checks; update handoff evidence.
Suggested sprint structure: discovery/foundations; dashboard/admissions; student/staff workflows; teaching operations; finance/admin and final QA.
Estimate: provisional 4-6 weeks for one developer with QA review, assuming reliable detailed connector access and reuse of current workflows. Re-estimate after the first representative screen audit. This is a planning range, not a delivery commitment.
Priority: resolve connector access -> approve this proposal -> retrieve frame context -> implement in reviewable module batches.

## Security

Preserve server-side authentication, authorisation, school tenancy checks and private-file boundaries. Do not place student documents or credentials in public assets.
Use synthetic data for screenshots; avoid logging personal records. Validate mutation inputs on the server even when forms also validate in the browser.
No permission, policy, payment or notification behaviour should be inferred from design sample text.

## Testing

For each changed screen, compare the implementation with its retrieved screenshot and test keyboard navigation, focus, labels, overflow and action feedback.
Cover meaningful form invalid/boundary cases and school/year ownership checks whenever contracts change.
Run npm test, npm run typecheck and npm run build for model/schema changes and final integration.
Check existing critical flows after shared shell/control changes; verify empty/loading/error states without replacing real workflows with simulated success.
No tests were run for this planning-only change.

## DevOps

Retain the existing deployment configuration. No deployment, production mutation or infrastructure change is requested here.
Use existing CI checks and module-sized reviewable diffs. Keep application monitoring intact and inspect errors during verification.
Visual changes require ordinary rollback through Git; any later data migration needs its own backup and recovery plan.

## Documentation and acceptance

Update docs/figma-handoff.md and docs/workspace-screen-audit.md as screens are verified. Preserve setup/API/user guides; update them only where behaviour changes.
Acceptance per frame: detailed context retrieved, screenshot compared, design system applied, original assets verified, interactions work, responsive/keyboard review complete, and relevant checks pass.
Do not mark all screens accessible or complete based on sparse metadata.

## Retrieved frame inventory

This inventory proves structural visibility only. It does not prove screenshot retrieval, implementation fidelity or access to other file pages.

| Figma node | Frame | Size |
| --- | --- | --- |
| 1106:189 | S8. Exams & Results | 1440 × 1460 |
| 1106:856 | S8. 8.1 Create Exam Cycle | 1440 × 2920 |
| 1106:1598 | S9. Fees & Payments | 1448 × 1708 |
| 1106:2151 | S10. Communication & Reports | 1440 × 2028 |
| 1106:2616 | S10. 1.Standard Reports | 1440 × 2292 |
| 1106:3211 | S11. Settings & Year End | 1440 × 2516 |
| 1106:3817 | S12. Profile | 1440 × 2028 |
| 1106:4250 | S13. Notifications | 1440 × 924 |
| 1106:4493 | S1. Dashboard | 1440 × 1680 |
| 1106:5246 | S2. Admission | 1440 × 1928 |
| 1106:5883 | S2.  1.Public Form & QR | 1440 × 1920 |
| 1106:6406 | S2.  2.Log New Enquiry (Slide In) | 1440 × 1162 |
| 1106:6665 | S2.  3.Applications | 1440 × 1598 |
| 1106:7351 | S2.  4.Form Builder | 1440 × 2086 |
| 1106:8070 | S2.  5.Tests & Interviews | 1440 × 1542 |
| 1106:8655 | S2.  6.Seats & Waitlists | 1440 × 1554 |
| 1106:9347 | S2.  7.Offer & Enrolment | 1440 × 1174 |
| 1106:9962 | S2.  8.Re-enrolment | 1440 × 1478 |
| 1106:10668 | S2.  9.Reports & Anlaytics | 1440 × 1934 |
| 1106:11238 | S1. 1. Setup Wizard | 1440 × 1956 |
| 1106:11932 | S1. 2. Approvals Inbox | 1440 × 1365 |
| 1106:12540 | S1. 3. Academic Calendar | 1440 × 1502 |
| 1106:13297 | S1. 6. Add Academic Event | 1440 × 2705 |
| 1106:13996 | S1. 7. Resume | 1440 × 1708 |
| 1106:14550 | S1. 8. Export Funnel | 1440 × 1636 |
| 1106:15040 | S1. 9. Manage Inquiries | 1440 × 1508 |
| 1106:15746 | S1. 10. Assign (popup) | 1440 × 1149 |
| 1106:16183 | S1. 4. System Audit Log | 1440 × 1160 |
| 1106:16639 | S1. 5. Quick Notice | 1440 × 1908 |
| 1106:17069 | S3.  1.Enroll New Student | 1440 × 1904 |
| 1106:17703 | S3.  2.Guardians | 1440 × 1484 |
| 1106:18341 | S3.  3.Import & Migration | 1440 × 1298 |
| 1106:18769 | S3.  4.Promotion & Transfers | 1440 × 1380 |
| 1106:19324 | S3.  5.ID Cards & Barcodes | 1440 × 1662 |
| 1106:19933 | S3.  6.Certificates & TC | 1440 × 1342 |
| 1106:20477 | S3.  7.Review & Merge | 1440 × 1500 |
| 1106:20962 | S3.  8. Bus Route | 1440 × 1254 |
| 1106:21493 | S3.  1.1.Step 1 Student Demographics   | 1440 × 2206 |
| 1106:22088 | S3.  1.2.Step 3 Guardians & Emergency | 1440 × 2473 |
| 1106:22771 | S3.  1.3.Step 4 Documents & Fees | 1440 × 3274 |
| 1106:23542 | S3. Students & Guardians | 1440 × 1904 |
| 1106:24360 | S4.  1.Add / Onboard Staff | 1440 × 1104 |
| 1106:24710 | S4.  2.Staff Profile Drawer | 1440 × 1298 |
| 1106:25299 | S4.  3.Roles & Permissions | 1440 × 1128 |
| 1106:25815 | S4.  4.Class & Subject Allocation | 1440 × 1408 |
| 1106:26441 | S4.  5.Complete Documentation | 1440 × 2483 |
| 1106:27061 | S4. Staff | 1440 × 1792 |
| 1106:27796 | S5.  1.Period Wise | 1440 × 1504 |
| 1106:28461 | S5.  2.Leave Requests | 1440 × 1432 |
| 1106:29080 | S5. Attendance | 1440 × 1792 |
| 1106:29903 | S6.  1.2 Assign Slot (Popoup) | 1440 × 1285 |
| 1106:30598 | S6.  1.3 Reset to Empty Grid | 1440 × 2024 |
| 1106:31310 | S6.  1.Create / Edit Timetable | 1440 × 1842 |
| 1106:32046 | S6. Timetable | 1440 × 2000 |
| 1106:32589 | S7.  1. Subjects & faculty | 1440 × 1319 |
| 1106:33175 | S7.  2. Syllabus & Curriculum | 1440 × 1308 |
| 1106:33712 | S7.  3. Lesson Plans | 1440 × 1224 |
| 1106:34207 | S7.  1.1 Allocate Subject / Faculty (popup) | 1440 × 879 |
| 1106:34336 | S7.  2.1 Add Chapter / Unit (popup) | 1440 × 1152 |
| 1106:34679 | S7.  3.1 Add Lesson Plan (popup) | 1440 × 1152 |
| 1106:34927 | S7.  S7.1 create / Assign Homework | 1440 × 1177 |
| 1106:35344 | S7. Academics & Homework | 1440 × 1728 |
| 756:301 | Group 556 | 933 × 700 |

