# Runtime, delivery and recovery

## Processes

Use Node 24 and `npm ci`. For local development run `npm run dev -- --port 3000`; this selects webpack because the current Turbopack development session repeatedly refreshed during workspace loading. Build with `npm run build`, then run the web server with `npm start -- --port 3000`. Run `npm run worker` as a separate supervised process with the same server environment. A browser is not required for scheduled notices, absence alerts, private-message delivery or scheduled report generation. A local terminal worker stops when its host or terminal stops; production needs a host service/container with automatic restart.

Restart the worker when deploying workspace model/schema changes. A long-running Node process keeps its imported validators; deploying the web server alone can leave it unable to read newly saved fields. Verify a queue claim after restarting. Run revision-sensitive verification probes serially with mutation suites: another suite changing the school revision invalidates a probe that intentionally asserts no revision changed.

Keep the Supabase server secret and session signing secret in the host secret store. Never expose the server secret as a `NEXT_PUBLIC_` variable, commit `.env.local`, or put credentials into a health endpoint. The worker requires the database server secret but does not need a user's password. Keep the service role out of client bundles.

The durable job console shows persisted failures, retries, blocked jobs and attempt history. Investigate repeated failures before retrying. A five-minute lease protects claims; expired work is recoverable, with attempt audit. Idempotent source keys prevent repeat financial/report effects. Cancellation is a recorded decision, not an invitation to restart the same job silently.

External delivery and payment providers remain unconfigured. In-app completion is not evidence of an email, SMS, WhatsApp, push notification, card collection or bank settlement.

## Checks before deployment

Run `npm test`, `npm run typecheck`, `npm run build` and `npm audit --omit=dev`. CI runs those checks without database secrets. Connected verification scripts are deliberately separate from CI: they use the five authorized synthetic accounts and add clearly labelled verification records to the configured synthetic school. Do not run them against a production school.

Use `node scripts/verify-connected-workflows.ts`, `node scripts/verify-learning-live.ts` and `node scripts/verify-job-leases.ts` and `node scripts/verify-worker-runtime.ts` only against their checked target project. Verify script filenames before running. No permission grants, factor enrollment or credential changes are required by these checks. Read-only MFA status checks do not prove enrollment/recovery usability.

Run Supabase migrations through the linked CLI, review `db push --dry-run`, then apply the exact reviewed migration. Never edit an already applied migration. Keep an off-host copy of migration files and pin runtime/dependency versions.

## Backup scope

A JSON workspace export alone is **not a full backup**. A complete recovery set must cover:

- Database application schemas, including `mis_private` canonical documents, audit, service projections, role grants/restrictions, jobs, attempts and revocation registries.
- Auth users and identities through supported Supabase recovery tools; existing IDs must be preserved.
- Private Storage object bytes **and** their database metadata, paths, versions and checksums. A database backup does not by itself provide object bytes.
- Secrets, DNS/hosting configuration and external provider configuration through separate controlled stores.

Choose and document RPO/RTO and retention before production launch. Enable the appropriate managed database backup/PITR plan and separately protect Storage bytes. This repository has not demonstrated a full disaster recovery restore.

## Restore drill

1. Create an isolated recovery project; never rehearse over the live project.
2. Restore the database and Auth with supported platform tooling, preserving identities. Restore private Storage bytes into private buckets with the original paths.
3. Apply only migrations newer than the restored database. Compare migration history and the indexed mirrors against canonical records.
4. Keep the worker and all external providers stopped until references, scope, revocation and permissions are verified. Restored queued work can otherwise redeliver old messages.
5. Validate sample private files by checksum, denied cross-role downloads, issued/revoked certificates, student/staff IDs, balanced journals and revision conflicts.
6. Check current employment and role grants, school context selection, MFA challenge and session revocation with dedicated recovery accounts.
7. Record the measured restore time, backup age and discrepancies. Approve cutover only after that evidence is complete.

Do not describe this drill as passed until it has actually run. Do not grant platform access or weaken MFA merely to pass a recovery check.
