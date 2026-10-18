# Connected workflow contracts

All school mutation endpoints require an authenticated, active school membership and selected role context. The server derives school identity from that membership. A supplied school ID is a record scope to validate, never an access grant.

## Typed workflows

`POST /api/workflows` accepts same-origin JSON up to 200 KB:

```json
{
  "expectedRevision": 42,
  "yearId": "ay-2026-27",
  "command": {
    "type": "admission-progress",
    "input": { "id": "application-id", "stage": "assessment" }
  }
}
```

The response is `{ "ok": true, "data": <permitted workspace projection> }`. Treat it as unknown until parsed with the feature/cloud response schema. Stale writes require a fresh workspace; do not replay non-idempotent actions blindly. Form/schema failures return 400; unavailable actions and permission/state failures return 403 with a bounded generic response. Server actions provide the corresponding validated workflow result.

Additional commands include `admission-save`, `student-enrol` and `year-rollover`. Admission editing cannot change stage/student ownership. Enrolment requires a valid unexpired offer and a ready private application file when school policy requires documents. Direct enrolment without an application is unavailable under that policy. Imported existing rosters are a separate administrator workflow.

`{ "type": "workflow", "input": { "action": "website-publish", "input": { "label": "Term website update" } } }` creates an immutable website release from prepared published CMS records. `website-select` with an existing release ID restores it; a null ID withdraws CMS content. School administrators alone may use these actions. No custom-domain/hosting deployment is implied.

## Admissions, examination and timetable lifecycle commands

Additional `workflow` actions follow the same revision and permission boundary:

| Action | Input | Authority/effect |
| --- | --- | --- |
| `admission-continuation` | studentId, decision (promote/retain/transfer), targetClassId, note | Administrator; saves intent, rollover directive and immutable decision history. |
| `admission-withdrawal` | studentId, date, note, feeTreatment (retain-balance/void-uncollected) | Administrator; operational clearance, dated exit, explicit invoice treatment and canonical accounting effects. |
| `result-moderation-request` | examId, studentId, subjectId, proposedMarks, reason, optional sourceOperationId | Allocated teacher/administrator; captures the entered mark for independent review before issue. |
| `result-review-request` | publicationId, subjectId, proposedMarks, reason, optional sourceOperationId | Allocated teacher/administrator; current report/version only. |
| `result-review-decide` | id, decision (approved/rejected), note | Different administrator; updates exact mark, closes linked request, and versions/revokes reports where already issued. |
| `timetable-publish` | optional classSectionId | Administrator; publishes the selected class drafts or all working slots and saves a full published snapshot. Unselected class drafts remain drafts. No cover is implicitly published. |
| `substitution-request` | slotId, date, substituteStaffId, reason | Slot teacher/administrator; creates a submitted review after date/leave/clash checks. |
| `substitution-decide` | id, decision (approved/rejected/published/cancelled), note | Administrator; separate approval followed by explicit publication, with cancellation/history retained. |

`results-publish` additionally accepts `publishedScaleIds` and nullable `templateId`; selected published content is snapshotted. Invitation preparation is a separate authenticated server action at `/admissions/completion`; it validates enrolled application/person/contact/guardian authority, checks role restrictions, and returns a one-use private invitation without sending provider email. Ordinary account activation cannot bypass pending acceptance.

## Private application document upload

`POST /api/documents` accepts bounded multipart form data:

- `yearId`, `ownerType=admission`, `ownerId=<saved application ID>`
- `category=identity` or `general`
- One `file` in a supported PDF, PNG or JPEG format, up to 5 MB.

A successful upload returns 201 and a permitted file summary without its Storage path, checksum or uploader ID. Pending bytes are never downloadable. Replacement uploads keep versions/history. Required-file checks consult ready private Storage metadata, not a browser checklist or filename.

Before enrolment only permitted school administrators can access application files. After enrolment, linked families can read identity files for their student; they cannot write application files or read general application files. Historical file reads consult current custody/teacher assignments, not only archived relationships. Unsupported active/object-stream PDFs are rejected; these format checks are not a malware scanning service.

`GET /api/documents?year=...` pages authorized summaries. `GET /api/documents/:id` rechecks access and status before downloading. Lifecycle POST actions are `resume`, `discard`, `revoke`, and retention-gated `purge`; browser-supplied metadata never grants permission.

## Issued documents

`GET /api/publications?year=...&search=...&offset=0` returns permitted metadata, including detached revocation status. Protected PDF/XLSX downloads use `/api/publications/:id?year=...&format=pdf`. Revoked snapshots are omitted from workspace responses and their downloads are denied. Revocation does not rewrite issued/archived contents.

A same-origin POST to `/api/publications/:id` with `{ "yearId": "...", "reason": "..." }` records an administrator revocation. The database serializes that revocation with canonical commits and rejects new transcripts whose source results have been revoked.

## Operational limits

The existing canonical workspace document and full administrator projection remain bounded transitional architecture. Production scale requires more relational repositories, paged feature reads and removal of remaining full-workspace compatibility mutations. Schema maximums and a successful small-school test do not demonstrate high-volume performance. The current workflow state retains snapshots; large publication/release histories need external immutable storage/repositories before those limits are approached.

## Operational finance commands (18 October 2026)

`POST /api/workflows` continues to require same-origin JSON, authenticated membership, `expectedRevision`, `yearId` and a typed `command`. Stale revisions return **409**; invalid contracts **400**; forbidden/unavailable workflows **403**. Clients must reload the canonical revision before retrying a conflict. Request bodies are capped at 200 KB.

New finance workflow actions: `service-charge`, `library-fine-bill`, `bank-import`, `bank-match`, `bank-unmatch`, `bank-void`, `bank-close`. These map to the billing capability and require admin, principal or accountant permissions in addition to domain scope checks. Bank imports are bounded to 300 lines and do not create monetary transactions.

```json
{
  "expectedRevision": 123,
  "yearId": "ay-2026-27",
  "command": {
    "type": "workflow",
    "input": {
      "action": "bank-import",
      "input": {
        "account": "School bank",
        "from": "2026-10-01",
        "to": "2026-10-01",
        "openingMinor": 0,
        "closingMinor": 150000,
        "lines": [{"date":"2026-10-01","reference":"BANK-REF-001","amountMinor":150000}]
      }
    }
  }
}
```

`bank-match` accepts `{statementId,lineId,journalId}`; `bank-unmatch` accepts `{statementId,lineId,reason}`; `bank-void` accepts `{statementId,reason}`; `bank-close` accepts `{statementId}`. IDs must belong to the chosen school/year. Actor IDs, timestamps, numbering and correction metadata are generated on the server. Closure requires an independent finance reviewer, full statement/book matching and agreement with the opening ledger balance. Closed statements and their bank periods cannot be rewritten.

`service-charge` accepts `{allocationId,month,amountMinor,issuedOn,dueDate}`; the active hostel/transport allocation determines student ownership. `library-fine-bill` accepts `{id}` for an outstanding historical fine without an existing invoice.

New `operation-save` kinds reuse the existing canonical scoped operation envelope: `transport-allocations` (route/stop/date range), `purchase-receipts` (order/quantity/delivery reference) and `purchase-payments` (order/amount/bank reference). Contextual validation checks relationships, lifecycles and remaining quantities/liabilities. Posting a delivery derives stock and payable journals atomically; recording an offline vendor payment derives its Bank journal. It never executes a bank transfer.

`operation-respond` also accepts parent responses to pending linked outpasses. Only an authenticated parent/guardian relationship with current record access may respond; students cannot grant guardian approval. School staff still verify authority and approve departure separately.
