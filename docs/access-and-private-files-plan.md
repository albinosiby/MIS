# Access and private files milestone

Approved priority: finish school role access and real private document storage before messaging/jobs and business workflow completion. Preserve existing feature folders, shared models, Figma layout and Supabase school data.

## Architecture and delivery

1. Central school-role policy, invitation/person-link support for all 15 school roles, specialist read projections and explicit server commands. Platform/group accounts cannot use school repositories. Permissions are server-owned; editable HR role labels do not grant Auth privileges.
2. Private document metadata/version/audit tables and a private Storage bucket. A verified live session and current school/person/guardian/teaching relationship are required on every request. Browser clients receive permitted metadata only, never bucket paths or server credentials.
3. Multipart upload, bounded and signature-checked PDF/PNG/JPEG bytes, immutable object keys, atomic ready/version publication, authenticated no-cache attachment downloads, revoke and retention-aware purge. Previously saved metadata is not represented as an uploaded file.
4. Schema/domain denial tests, live RLS/Storage probes, upload/download/version/revoke checks and browser checks, then type/test/build gates.

## Policy

Admin/principal administer the school; specialist roles operate their respective modules. Accountant sees billing, HR sees employment/staff registers, transport sees routes and transport assignments; library/inventory/warden/nurse/counsellor receive only their module dependencies. Teachers see assigned classes/subjects, families see only currently permitted linked students, drivers see assigned trips. Clinical and counselling collections are withheld from other specialists. Account identity, school scope and owner links cannot be granted by form values.

Documents have school/year, owner type (school/student/staff), owner ID and category. Identity/academic files can be handled by school administrators and authorized linked families; teachers see assigned academic documents only. Employment files are for HR/administrators and the linked staff member. Medical/counselling files are for their specialist/administrators and intentionally not shared to family portals by default. Finance files are for accountant/administrators and permitted linked families. General school files are for authenticated school members. Uploader identity alone never grants access to another person's file.

## Data/API/UI

`mis_documents` stores immutable version metadata, SHA-256, byte size, MIME, object path, retention and lifecycle state. `mis_document_events` records actor, event and timestamp. Composite school/year/person references and indexed scope/list/version keys protect relationships. Tables and bucket are private with no direct authenticated writes or reads; service-only lifecycle functions require an active school membership. Server domain checks remain mandatory because the server key bypasses RLS.

`/api/documents`: permitted list and bounded upload; `/api/documents/[id]`: permission-checked attachment download, revoke or retention-aware purge. No permanent download URL is issued: each download rechecks the session and current permissions. Downloads are not browser-cached. Private file register is reachable from every school role's navigation; profile document controls link to this register rather than saving new metadata without bytes.

## Limits and operations

Single active school membership remains the current model. Multi-school/platform/group tenancy, conversation participants, background jobs, external delivery, full accounting/payroll and other business workflows remain later milestones. File validation is not an antivirus service; active PDF features are rejected and files are attachment-only. Production malware scanning, storage backup/restore and approved retention policy require a subsequent deployment gate. Default retention is 30 days; revocation immediately blocks application download while retained bytes can be purged only after retention. Failed uploads remain unavailable and can be cleaned up without deleting retained ready files. No new synthetic Auth accounts or password changes are needed for this milestone.
