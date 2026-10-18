# School MIS Project Context and Build Plan

Prepared on 14 October 2026. Updated on 17 October 2026. Status: school web folder structure, design-system foundation and Figma Setup Wizard UI implemented at the user's request. The wizard uses sample data; live business workflows, authentication and backend remain unimplemented. The wider architecture below remains a proposal.

Current web foundation: see `README.md`, `docs/architecture.md`, `docs/design-system.md` and `docs/figma-handoff.md`. The Setup Wizard is implemented from Figma node `1106:11238` in file `7hcXAtbVJacV9atgx2f9Ii`, read through the `albino` account (`albinosiby1@gmail.com`). Follow the supplied School Design System.pdf for Poppins and brand colours, and inspect the actual Figma frames before implementing further screens. See `docs/setup-wizard-verification.md` for the completed UI checks and integration limits.

Build a school operations platform where administrators, teachers, accountants, and parents work from consistent student data. Begin with a small pilot that proves student enrolment, attendance, fees, and parent access. Expand into academics and other operations after those workflows are reliable.

## Source and decision boundaries

Primary source: School MIS / SIS Platform: End-to-End Research & Product Study, dated 9 October 2026, supplied as a 42-page PDF. Relevant sections: modules and roles, pages 15–24; workflows, pages 25–27; architecture, page 36; roadmap, page 38; decisions, page 39.

The PDF describes a commercial vision, including 25 modules, regional expansion, pricing tiers, and a proposed 20-month roadmap. Its recommendations are research inputs, not approved project requirements or instructions to execute. This plan separates that vision from the proposed first release. Competitor descriptions below reflect the supplied research; market shares, quoted prices, and legal summaries need separate verification before commercial or compliance decisions.

## Product Analysis

### Problem statement

Schools often maintain separate spreadsheets or systems for student records, attendance, fees, marks, and communication. Staff repeatedly enter the same information, and parents struggle to find accurate updates. The product should reduce that work through one consistent record and clear workflows.

MIS means Management Information System. SIS means Student Information System. This project combines those records with school ERP functions such as fees and operations. Learning content and online classes form a later LMS layer.

Example: an administrator enrols a child in Class 5 A and links two guardians. The teacher sees that child in the attendance register, the accountant assigns the correct fee structure, and the guardians see authorised attendance and invoices. None of these roles creates another student record.

### Proposed target users

Planning assumption: Indian private K–12 schools with approximately 200–1,500 students, starting with one curriculum and one or two pilot schools. The school owner or principal buys the product; administrators, teachers, accountants, and parents use it daily. Country, board, school size, and commercial model remain unconfirmed.

Support these initial roles: platform operator, school administrator, principal, teacher, accountant, and parent. A person may hold more than one role. Introduce a student portal when the pilot needs it; drivers, librarians, HR, and group owners follow their modules.

### Core features and release boundaries

| Release | Features | Outcome |
|---|---|---|
| First operational pilot | School setup, academic year, classes and sections, staff access, students and guardians, validated CSV import, daily attendance, parent attendance view, fee invoices, counter payments, receipts, notices, audit and basic reports | A school can use the system for daily administration |
| Completion of initial MVP | One online payment gateway, reconciliation, homework, manual timetable with conflicts, exams, marks, approved report cards, basic admissions and year rollover | A school can cover the agreed academic and fee cycle |
| Later modules | Admissions CRM, transport, library, HR leave, payroll, hostel, inventory, canteen, richer communication, LMS, AI, group reporting and regional integrations | Broader ERP product after pilot validation |

A responsive web application is the proposed pilot delivery. Native parent and teacher apps are a separate scope decision; the PDF includes them in its broader MVP. If app-store delivery or offline attendance is a pilot requirement, include it in the estimate before approval.

### Competitor analysis and positioning

The research positions Fedena, Entab, Teachmint, and MyClassboard among Indian ERP alternatives; Arbor, Alma, and Sycamore illustrate modern MIS approaches; PowerSchool, SIMS, and other incumbents illustrate mature reporting depth. These are research comparisons, not independently verified rankings.

Compete initially through easy migration, fast attendance entry, accurate fee balances, understandable parent access, and responsive support. Demonstrate those benefits with pilot schools before selecting pricing. Subscription income must cover hosting, migration, support, messaging, and payment costs. Defer the proposed free tier until those costs are understood.

### Risks and challenges

The largest product risk is excessive scope. Twenty-five modules, multiple curricula, native apps, and several countries cannot be treated as one first release. Data migration, term-specific report cards, financial correctness, parent adoption, and support effort can each delay launch. Schools also have seasonal switching windows.

Children's records and family relationships require strict access controls. Incorrect tenant access or duplicate payment handling is more serious than a cosmetic defect. Validate country-specific legal duties, payment arrangements, and school policies before processing real data; this plan does not adopt the PDF's legal summaries as compliance conclusions.

## System Architecture

### Proposed architecture and technology

Use a modular monolith: one API application with separate business modules and background workers. This keeps transactions and deployment manageable while allowing later extraction of a module when measured workload justifies it.

| Layer | Proposed choice | Purpose |
|---|---|---|
| Web | Next.js and TypeScript | Responsive administrator, teacher, and parent experiences |
| API | NestJS and TypeScript | Explicit module boundaries, validation and business workflows |
| Database | PostgreSQL | Relationships, constraints, financial transactions and tenant policies |
| Background processing | Worker with a durable job queue; Redis if the chosen queue requires it | Imports, reminders, receipts and report generation |
| Documents | Private S3-compatible storage | Restricted attachments, generated reports and receipts |
| Identity | Established authentication provider or maintained library | Sessions, password recovery and MFA; provider selected before implementation |
| Mobile later | Flutter or React Native, selected according to team skills | Native apps when approved requirements justify them |

NestJS documents its module structure in its [official module guide](https://docs.nestjs.com/modules). For web identity, follow the distinctions between authentication, sessions, and authorisation in the [Next.js authentication guide](https://nextjs.org/docs/app/guides/authentication). These sources support implementation patterns; the stack selection is a proposal for this project.

Do not add a search cluster, event bus, analytics warehouse, or vector database to the pilot without a demonstrated need. PostgreSQL queries and indexes should cover initial directories and operational reports.

### Tenant boundaries

One school is one tenant. A campus is a location within a school; a future group can own several school tenants. The initial service can share infrastructure and database tables while preserving school isolation. This is distinct from providing a dedicated deployment per school.

Every school-owned record carries `tenant_id`. Enforce tenant ownership in both the application and database. Composite foreign keys prevent a record in one school from referencing a class, student, or invoice in another. Apply equivalent restrictions to workers, file storage, exports, caches and support tools.

PostgreSQL RLS can express relationship checks as well as tenant checks, but policy design must remain explicit. Owners, superusers, and roles with `BYPASSRLS` can bypass normal RLS protections; run the application using a restricted role and review policies in tests. See the [PostgreSQL row security documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html).

### Data flow

The web client sends a request through the API. The API verifies identity, school membership, role, and record relationships; validates input; and applies a business transaction. The database stores changes and an audit entry. For notifications, the transaction also writes an outbox event, which a worker processes with retry and deduplication. External delivery failure must not undo valid attendance or payment records.

### Authentication flow

A user signs in and receives a protected session. The server resolves their authorised school memberships. They select a school if necessary; the server validates the selected school on every request. It then checks permission and relationship scope, such as a teacher's class assignment or a parent's active link to a child. A role name alone does not grant access to every record.

Use MFA for administrator and finance access. Parent invitations must link an account to a verified guardian relationship; matching a phone number alone must not grant child access. OTP login is optional pending provider cost and abuse controls. Support access should be explicitly granted, time limited and audited.

### Scalability considerations

Expect peaks at morning attendance, fee deadlines and result publication. Use pagination, indexed queries, connection pooling, bounded jobs and per-school rate limits. Keep request handlers stateless; scale API and workers separately. Cache keys include tenant and relevant permissions. Add specialised reporting storage or dedicated tenant databases only after measuring load or establishing a contractual need.

## Database Design

### Proposed schema and relationships

Separate identity from school records. A global login account can have multiple school memberships; student and guardian person records stay school scoped. Do not deduplicate sensitive profiles across unrelated schools. Future cross-school parent access comes from verified links under the same login.

| Domain | Tables and relationships |
|---|---|
| Platform and access | `tenants`, optional `groups`, `users`, `memberships`, `roles`, `permissions`, `role_permissions`, scoped role assignments |
| Academic setup | `academic_years`, `terms`, `campuses`, `grades`, `sections`, `subjects`, `class_subjects` |
| People | `persons`, `students`, `staff`, `guardian_links`, `user_person_links`; role records reference a person; guardian links join guardian and child with permitted actions |
| Enrolment | `enrolments`, `class_placements`, `teacher_assignments`; enrolment references a student and year; dated placements preserve class changes |
| Attendance | `attendance_sessions`, `attendance_entries`, `attendance_changes`; entries reference enrolment and a dated session |
| Fees | `fee_heads`, `fee_structure_versions`, `fee_assignments`, `invoices`, `invoice_lines`, `payments`, `payment_allocations`, `refunds`, `receipts`, `journal_entries`, `journal_lines`, `gateway_events` |
| Academic work | `timetable_entries`, `homework`, `assessments`, `assessment_subjects`, `marks`, `grading_scale_versions`, `report_card_versions` |
| Communication and operations | `notices`, recipient records, `notification_deliveries`, `documents`, `consent_records`, `import_jobs`, `import_errors`, `outbox_events`, `audit_events` |

A student keeps a stable student ID across academic years. Each year creates an enrolment rather than overwriting history. Guardian relationships are many-to-many, supporting siblings and multiple adults with different rights. Medical and counselling data require a separate restricted domain when introduced.

### Indexing and validation

Use tenant-leading indexes matching actual filters: students by school and admission number; enrolments by year and class; attendance by session and enrolment; invoices by student, status and due date; audits by school and timestamp. Add uniqueness for school admission numbers, attendance entries per session/enrolment, receipt sequences, and external payment event IDs.

Use fixed-precision decimal amounts or integer minor units, with explicit currency; never floating-point money. Payment allocations cannot exceed available payment value. Posted journal entries must balance and be corrected by reversal, not silent edits. Gateway success is established by verified server events and reconciliation, not a browser redirect.

Validate required fields, relationships, dates, school year boundaries, mark ranges and timetable overlaps. Distinguish absent, exempt and not-entered marks from zero. Store UTC instants while interpreting school dates using the tenant's timezone. Imports provide row-level errors and require review before committing; similar names alone must not cause automatic merging.

Use optimistic concurrency for editable registers and marks. Preserve class transfer history, published report versions, fee versions and audit history. Deletion and retention policies differ between operational records, documents and financial records; decide them before go-live.

## API Design

### Proposed endpoints

All endpoints below are design contracts, not implemented services. Use versioned APIs, pagination and documented permission requirements.

| Endpoint | Purpose and access |
|---|---|
| `GET /v1/me/memberships` | Signed-in user's available schools |
| `POST /v1/schools/{schoolId}/academic-years` | Administrator creates a year |
| `GET/POST /v1/schools/{schoolId}/students` | Authorised directory read or student creation |
| `POST /v1/schools/{schoolId}/imports/students` | Administrator submits a validated import job |
| `POST /v1/schools/{schoolId}/enrolments` | Administrator enrols a student |
| `PUT /v1/schools/{schoolId}/attendance-sessions/{sessionId}/entries` | Assigned teacher or authorised administrator saves a register |
| `GET /v1/parent/children` | Parent's verified child links |
| `GET /v1/schools/{schoolId}/students/{studentId}/attendance` | Authorised staff or linked parent reads attendance |
| `POST /v1/schools/{schoolId}/invoices` | Finance role issues an invoice |
| `POST /v1/schools/{schoolId}/payments/counter` | Finance role records a counter payment |
| `POST /v1/schools/{schoolId}/invoices/{invoiceId}/checkout` | Authorised payer starts hosted checkout |
| `POST /v1/webhooks/payments/{provider}` | Provider event; signature validation and duplicate detection |
| `POST /v1/schools/{schoolId}/notices` | Authorised staff publishes a scoped notice |
| `PUT /v1/schools/{schoolId}/assessments/{assessmentId}/marks` | Assigned teacher saves draft marks |
| `POST /v1/schools/{schoolId}/assessments/{assessmentId}/publish` | Authorised reviewer publishes approved results |

### Request and response examples

Attendance save request: `{ "expectedVersion": 3, "entries": [{ "enrolmentId": "enr_123", "status": "absent", "reason": null }] }`.

Successful response: `{ "sessionId": "att_123", "version": 4, "savedCount": 1, "notificationStatus": "queued" }`.

Validation error: `{ "error": { "code": "INVALID_ATTENDANCE_ENTRY", "message": "Student is not enrolled in this class on this date", "requestId": "req_123" } }`.

### Authentication and errors

Require a valid session or token for user APIs, then validate membership and object permissions. Reject untrusted tenant values rather than trusting URL or request fields. Webhooks use provider verification instead of user login.

Use 400 for malformed requests, 401 for missing identity, 403 for denied operations, 404 where needed to avoid revealing inaccessible objects, 409 for concurrent edits or conflicting state, 422 for field validation, and 429 for throttling. Errors include safe messages and request IDs. Financial creation endpoints use idempotency keys; keys are scoped to tenant and operation and cannot be reused with different payloads.

## Frontend Design

### Screen list and user flow

| Persona | First screens |
|---|---|
| Administrator | Login, setup wizard, users and roles, student directory, student profile, guardian linking, import review, class setup, daily attendance summary, notices, audit and export |
| Teacher | Today, assigned classes, attendance register, homework, timetable, draft marks |
| Accountant | Fee setup, invoices, counter collection, receipts, dues, payment events and reconciliation |
| Parent | Child switcher, attendance calendar, notices, invoices and receipts; later homework, timetable and published report cards |
| Platform operator | School list, provisioning, service status and audited support access |

First complete flow: create school → configure year and class → enrol student → link guardian → invite teacher and parent → teacher saves attendance → parent sees the correct attendance → principal sees accurate totals.

Second flow: assign fee structure → issue invoice → record payment → allocate amount → generate receipt → show remaining balance to parent and accountant. Prove these flows before expanding the dashboard.

### Component structure and state

Organise frontend features by domain: school setup, people, enrolment, attendance, fees, academics and communication. Share accessible form controls, tables, pagination, status badges, file upload, date selection and error states. Business rules live in domain services on the server; screens call those services through documented APIs.

Separate server data from transient form and UI state. Cache keys include the active school, year and resource. Clear sensitive caches on logout or school switching. Handle loading, empty, denied, failed and conflicting states. Prioritise fast mobile attendance and parent views, keyboard-friendly marks entry, and screen-reader access. Offline edits need an explicitly designed conflict policy if included.

## Development Plan

### Where to start

Begin with a real pilot school's workflow and anonymised examples: student register, class structure, attendance register, fee schedule, receipts and report card. Confirm roles and guardian permissions. Approve the first release scope, conceptual schema and three prototype flows before coding.

The first implementation milestone after approval is school setup and identity followed by students, guardians and enrolment. Then deliver the attendance flow end to end. A dashboard depends on those reliable records and should follow them.

### Proposed sprint breakdown

Estimates assume two experienced developers working full time, with part-time design and QA, an available pilot school, and a responsive web release. They are planning ranges rather than commitments. A solo developer should expect a substantially longer schedule and reduce scope.

| Milestone | Approximate duration | Exit criteria |
|---|---|---|
| Discovery and design approval | 1–2 weeks | Pilot scope, sample workflows, permissions, data model and screen prototypes agreed |
| Sprint 1 foundations | 2 weeks | Environments, auth, tenant boundaries, memberships, school settings and audit available |
| Sprint 2 student records | 2 weeks | Classes, student and guardian records, enrolment and import validation work |
| Sprint 3 attendance | 2 weeks | Assigned teacher saves attendance; linked parent views it; principal totals agree |
| Sprints 4–5 fees | 4 weeks | Invoices, counter collection, allocations, receipts, dues and agreed online gateway flow work |
| Sprint 6 parent access and notices | 2 weeks | Invitations, child switcher, notices and agreed notification channel work |
| Pilot readiness | 2–4 weeks | Migration rehearsal, isolation checks, restore drill, training and defect fixes complete |
| Academic MVP extension | 6–10 weeks | Manual timetable, homework, marks, report-card approval and rollover accepted |

Allow approximately 15–18 weeks for this proposed operational pilot, then 6–10 more weeks for the academic extension. Native apps, offline sync, broader compliance, unfamiliar tools or delayed provider onboarding add work. Re-estimate after discovery. The PDF's roadmap targets a much broader product over 20 months and does not establish this team's delivery capacity.

### Priority and success measures

Priority order: validate scope → enforce identity and school isolation → establish student records → attendance → fees → parent communication → academics → additional modules.

Track time to import and enrol the first class, time to complete attendance, percentage of classes marked, parent activation, fee ledger discrepancies, notification failures and support effort. Proposed pilot gates: no unresolved tenant-access or financial-integrity defects; agreed teacher tasks completed on actual devices; documented import totals match the source; successful backup recovery; school sign-off on invoices and report templates. Set performance thresholds with the pilot rather than treating research targets as achieved results.

## Security

Authentication uses maintained identity tooling, secure session handling, administrator MFA, rate limits and controlled recovery. Authorisation checks role, school membership, class assignment and guardian relationship at every entry point. Use least privilege for the API, workers, database and support staff.

Protect data with TLS, encrypted storage, private document buckets, short-lived authorised file links and managed secrets. Avoid sensitive student fields, tokens and documents in application logs. Audit sensitive changes and restricted record access. Revoke guardian access when relationships change; handle custody restrictions without assuming all guardians have equal rights.

Use hosted gateway checkout and avoid collecting card credentials. Validate file size and type, scan uploads, prevent spreadsheet formula injection in exports, and test input handling. Establish retention, consent, export and incident procedures appropriate to the approved launch region. Keep medical, counselling and biometric collection outside the first pilot unless a justified requirement and access model are approved.

## Testing

### Test strategy and required cases

| Test level | Meaningful cases |
|---|---|
| Unit | Fee allocations and rounding; grade boundaries; date and year rules; role and relationship decisions |
| Integration | Tenant restrictions with the actual restricted database role; cross-school foreign keys; transactional audit/outbox writes; CSV validation; payment event deduplication |
| End to end | School setup to enrolment; teacher attendance to parent view; invoice to receipt; draft marks to approved report card |
| Security | Parent changes child ID; teacher accesses another class; revoked membership uses an old session; export and file links attempt cross-school access |
| Reliability | Duplicate and out-of-order gateway events; retries do not duplicate receipts or alerts; concurrent register edits conflict safely; worker restarts recover jobs |
| Acceptance and performance | Representative import volume; attendance on school devices and connectivity; report publication load; real template review; keyboard and mobile accessibility |

Include siblings with different guardians, class transfer midyear, withdrawn student, partial payment, refund, reversed counter entry, school timezone boundary, absent versus zero marks, and rollover carrying balances without changing prior-year records. Use synthetic data in automated tests. Perform a restore drill before go-live.

## DevOps

Use separate development, staging and production environments. Deploy the web app, API and workers with managed PostgreSQL and private storage in a region selected for the launch requirements. Start with a simple container or managed application deployment; Kubernetes is not an initial requirement.

CI/CD should run linting, type checks, relevant tests, dependency and secret checks, and build verification. Apply reviewed migrations with a backup and rollback or forward-repair plan. Prefer backward-compatible schema changes. Seed development with synthetic schools rather than production records.

Monitor API latency, error rates, database utilisation, queue age, failed imports, rejected provider events, undelivered messages and reconciliation discrepancies. Correlate requests using request IDs while minimising personal data. Configure alerts for actionable failures.

Back up database and documents, use point-in-time recovery where available, and document disaster and tenant-specific recovery procedures. Proposed pilot recovery targets are RPO at most one hour and RTO at most four hours, subject to service capability, cost and demonstrated restore performance. They are design targets, not promised SLAs.

## Documentation

The setup guide should cover runtime versions, environment variables, identity configuration, database migrations, synthetic seed data, storage and worker setup, test execution and provider sandbox configuration. Pin versions during implementation after compatibility checks.

Publish API documentation from an OpenAPI contract, including permissions, errors, pagination, idempotency and webhook behaviour. Maintain architecture decisions for tenancy, identity, school year history and financial accounting.

Provide role-based user guides for importing students, linking guardians, marking attendance, invoicing, counter collection, reconciliation, publishing reports and rollover. Add operating runbooks for failed notifications, disputed payments, access revocation, support access, migration rehearsal, backups and incidents.

## Decisions needed before implementation

1. Is this a SaaS product for multiple schools, or a bespoke system for one school?
2. Which country, curriculum and pilot school size define the first release?
3. How many developers are available, what is the budget, and is there a fixed launch date?
4. Is a responsive web pilot acceptable, or are native apps and offline attendance required at launch?
5. Which workflows must launch together: attendance and fees first, or exams and report cards too?
6. Which payment, messaging and identity providers can the business onboard?

Recommended approval scope: multi-school SaaS foundation, one launch region and curriculum, responsive web pilot, student and guardian records, attendance, fee workflows and parent notices. Approve or revise this scope and architecture before generating application code, as required by the project instructions.
