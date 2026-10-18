# Supabase connection and verification

Project: `fxtlcapsytqyzsgcbcvp` · checked 18 October 2026.

## Enabled locally

The application runs at `http://127.0.0.1:3000` with `MIS_BACKEND=supabase` and explicitly opted-in `MIS_TEST_ACCOUNTS_ENABLED=true`. The user supplied the server key directly in ignored `.env.local`. The app never exposes it through a `NEXT_PUBLIC_` variable. The authenticated, linked CLI was used because the MCP connector is connected to a different account.

Seven migrations establish schools, academic years, people, memberships, enrolments, guardian links, teaching assignments, private workflow documents, private module indexes and audit events. All eleven application tables have RLS enabled. The read/commit/intake RPCs are callable only by the server role. Authenticated clients can select only their own active membership. A database trigger protects the last active administrator. Stale writers receive HTTP 409 and cannot overwrite newer data.

The existing browser workspace was exported through its UI, validated and explicitly imported: **101 students and all eight setup steps**. Cloud-only workflow test records were retained. The original browser IndexedDB workspace and exported file remain intact. A pre-import remote backup is stored locally at `/tmp/mis-cloud-before-browser-import.json`; copy it to a protected durable backup location if needed.

## Authentication and accounts

Five synthetic confirmed Supabase Auth users have active school memberships:

| Role | Email |
|---|---|
| Admin | the configured school account |
| Teacher | the configured school account |
| Staff | the configured school account |
| Parent | the configured school account |
| Student | the configured school account |

Initial development password: the configured account password. These are synthetic test identities; replace them before real deployment. Local SQLite password hashes were not migrated. Other local workspace roles were not provisioned into cloud Auth; cloud workspace selectors show the five provisioned roles. Admin invitation/person-linking adapters also support principal accounts, but no principal cloud workspace user was created.

Authentication uses email/password, server-verified Auth identity, an active school membership and a live session lookup. The SSR proxy refreshes cookies. Browser-supplied roles, school IDs or person IDs are not proof of access. Global sign-out revokes the server session lookup.

## Data flow and validation

Server actions read the canonical school workspace, parse unknown inputs through shared/feature schemas, check role and record relationships, execute existing domain operations and commit atomically using the expected revision. Admin/principal replacement writes check school scope, immutable archived years and authoritative audit actors. Portal actions use explicit commands; family browsers receive scoped projections, not the canonical school document.

The public website receives a separate published-content projection containing no student/guardian/staff roster, transactions, inquiry queue or certificate registry. Public intake forces configured school/year and initial workflow status, resolves sibling admission references on the server, validates configured admission requirements and appends through a service-only transaction. Intake is capped at twenty requests per school per minute. Certificate verification returns only limited issued-certificate metadata for the supplied reference. Expected mutation failures return typed result envelopes so production builds display readable validation errors.

The initial repository preserves existing domain contracts using a versioned workflow document. School/year/people/access foundations are relational; module payloads remain private documents and indexed records. This is a working development integration, **not a fully normalized production schema**. Whole-school revision conflicts can limit concurrency. Feature-specific database transactions, per-module tables and stronger public abuse controls are follow-up production work.

## Verification

- Automated tests: **82 passed**; model boundaries, invalid inputs, ownership, projections, public intake and workflows.
- Live Supabase integration audit: **55 passed**; all five Auth logins, own-membership RLS, privileged RPC denial, role escalation prevention, teacher/student feedback, staff claim review, parent leave/attendance, foreign school/child denial, stale-write rejection, final-admin protection and session revocation.
- Browser evidence: `supabase-browser-audit.json`. All five roles signed in. Verified admin notice → parent acknowledgment with reload persistence; teacher homework → student answer → teacher grade → parent feedback; approved staff claims; anonymous admission → admin queue.
- TypeScript check and production build are recorded in `supabase-db-audit.json` after final validation.
- UI binding audit: 356 controls, zero unbound review items at the first cloud audit; rerun after UI changes.
- Database advisors report **one Auth warning: leaked password protection is disabled**. Database RLS/grant checks passed. Review password protection in Supabase Auth settings before production; availability can depend on the plan.

Detailed machine-readable evidence: `supabase-workflow-audit.json`, `supabase-browser-audit.json`, `supabase-db-audit.json` and the screenshots under `docs/screenshots/`.

## Setup and operations

Ignored `.env.local` contains `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVER_SECRET_KEY`, `MIS_BACKEND=supabase`, and the preserved local workspace session secret. Never commit this file or put secret/management tokens in browser variables.

Commands:

- `npm run start -- --port 3000` after `npm run build`.
- `npm run check:supabase`: public Auth readiness and expected anonymous workspace denial.
- `node scripts/bootstrap-cloud-accounts.ts`: preview synthetic accounts; `--apply` creates missing synthetic identities without replacing existing mismatched memberships.
- `node scripts/test-cloud-workflows.ts`: writes synthetic test records to this development project, checks permissions and signs out test sessions. Avoid running during manual browser sessions because global sign-out is part of this audit.
- `node scripts/import-browser-workspace.ts '<export-path>'`: validated merge preview. `--apply` preserves a remote snapshot and commits with compare-and-swap. Existing local rows take precedence over same-ID remote rows; inspect the preview and export before reusing it after cloud becomes authoritative.
- `npx --no-install supabase migration list --linked` and `supabase db advisors --linked --type all --level warn`: migration and advisory checks.
- `npm test`, `npm run typecheck`, `npm run build`, `npm run audit:ui`.

Real payment processing, provider email deliverability, recovery/invitation delivery, MFA enrollment, document binary storage, production deployment/backup policies and normalization remain separate integration requirements. No real payment or external notification was sent. File attachments currently save metadata only. Recovery/invitation adapters are implemented but were not tested by sending provider emails or changing a user's password. The personal access token previously pasted in chat should be rotated through Supabase after setup.

## Subsequent production audit

See `production-readiness-audit.md` for the current gap register and launch gates. The audit adds archived-year omission protection, message staff-participant boundaries, current guardian notice-permission checks and explicit synthetic-account gating. Keep `MIS_TEST_ACCOUNTS_ENABLED=false` for real school use; the local synthetic environment intentionally sets it to true. These fixes do not claim completion of the remaining specialist roles, private binary storage, notification delivery, background jobs or production operations.
