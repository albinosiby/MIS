# Private document register

Open **Private documents** from the school or role navigation, or go to `/documents/files`.

## Upload and manage

1. Save the student/staff record before attaching files. Select the active academic year, file owner and category in the register.
2. Choose a PDF, PNG or JPEG up to 5 MB. The server checks size, filename, file signature, declared type, current membership and owner/category permissions. Active, encrypted and object-stream PDFs are unsupported. Content checks are not an antivirus service.
3. Upload. The ready file appears in the register and persists in private Supabase Storage independently of browser storage.
4. **Download** rechecks the live session and current relationships, verifies the stored hash and streams an attachment with no-cache headers. There is no public or permanent signed download link.
5. **New version** preserves the prior version and audit history. A linked person cannot replace another author's file merely because they can upload to that owner. The uploader or a permitted administrative/specialist reviewer manages replacements and revocation.
6. **Revoke** blocks downloads immediately. It preserves audit metadata and retained bytes. Administrators can **Purge bytes** after retention expires. Default retention is 30 days.
7. Interrupted uploads are never downloadable. The original uploader can recover an uploaded file after integrity validation or cancel an incomplete upload. Cancellation has no published-file retention requirement; a remaining unavailable object can be purged by an administrator.

The legacy profile attachment rows are metadata records; they are not proof that a binary was uploaded. Use the private register for all new files. Profiles and operational forms link there rather than accepting new metadata-only attachments.

## Access policy

Admin/principal manage school files. HR handles staff identity/employment files; accountant handles finance; nurse handles medical; counsellor handles counselling. Staff can access their own employment uploads. Families see only their currently permitted linked students' identity/academic/finance files, with no finance upload rights. Teachers see assigned students' academic files. General school files are readable by authenticated school members and managed by administrators. Clinical/counselling documents are not automatically shared with family portals.

Private metadata and Storage deny direct browser clients, including authenticated clients. Application endpoints verify current membership, school/year, owner and category; the privileged repository key never reaches the client. Disabling membership or revoking a guardian relationship takes effect on the next file request. Archived files remain readable where permitted, uploads are blocked, and administrators can still revoke retained archived files.

## Interfaces and verification

- `GET /api/documents?year=<id>&before=<cursor>`: bounded permitted metadata with an opaque compound pagination cursor.
- `POST /api/documents`: bounded multipart upload with yearId, ownerType, ownerId, category, optional replacesId and one file.
- `GET /api/documents/<id>`: authenticated attachment bytes.
- `POST /api/documents/<id>` with `{ "action": "revoke" | "purge" | "resume" | "discard" }`: permission-checked lifecycle mutation with same-origin checks and bounded request size.

Run `npm test`, `npm run typecheck`, and `npm run build`. The opt-in `node scripts/verify-private-files.ts` exercises the existing synthetic accounts and non-sensitive project logo bytes against the local running app and linked development database; it preserves test files under retention and writes `private-files-live-verification.json`. It changes no passwords or canonical school document.

`node scripts/verify-school-role-access.ts --apply` is a privileged opt-in test: temporarily reuses the synthetic staff membership for ten specialist roles, stores a private recovery snapshot, and restores/verifies the exact original record in `finally`. Run only with explicit authorization and never against live-school identities. See `specialist-role-live-verification.json`.

## Remaining launch gates

Production malware scanning, storage backup/restore drills, school-approved retention/deletion rules, deployment limits and abuse controls remain operational work. The database advisor still reports leaked-password protection disabled. Multi-school/platform/group tenancy, conversations/jobs and remaining domain business workflows are separate milestones. These checks do not certify every school workflow or production deployment.
