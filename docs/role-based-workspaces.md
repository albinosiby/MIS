> Current implementation update (18 October 2026): Supabase Auth/database integration is applied. All 15 school roles have scoped access policies, invitations/person linking and command boundaries. Private binary storage is available at `/documents/files`. See `access-and-private-files-plan.md`, `specialist-role-live-verification.json` and `private-files-live-verification.json` for the latest scope and evidence. Historical audit results below describe earlier milestones, not current limitations. Multi-school/platform/group access and remaining business workflows are still separate work.

# Role-based school workspace

Implemented 18 October 2026 against the approved expansion plan. This is a synthetic-data application, not a production school service.

## Run locally

Use Node 24. Install dependencies with `npm ci`. Set `LOCAL_SESSION_SECRET` in `.env.local` to a locally generated random secret of at least 32 bytes. The working copy has already been configured; do not copy its secret into documentation or chat. Run `npm run build` then `npm start`, or `npm run dev -- --webpack` during development. The supplied scripts bind to `127.0.0.1`.

Entry: `/login`. Each seeded account uses the initial password the configured account password. Password recovery can change individual workspace passwords, so this is not a permanent override.

| Role | Email | Starting area |
| --- | --- | --- |
| School administrator | the configured school account | /dashboard |
| Principal | the configured school account | /dashboard |
| Teacher | the configured school account | /teacher |
| Staff | the configured school account | /staff-portal |
| Accountant | the configured school account | /fees |
| Parent | the configured school account | /parent |
| Student | the configured school account | /student |
| Driver | the configured school account | /driver |
| Librarian | the configured school account | /library |
| HR | the configured school account | /hr |
| Nurse | the configured school account | /health |
| Counsellor | the configured school account | /wellbeing |
| Transport manager | the configured school account | /transport |
| Inventory manager | the configured school account | /inventory |
| Hostel warden | the configured school account | /hostel |
| Platform operator | the configured school account | /platform |
| Group director | the configured school account | /group |

Role-specific login routes use `/login/<role>`. The submitted account, not the selected login entry, determines the role and destination. `/select-role` opens another account's sign-in page rather than granting a new role. Existing school pages now require sign-in. Account security and sign-out are linked from both shells.

## Storage and boundaries

School data remains in the existing versioned IndexedDB workspace. New `extensions` records carry school/year scope and reference the existing student, staff, class, invoice and other records. Full workspace export/restore includes these records; stale-tab compare-and-swap protection and archived-year read-only behaviour remain in effect. Missing extension arrays in pre-expansion saves are populated with validated synthetic examples during migration, without replacing existing school records. Previously archived years are not populated.

Local identities are stored separately at `.local/school-workspace.sqlite`, excluded from Git. Passwords use salted scrypt hashes. Sessions use an HMAC-signed HttpOnly SameSite cookie and eight-hour expiry. Account deactivation, password completion and session revocation invalidate older sessions via the account version. Invitations/recovery links store hashed one-use tokens with one-hour expiry. Account mutation actions verify the signed-in school administrator on the server.

The SQLite identity store is not included in browser JSON backups. Preserve it separately when retaining local workspace account changes. Deleting it recreates synthetic seeded identities on the next local request. No actual school account should be provisioned here.

School records are still a shared synthetic browser workspace. Role-scoped UI/domain projections are demonstrated, but a person controlling this browser can inspect its local records. These checks are not a substitute for Supabase RLS, server-side record ownership or verified custody/consent. Account-person linking is deliberately labelled a local workspace assignment. Do not use real school data or deploy this adapter as live authentication.

## Screens and architecture

- Existing 60 workspace pages and eight setup steps remain connected.
- Seventeen seeded identity roles, role entry pages, recovery/activation, account/security, school context, invitation/user management and person linking.
- Teacher, staff, parent, student and driver portal navigation and views, linked to canonical records. Families see completed results; teachers use assigned classes/subjects. Homework answers and feedback connect both sides.
- Eighty-five operational form/workflow definitions across twenty areas: fees, exams, communication, HR, transport, library, inventory, hostel, wellbeing, health, activities, documents, learning, front office, reports, settings, CMS, platform, group and alumni.
- `/workspace` is the permission-filtered module directory. Existing module hubs keep their original layout and link to this directory.
- Each new area has feature-owned `schemas/operations.schema.ts`, inferred contracts in `models/operations.ts`, and form presentation metadata in `data/operation-forms.ts`. The shared operations feature supplies the table/editor/projection and workflow engine. Canonical School, Student, Staff and AcademicYear contracts are reused.
- `/school-site` previews published CMS pages/news and public admission intake in the same browser. `/verify-certificate` exposes limited issued-certificate status. `/welcome` provides vendor/public product pages; its onboarding request appears in the platform queue without creating an account.

New collections support appropriate add/edit, workflow progression, cancellation, search/status filters, pagination, CSV export, print, detail and history. Finalised records reject silent edits. Examples of contextual rules include one active loan per copy, stock availability, overlapping bed allocations, duplicate exam seats, club capacity, payment/refund ownership and limits, salary deduction bounds and scoped references. Book renewal, family PTM booking and consent responses have narrow dedicated domain actions.

## Integration-dependent screens

Gateway configuration, live delivery, GPS, external meetings, integrations, domain provisioning, certified payroll/statutory packs and platform subscription processing show their disconnected/workspace states. Payment attempts have simulated success/failure outcomes and never mark a real invoice paid. No provider secrets are entered into generic forms.

MFA enrollment/challenge, email verification and Auth callback screens explicitly require Supabase setup; this workspace does not claim real MFA or provider verification. workspace invitations and recovery links are displayed locally rather than sent by email. Test credential completion through the automated adapter tests or manually with synthetic accounts.

Legacy profile attachments retain their metadata; new binary uploads use the private document register. Public CMS output is a same-browser preview, not deployed hosting or a domain. Payroll net-pay arithmetic and journal-entry UI do not constitute a certified tax engine or full accounting integration. The broader production requirements and provider-specific work remain in the approved plan.

## Verification

Run `npm test`, `npm run typecheck` and `npm run build`. Regression cases cover role routing, guardian rights, scoped ownership, account activation/recovery/revocation, protected final administrator, cross-role homework/feedback, teacher attendance, quiz visibility, family responses, loans/renewal, stock and beds. Browser evidence is recorded separately after checking the running build.

Use a separate origin for destructive workspace record tests. Cookies are host-scoped, so login changes on another localhost port can also affect the active localhost account. Signing in again restores the desired role; browser school records remain origin-scoped.

## Supabase continuation

The live school integration and private document migrations are applied to the linked development project. Inspect existing schema and migration history before further migrations. Use the approved normalised schema plan, server-verified identity/membership, RLS, private storage and transaction/outbox boundaries. Export/validate synthetic data before an explicit import. The frontend URL/publishable key are different from migration authority; no privileged credential belongs in a client environment variable or chat.

Design: the supplied Poppins/token system and existing layout patterns are preserved. New screens use the approved design-system fallback; their exact Figma pixel parity is not verified while frame access remains unavailable.

## Verification results

- 68 automated tests passed; TypeScript checking passed.
- Production browser checks rendered all 85 operational collection pages, 54 portal navigation pages, all 60 pre-existing admin routes, eight setup steps, account/context screens and 23 public/auth-support pages. These are route smoke checks, not exhaustive testing of every record combination.
- All 17 seeded roles signed in to their intended home. Parent access to the administrator dashboard was rejected by the server.
- Browser workflows verified loan renewal/return, parent PTM booking, consent response, decimal payment simulation success/failure, and teacher-created homework through student submission and teacher feedback back to the student.
- The saved-data repair was tested against the exported failing synthetic workspace; it preserved the original records and restored validation. Raw recovery export is available before any sample reset.
- Source control-binding audit: 354 controls, zero unexplained unbound controls (one intentionally disabled design-system sample).
- Audit entries now retain the acting workspace account; legacy entries are explicitly unidentified rather than attributed to the principal.

See `expanded-screen-inventory.json` for the route catalogue and `role-workspace-browser-audit.json` for browser evidence. New screens follow the approved design-system fallback; exact Figma parity, real Supabase policies, external integrations and physical printing remain unverified.

## Follow-up five-role audit

The follow-up audit passed 73 automated tests, TypeScript checking and the production build. It rechecked 60 admin and 48 teacher/staff/parent/student portal routes and 28 named browser scenarios. Login retries, selected-date persistence, date-specific attendance drafts, staff review boundaries, family request controls, pending grading and teacher lesson ownership were corrected. See [audit notes](role-flow-audit.md) and [browser evidence](five-role-browser-audit.json) for exact scope and limits.
