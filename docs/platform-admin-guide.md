# Platform administration and fresh institution onboarding

The platform panel lives at `/platform`; its login is `/login/platform`. It uses a separate server-verified platform operator grant. A school admin account cannot open it. No existing user is automatically promoted.

Implementation is grouped in `src/features/admin/`, with components, models,
schemas, domain operations, server adapters, data and styles. Page composition
lives in `src/app/(admin)/platform/`; API routes retain `/api/platform/`.
See the [folder guide](../src/features/admin/README.md) for shared consumers.

## First production administrator

Apply the checked-in migrations to the intended Supabase project before starting this version. The migration does not create a platform login. With the existing server-only Supabase configuration available, add these **private** values to ignored `.env.local`, or supply them securely to a trusted terminal environment:

```dotenv
PLATFORM_BOOTSTRAP_EMAIL=<new platform administrator email>
PLATFORM_BOOTSTRAP_NAME=<administrator name>
PLATFORM_BOOTSTRAP_PASSWORD=<strong temporary password>
```

Use a new email. The password needs at least 12 characters with uppercase, lowercase, a number and a symbol. Then run:

```sh
npm run platform:bootstrap
npm run platform:bootstrap -- --apply
```

The first command displays instructions without changing accounts. The second creates the first platform administrator. Existing emails/passwords are never overwritten. Bootstrap stops if an operator already exists, and can recover its own incomplete Auth creation. Sign in at `/login/platform`, replace the temporary password, then use **Set up account MFA**. Remove the bootstrap password from your environment afterward. Never commit it or put it in a `NEXT_PUBLIC_` variable. No email is sent by bootstrap.

For Railway, run bootstrap from a trusted local checkout against the same intended Supabase project; do not add it as a build/start command. Existing web and worker deployment settings remain applicable. Use `MIS_TEST_ACCOUNTS_ENABLED=false` for real school data. The first operator's real email is independent of existing synthetic accounts.

## Register a new school or college

1. Open **Institutions → Add institution**.
2. Enter the institution, contact/address, board/curriculum, initial academic year and first administrator details.
3. Set a strong temporary administrator password and submit. Share credentials privately through your chosen manual channel.
4. The institution administrator opens `/login`, changes their temporary password, and is directed to `/school-setup`.
5. Complete the eight setup steps, adding actual classes, periods, fees, staff and student data.

New workspaces contain the submitted institution, academic year and actual administrator staff entry. They do not copy example students, financial transactions, publications or imported fixture records. Setup completion stays at 0/8. School and college labels share existing academic modules; this does not introduce university credits or higher-education-specific workflows.

Provisioning records a durable request before calling Supabase Auth. Retries of the same request are idempotent. If Auth succeeds but the database operation fails, open **Unfinished registrations and account requests** from Institutions/Overview/Users and retry with the original temporary password. Passwords are never stored with the request. A pre-existing email is refused; it is not silently reassigned or reset. Duplicate-email requests need a new email and a new submission; use **Start a new registration/account request** after correcting the form.

## Institution access and data

Click **View institution** to inspect setup, students, staff, admissions, attendance, finance, examinations, timetables and the remaining persisted records. Select an academic year and section; search and paginate records; expand a row for complete saved fields. This is an operator inspection view, not an impersonated school session. It intentionally uses a read-only record inspector rather than embedding every school editing screen.

**Private documents** shows file history; only ready/current files can be downloaded. The server rechecks school ownership and revocation after retrieving bytes. Credentials, tokens and existing passwords are not included. Inspection and download access is audited.

Suspending an institution denies its existing authenticated sessions access to school operations; it preserves school data. The operator can still inspect it and reactivate it. Suspension does not delete users or revoke unrelated school membership records.

## User management

Use **Manage institution users → Create user account**. Search/select the institution by name, choose a role and select the corresponding staff, student or guardian by name. Parent/student users require a person link. Email is the username. Account creation uses a new email; linking the same Auth identity to another institution remains a separate multi-membership workflow.

Expand **Manage account** to save a role/access change or issue a new temporary password. The last active school administrator cannot be disabled or demoted. A role change on an already person-linked account is rejected; use the school's reviewed person/role linking flow. Disabling the primary account blocks effective grants too, following the existing membership model. Password resets block recorded sessions and require recipient activation. A platform account cannot be created through the school user form, and existing passwords cannot be viewed.

## Support and manual email

All signed-in school roles can open `/support` to submit a subject, description, category and reply email. Requester and school ownership come from the authenticated session. Users see only their own requests and public status history.

The platform **Support** inbox receives these requests. Operators can open/reopen/resolve/close requests, add private internal notes, and explicitly log manual contact. **Email requester** opens an encoded draft in the operator's mail application. Sending remains manual. Opening the draft never marks it sent, and a manual-contact record does not prove email delivery. Internal notes and contact logs are withheld from the requester.

## Contracts and operations

- `GET /api/platform?view=institutions|users|support|audit|pending` returns paginated, validated projections (30 rows/page). `q` searches names/subjects; `schoolId` filters applicable lists.
- `GET /api/platform?view=inspect&schoolId=…&yearId=…&section=…` reads a bounded section; `view=files` reads document metadata, and `view=ticket&ticketId=…` reads ticket history.
- `POST /api/platform` accepts the discriminated platform command schema for provisioning, status, accounts and ticket updates. Conflicting ticket versions return HTTP 409; invalid inputs return 400; forbidden operations return 403.
- `/api/platform/institutions/:schoolId/documents/:fileId` downloads an authorized current file.
- `GET/POST /api/support` supports requester-owned lists/detail and idempotent ticket creation.
- `POST /api/account/activate` accepts a recipient's new password and enforces activation before protected data access.

Server-only repositories verify Auth, active session, password activation and current operator/school access. Exposed tables have RLS and no direct browser grants. Auth creation is verified through Supabase's Admin API; no broad Auth-table privileges are added. App-owned session revocation records deny old sessions after reset, including refreshed JWTs that keep the revoked session ID.

Check web logs for safe platform failure codes and pending provisioning records for recovery. Back up database, Auth and private Storage together. Do not rerun seed scripts or reset the existing project to create a new school. Shared bug fixes are distributed by deploying the updated application and worker, not by copying each institution's data.

Supabase's security advisor reports leaked-password protection disabled on the connected project. Enable it in the intended production Auth configuration: [Supabase password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Provider delivery, payment gateways, subscriptions and university-specific academic workflows remain outside this implementation.

## Verification evidence

164 automated tests pass, standalone TypeScript checking and production build pass, and 77 isolated authenticated live checks pass. Live checks cover new institution/account creation, retries, password activation/reset, session blocking, institution suspension, role/ownership denials, private documents and support lifecycle/privacy. Additional browser acceptance saved and reloaded a private support note and a fresh-school profile; the platform directory synchronized the changed profile. The new school's dashboard rendered empty operational records rather than fixture transactions.

Evidence: `docs/platform-live-verification.json`, `docs/screenshots/platform-overview.png` and `docs/screenshots/platform-support-browser-note.png`. Temporary acceptance institutions/accounts are removed after verification, as recorded in the evidence file. No production operator email or password has been chosen or created automatically. Bootstrap preview is verified; the owner's actual production bootstrap and Railway-hosted acceptance are still required.
