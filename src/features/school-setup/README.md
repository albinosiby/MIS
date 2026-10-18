# School Setup

The Figma overview (`1106:11238`, pipeline `1106:11478`) remains at `/school-setup`. All eight cards link to real `/school-setup/[step]` routes. The separate forms extend the existing Poppins tokens, panels, buttons and fields; separate step-form designs were not present in the retrieved setup context. The `/students` and `/staff` routes are working **setup roster projections**, not completed implementations of the full Student/HR Figma hubs.

## Steps

1. `school-profile`: identity, affiliation, contacts, address, locale/timezone/currency, small local PNG/JPEG logo.
2. `academic-terms`: year name/dates and add/edit/remove terms, with date range and overlap checks.
3. `classes-sections`: add/edit/remove sections and capacities, with existing enrolment/reference protection.
4. `bell-schedule`: teaching periods/breaks with valid, nonoverlapping times.
5. `fee-structure`: annual/quarterly/monthly fee heads, integer minor units, percentage concession and annual preview.
6. `staff-allocations`: add/edit/remove staff and section/subject assignments; every section needs coverage before sign-off.
7. `data-ingestion`: bounded CSV template/upload/paste, atomic preview/import, linked student/guardian records, administrative exception reviews and zero-exception sign-off.
8. `portal-gateway`: portal toggles, explicit simulation acknowledgment and optional simulated invitation entries. No credentials or external invitations are created.

`Save step` validates, persists and signs off the current step; `Save & continue` also navigates. Changed earlier configuration invalidates later sign-offs. Future steps render a locked state even for direct URLs. Back, tabs, overview and browser history use ordinary routes; browser refresh and link navigation warn about unsaved edits. Unsaved drafts themselves are not persisted.

## Data and ownership

Shared schemas/models remain in `src/shared`. Feature contracts are in `schemas` and inferred `models`; pure operations in `domain`; parsed seeds in `data`; persistence context in `hooks`; UI in `components`. `setup-record-directory.tsx` is explicitly a setup-owned projection over shared Student/Guardian/Staff records. Extract a reusable data context when full feature modules replace these auxiliary views; do not import setup presentation internals into those modules.

IndexedDB adapter: `src/shared/data/indexed-db.ts`. Database `school-mis-workspace`, object store `documents`, document `setup-v1`. Version 1 contains one school and one active academic year, 100 seeded students, 100 guardians, 15 staff, ten sections, fees, allocations, reviews, simulated notification history and a bounded 200-entry audit log. Seeded steps 1–6 have valid workspace configuration and are signed off. “Start fresh” retains editable sample records but clears all eight sign-offs. Reset and restore require explicit confirmation.

Reads, mutations and restored JSON are parsed. Data is published to React only after the IndexedDB transaction completes. Revision compare-and-swap rejects stale-tab writes, with reload/retry guidance. Export/import preserves the validated dataset; restoring is limited to the current school/year. Corrupt saved records are not automatically overwritten. Logo data is bounded and limited to PNG/JPEG data URLs; JSON backups are limited to 5 MB; CSV is limited to 1 MB / 500 appended students per import.

All storage is local to this browser **and origin**: port 3000 and port 3002 have separate workspace databases. Use the same origin consistently. Clearing browser data removes the saved workspace; download a JSON backup to keep it. This is not a remote backup service, authentication system, government identity check, digital signature or messaging integration.

## Verification

Run `npm test`, `npm run typecheck`, `npm run build`. See `docs/setup-milestone.md` for the verified journeys, design boundaries and remaining modules.
