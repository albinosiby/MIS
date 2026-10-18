# Admissions, examinations and timetable completion

Approved scope: finish the existing school workflows, preserving the current visual system and feature folders. India/CBSE remains the target; payment gateways and external message delivery remain disconnected.

## Product and architecture

School administrators complete admissions, record continuation decisions and financial exit treatment; teachers request result reviews and administrators independently decide them; administrators publish timetable versions and explicitly review substitutions. Families see only their permitted published records. Existing shared people, school, year, marks, timetable and finance models remain canonical.

Use feature request/state schemas, inferred models, pure domain commands and small panels within the existing workflow shell. Commands pass through `/api/workflows` with authenticated identity, capability restrictions, school/year validation and optimistic revision checks. Persist additive state in the existing versioned workspace document; do not introduce another datastore or a browser-only source of truth. Existing publication and financial effects remain authoritative. New state defaults preserve older documents.

## Acceptance and sequence

1. Admissions: connect enrolled applications to verified parent/student invitation preparation; record continuation/retention/transfer directives for rollover; record dated withdrawal with explicit keep-balance or void-uncollected treatment. Preserve payments and receipt history, reject implicit refunds, and block outstanding operational obligations.
2. Exams: requests contain a base result version, subject and proposed mark; separate reviewer accepts or rejects; acceptance creates a corrected immutable result version and revokes affected obsolete result/transcript snapshots without modifying their content. Old marks remain locked except for the exact approved correction. Published grading/template choices are captured in snapshots.
3. Timetable: explicit publication saves immutable snapshots. Draft substitutions are reviewed independently of timetable publication, with dated conflict/leave/room checks and recorded decisions. Published substitutions can be cancelled with a reason; their audit remains.
4. Verification: invalid/boundary schemas, role and cross-school denial, duplicate/stale decisions, unchanged history, financial consistency, revision contention, persistence after reload, role projections, full test/typecheck/build, live synthetic flows and browser acceptance.

## Boundaries and risks

Do not enrol, withdraw, change marks, grant access or reset credentials for real people during verification. Use labelled synthetic academic records and existing synthetic sessions. New invitation acceptance requires the recipient to set their own password; do not automate a password change. Return a private handoff link rather than claiming email delivery. Existing accounts must never be silently reassigned.

Canonical JSON remains a bounded transitional architecture; maintain its existing limits and fail clearly rather than silently truncating. Full statutory certification, production email, hosting and deployment acceptance remain separate. Keep new actions in the existing audit/revision flow and update the progress document with measured results, not screen-count claims.
