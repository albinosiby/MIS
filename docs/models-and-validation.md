# Shared Models and Screen Validation

## Persistent setup extension

The wizard now also composes `setup-config.schema.ts`: saved school/calendar, branding, sections, bells, fee heads, staff allocations, student/guardian links, reviews, portal configuration, audit and simulated notification history. Shared operational student and guardian schemas live in `src/shared/schemas/school-records.ts`. Ordered completion, referential ownership, capacity, slot overlaps and imports are validated by pure domain operations. All eight forms and browser persistence are implemented; see `setup-milestone.md` and the feature README. This update supersedes earlier statements below about forms and persistence being future work.


Shared runtime schemas live in `src/shared/schemas`. Their TypeScript models are inferred and exported from `src/shared/models/index.ts`. Shared objects currently cover school profiles and addresses, academic years and terms, class sections, minimal person/student/guardian/staff summaries, guardian relationships, identifiers, dates, counts, contact formats, timezones and money in integer minor units.

These are application contracts, not database tables or a completed authentication system. Person summaries deliberately omit sensitive medical, identity and payroll fields. Currency and country values currently validate code shape; region-specific business rules need explicit curriculum/country requirements. School contact and calendar fixture fields not present in Figma are explicitly synthetic sample configuration.

## Feature structure

```text
src/shared/
  models/index.ts
  schemas/
    primitives.ts
    school.ts
    academics.ts
    people.ts

src/features/school-setup/
  models/index.ts
  schemas/setup-wizard.schema.ts
  domain/review-exception.ts
  data/setup-preview.ts
  components/
  styles/
```

Use the same feature directories when another screen needs them. Reuse shared SchoolProfile, AcademicYear, StaffSummary and other domain models. Compose feature-specific requests and projections rather than recreating shared entity definitions per screen. Types come from the schemas using `z.infer`; inputs with normalisation can use `z.input`. Add future full student/HR models when those workflows are designed, while preserving summary contracts used by directories.

## Wizard contracts

The wizard has schemas and inferred models for its ordered pipeline, phase status, exception rows, review payload, search/pagination, batch-notification selection, KPI summary, compliance display, signing-authority summary, snapshot summary and combined screen snapshot.

The exception row is a **screen projection**: its student/guardian strings, badges, action label and local image reference are presentation data, not canonical person records. The authority reuses StaffSummary and the preview context reuses SchoolProfile and AcademicCalendar. No schema claims that a displayed compliance indicator or token is verified.

Phase keys are stable IDs. A pipeline must contain all eight phases in prerequisite order, with a completed prefix, at most one running phase and locked successors, or all phases completed. Components render status from these models rather than positional checks. Summary percentages must be between zero and 100, counts must be nonnegative integers and validated students cannot exceed the total. The source design's 72% completion value is an independent sample KPI, not calculated from completed phase count.

Terms must belong to the calendar's school and year, remain inside the year, have unique IDs and not overlap. Dates are ISO local dates; adjacent terms cannot share an inclusive end/start date. Financial amounts use safe integer minor units. School settings validate required names, email/phone formats, locale and timezone.

The combined wizard snapshot checks duplicate IDs and school/year consistency. Arrays are bounded for this client snapshot; future server pagination requires its own response contract rather than loading an entire school's records into the browser.

## Validation boundaries

Fixtures are parsed on creation. Validate API responses at the future adapter boundary and validate mutations on the server using the same shared and feature schemas. For user forms, use `safeParse` and show safe field errors; do not log sensitive input or display raw payloads in errors.

The review form now validates through `reviewException`, trims the note, requires 8–500 characters after trimming, rejects unknown fields and checks that the target record belongs to the current school and year. Empty, whitespace-only, stale, cross-school and cross-year submissions cannot remove a preview row. Errors are associated with the note through `aria-describedby` and announced with `role=alert`.

Search and pagination validate through the query contract. Batch selection rejects empty, duplicate or oversized ID lists. Before a real notification is sent, the server must also verify each selected record's membership, recipient permissions, provider consent and delivery policy. Schema-valid identifiers alone do not grant permission.

The preview validation button parses the current wizard snapshot; it does not contact a government service, verify Aadhaar, or authorise a rollover. Full setup forms and backend configuration for the eight phases remain future work; the current contracts cover data presented and actions available on this screen.

## Verification

Run `npm test`, `npm run typecheck` and `npm run build`. All 12 automated tests, type checking and the production build passed for this change. Domain tests cover dates, calendar ranges and ownership, profile formats, money boundaries, pipeline progression, summary bounds, note normalisation, stale/cross-school review attempts, query bounds, batch selection and snapshot consistency. Browser verification of the updated error presentation was blocked by the app browser's URL security policy; invalid and valid review payloads are covered by automated domain tests. No database or live integration tests are claimed.

Schema composition follows the official [Zod API](https://zod.dev/api). The dependency version is pinned in the package manifest and lockfile. Repository instructions in `AGENTS.md` preserve these conventions for upcoming screens.
