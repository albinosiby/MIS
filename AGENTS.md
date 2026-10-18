<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Shared domain models and screen validation

Use this structure for every new school screen:

- `src/shared/schemas/`: reusable runtime schemas for school, academic, person and primitive values. Import exact schema files, not a runtime barrel containing every domain.
- `src/shared/models/index.ts`: TypeScript types inferred from shared schemas. Reuse these types across modules rather than defining another School, AcademicYear, Student or Staff shape in a screen.
- `src/features/<module>/schemas/`: screen request, response, form and workflow schemas composed from shared schemas.
- `src/features/<module>/models/index.ts`: schema-inferred feature contracts. Presentation projections must be named/documented as projections, not treated as canonical entities.
- `src/features/<module>/domain/`: framework-independent contextual validation and workflow operations.
- `src/features/<module>/data/`: validated workspace fixtures or actual data adapters; do not declare models inside fixture files.
- `src/features/<module>/components/`: typed component props and presentation; import types from model modules and validate form submissions through feature schemas/domain operations.

Treat API responses and form inputs as unknown until parsed. Keep school and academic-year scope in owned records and check relationship consistency. Schemas do not prove authorisation, custody rights, identity verification or compliance: revalidate in the server mutation and check authenticated permissions when backend services are introduced. Never trust a browser-supplied school ID as proof of access.

Derive types with `z.infer`/`z.input` instead of manually duplicating schema interfaces. Add fields and validation rules only when supported by the feature; reuse the shared summary models rather than inventing complete HR or student databases prematurely. UI-only state can stay in a component; data contracts cannot.

Add meaningful tests for invalid and boundary inputs and contextual ownership checks under `tests/`. Run `npm test`, `npm run typecheck` and `npm run build` for model/schema changes. Keep the supplied design system and page layout intact during contract refactors.
