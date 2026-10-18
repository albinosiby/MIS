# Platform administration and support: proposed design

Status: approved by the user and implemented on 18 October 2026. See platform-admin-guide.md and platform-live-verification.json for implemented scope and acceptance. No existing school account was promoted; the first production operator requires explicit bootstrap.

## Product analysis

The platform owner needs one place to onboard institutions, manage accounts, inspect an institution's complete application records and review support requests. Institution administrators and other signed-in users need a support submission page and access to their own request history.

Core scope: platform dashboard, institution directory/create/detail/suspend/reactivate, account creation and access management, read-only institution inspection, support queue, private operator notes, ticket status history and manual email handoff. Payment and external email delivery remain deferred. Existing school-specific academic workflows are retained; using the word college does not add higher-education semesters, credits or university affiliation workflows.

Assumptions: email address is the login username, matching current Supabase authentication; the operator can issue a temporary password, with a required change before normal access. Existing passwords cannot be retrieved. Only a separately authorized platform operator can use global features. Viewing college data does not silently sign in as a college administrator.

No competitor redesign is required: extend the supplied design system and established interface components. Principal risks are cross-institution disclosure, granting platform privileges through school account controls, incomplete account provisioning and exposing sensitive records in operator logs.

## System architecture

Keep the existing Next.js application, Supabase Auth, database, private Storage and continuous job worker. Platform authorization is independent of school memberships and enforced on each server read/mutation. A selected institution ID is a requested resource, never proof of access.

Flow: authenticated request → verified active platform operator → parsed input → scoped repository/domain operation → transaction/audit → validated response. School support submission uses the actual authenticated school context. Data inspection reuses domain models and screens through an explicit read-only platform context, including published and unpublished operational records and authorized private documents. No credentials, session tokens or MFA secrets enter those projections.

Provisioning is idempotent and records pending/complete/failed states. Database writes are transactional where possible; Auth calls require a recoverable provisioning workflow because Auth creation and database transactions are separate operations. Never copy seed students, finance transactions or fixture users into a new institution.

For scale, paginate institutions, users and tickets; load college modules on demand instead of downloading every college workspace. Keep school and academic-year ownership and current revocation checks on document downloads.

## Database design

Names are proposed; confirm against applied migrations before generating new migrations.

- `mis_platform_operators`: user reference, active state, timestamps; grants administered only through a trusted bootstrap/operator path.
- `mis_institution_registry`: existing school reference, institution type, lifecycle status, contact details, creator and timestamps; preserve existing `mis_schools` IDs.
- `mis_institution_provisioning`: idempotency key, institution, provisioning stage, safe failure information and retry state.
- `mis_account_activation`: user/institution references and mandatory password-change state; never store plaintext temporary passwords.
- `mis_support_tickets`: institution, authenticated requester, reply email, subject, description, category, priority, status, assignee, version and timestamps.
- `mis_support_events`: ticket, actor, event type, optional note/recipient and timestamps; operator notes withheld from school projections.
- `mis_platform_audit_events`: operator, institution/target identifiers, action and timestamp; omit credentials and copied document contents.

Use foreign keys, bounded text/enums, valid email schemas, unique idempotency keys and indexes for institution/status/date, requester/date and assignee/status. Enable RLS on exposed tables. Additive migrations preserve current school memberships and records; no automatic conversion of a school role into a global operator.

## API design

Use typed server actions for authenticated forms and route handlers where needed for downloads/pagination. Proposed contracts:

- Institution list/create/update/status and provision/retry.
- User list/create/assign school role/disable access/reset temporary password.
- Read-only institution/module projection and authorized private document download.
- School support create/list/detail; platform support list/assign/change status/add internal note/record manual contact.

Example create input: `{ name, institutionType, administratorEmail, administratorName, temporaryPassword, idempotencyKey }`. Response: `{ institutionId, provisioningStatus, administratorUserId }`; never echo passwords. Example ticket input: `{ subject, description, replyEmail, category }`; requester and institution are resolved server-side. Response: `{ ticketId, status, createdAt }`.

Reject unauthorized requests, invalid ownership, stale versions, duplicate requests and invalid state transitions. Return useful field errors and safe retry instructions; log request IDs without secrets. Account creation must handle an existing email by deliberately linking permitted membership, not overwriting another user's password.

## Frontend design

Platform navigation: Overview, Institutions, Users, Support, Audit. Suggested routes: `/platform`, `/platform/institutions`, `/platform/institutions/new`, `/platform/institutions/[id]`, `/platform/institutions/[id]/data/[...module]`, `/platform/users`, `/platform/support`, `/platform/support/[id]`, `/platform/audit`.

Institution detail shows overview, users, setup progress, module data and status history. Inspection displays a persistent institution name and read-only banner, with a clear return to platform action. Reuse existing school layouts without enabling their operational mutation buttons in platform inspection mode.

School support at `/support`: subject, description, reply email, category, submit confirmation, ticket list and status history. Derive sender identity from login. Platform ticket detail shows institution, requester, reply email, content, notes and status controls. **Email requester** opens an encoded `mailto:` draft for the operator to review and send in their mail application. Opening a draft does not mark an email sent. A separate manual-contact log records the operator's explicit confirmation without claiming delivery.

Support statuses: open → in progress → resolved → closed, with reopening and audited transitions. Include loading, empty, validation, permission, conflict and retry states. Preserve Poppins, existing tokens, accessible labels, keyboard operation and responsive tables.

Keep canonical schemas in shared/feature schema files, inferred models in model modules, contextual rules in domain modules and server adapters separate from UI. Add platform-specific components and repositories under the existing feature structure; do not embed contracts in fixtures or components.

## Development plan

1. Global authorization, additive schema and isolated institution provisioning; tests before granting real operator access.
2. Institution/user management, temporary-password activation and read-only college inspection.
3. School support submission, platform queue, manual email handoff and audit history.
4. End-to-end acceptance, migration documentation, Railway verification and updated user guides.

These are sequential delivery milestones. A reliable calendar estimate follows verification of existing Auth membership constraints and provisioning recovery; no delivery date is promised before that inspection. Shared application fixes are distributed to institutions through the normal web/worker release. Institution records remain isolated. Separate per-college software installations and an update-distribution service are outside this design.

## Security

Require verified authentication and active server-side platform authorization on every global operation. Protect operator enrollment; do not allow self-registration or school-role escalation. Recheck account state on privileged operations; disabling a school membership must not disable unrelated memberships. Disabling an institution blocks its operational access while preserving records and platform review. Avoid deleting Auth identities or school records through routine management.

Audit data inspection, document downloads, account grants/resets and status changes. Temporary passwords are shown only during the authorized creation/reset interaction and are never persisted in application records/logs. Enforce first-use password change server-side. Platform operators cannot view existing passwords. Keep service keys server-only. Validate support text and safely encode manual email fields.

## Testing

Unit: schemas, ownership, ticket transitions, provisioning state/retry, duplicate emails and invalid privilege grants. Integration: transactions, RLS, suspended schools, revoked platform access, temporary-password gating, private downloads and optimistic conflicts. End to end: create two isolated institutions, create/activate users, inspect each, submit support from one and review from platform, open manual email draft, record contact, resolve/reopen ticket and verify isolation from the other institution.

Use synthetic isolated institutions for destructive/lifecycle tests and preserve current school records and existing account roles. A live privileged test needs a specifically designated platform account; do not convert an existing staff account without explicit authorization. Run the full test suite, typecheck and production build. Report browser/live acceptance separately from unit coverage.

## DevOps and documentation

Apply reviewed additive migrations before dependent code. Deploy updated web and worker services through the existing Railway configuration. Do not provision or reseed institutions at server startup. Run CI checks, monitor provisioning failures/support errors and use structured identifiers for diagnosis. Restore drills must include Auth, database and Storage together; test on an isolated environment.

Deliver a platform bootstrap/setup guide, endpoint/action contracts, institution onboarding instructions, account recovery instructions, support workflow guide and verification evidence. Bootstrap the first operator through a trusted server-side procedure after the user identifies the intended existing/new account; never select or grant a real account automatically.
