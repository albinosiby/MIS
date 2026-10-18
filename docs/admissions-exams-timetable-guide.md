# Admissions, examination reviews and timetable publications

## Admissions

Open **Admissions → Complete admission & continuation** (`/admissions/completion`).

- After offer acceptance and private-file verification, enrolment creates the student/profile/guardian links and optional admission invoice. An additional admission keeps existing setup sign-offs.
- **Admission portal handoff** prepares a linked parent/student invitation. Verify identity, the recipient email and guardian authority first. The account remains inactive until its recipient accepts the one-use link and sets their own password. Existing person accounts are rejected rather than silently reassigned. School administrators cannot use ordinary activation to skip pending invitation acceptance. No invitation email is sent while the provider is disconnected.
- **Confirm next-year continuation** saves re-enrolment intent and the promotion/retention/year-end transfer directive used by academic-year rollover. It does not immediately move the student. Changes append decision history; identical retries are rejected.
- **Withdraw an active enrolment** records a dated exit. Close loans, hostel/outpasses and outstanding library fines first. Choose to retain invoices/balances or void issued invoices only after net collections are fully returned. This never automatically refunds money. Existing journal posting creates the accounting reversal for voided invoices. Dates cannot precede enrolment or class movement.
- Historical students remain available for permitted records and financial balances; they no longer consume an active class seat. Direct profile edits cannot remove/reassign enrolment profiles or bypass lifecycle status changes.

## Examinations

Open **Examinations → Moderation & result corrections** (`/exams/reviews`).

1. An allocated teacher or examination administrator submits an entered mark for moderation before publication. Select an earlier matching moderation/re-evaluation request when applicable. Pending moderation blocks report issue/assessment completion.
2. A different examination administrator approves or rejects with a note. An approved moderation updates that exact mark; a linked request receives the decision and history.
3. Issue report cards at `/exams/publications`. Choose published grade rows that cover 0–100 and an optional published report template, or use the default bands/template. Headings, footer, layout and grading choices are saved with the report and used by PDF/Excel export.
4. After publication, propose a correction against the current report version and subject. Independent approval updates the exact mark and creates a new immutable report version. The replaced report and transcripts depending on it are revoked; their snapshots remain unchanged. Download access is checked on every request. Reissue a transcript after all corrected source reports are available.

Stale marks, revoked sources, repeated decisions and self-approval are rejected. Issued reports cannot use the old broad exam-unlock path. A database trigger serializes detached revocation checks with new review requests/acceptance.

## Timetable

Open `/timetable/versions` or **Timetable → Substitutions**.

- Draft changes remain working records. Publication saves a numbered snapshot with the class, subject, teacher and period names. Teacher/family timetable projections use the latest published snapshot until another version is issued.
- Publishing the timetable does not publish substitutions. A teacher requests cover for their own published slot, or an administrator requests it. Another administrator approves/rejects; approved cover requires a separate explicit publication.
- Publication rechecks dates, teacher employment, approved leave, slot ownership and period collisions. Cancellation removes the effective cover and preserves the request and decision audit.
- Teacher/family timetable pages show published dated cover. Family views use a generic cover reason rather than staff absence details. A cover assignment does not grant access to the class's private student records.

## Verification and runtime

Reports: `completion-lifecycles-live-verification.json`, `completion-role-boundaries-live-verification.json`, and `worker-runtime-verification.json`. Live checks use existing synthetic logins and labelled isolated school records. They do not change Auth passwords or role memberships. The recipient-owned password/activation step was not automated and needs recipient acceptance testing once invitations are used.

Run `npm test`, `npm run typecheck`, `npm run build`, then `npm start -- --port 3000`. Restart the separately supervised `npm run worker` process after deploying model changes; an old process retains its imported schemas. Developer mode remains `npm run dev -- --port 3000` using webpack.

The canonical workspace has a 20 MB database limit and bounded history collections. Move large installations to paged relational histories before those limits are reached; snapshots must never be silently dropped. Production provider delivery, certified board formats, deployment/recovery acceptance and advanced timetable optimization remain separate scope. Supabase's existing leaked-password-protection warning remains an account configuration item.
