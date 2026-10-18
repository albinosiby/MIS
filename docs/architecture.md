# School Web Architecture

## Role-based expansion update

The current approved implementation extends the original foundation with role-based local workspace identity, 85 operational workflow screens, teacher/staff/parent/student/driver portals and public previews. See `role-based-workspace.md` and `end-to-end-product-plan.md` for the current architecture, security boundaries and Supabase continuation. Older foundation sections below are historical and do not describe the full current route set.


## Persistent setup milestone update

The eight-step setup workspace now uses a schema-validated feature context backed by `src/shared/data/indexed-db.ts`. Routes `/school-setup/[step]`, `/students` and `/staff` are connected to the same browser-local records. See `setup-milestone.md` for the current architecture and verified scope; the foundation proposal below records earlier decisions and is superseded where it describes in-memory storage or unimplemented setup forms.


## Current scope

The current deliverable is the school web frontend foundation, design system and Setup Wizard interface at `/school-setup`. Its components use the user's Figma frame and locally stored exports; its interactions use in-memory sample data. The product research describes the broader MIS roadmap, not an instruction to implement all modules now. The earlier product proposal remains in `PROJECT_CONTEXT.md`.

Next.js App Router, React, TypeScript and Tailwind are the web stack. Shared primitives follow shadcn conventions, with Radix providing checkbox and switch behaviour. Native inputs and selects preserve browser accessibility and mobile date/picker behaviour. This is a single web application, not a monorepo; introduce separate apps or packages only when a backend/mobile implementation requires them.

## Ownership and dependencies

| Location | Responsibility | Dependency rule |
|---|---|---|
| `src/app` | Routes, page composition, layouts and route boundaries | Import features and shared UI; keep business rules elsewhere |
| `src/features/<module>` | Module screens, workflows, schemas and domain-specific components | Use shared UI; avoid importing another module's internal components |
| `src/components/ui` | Reusable primitives with common states and accessibility | No school data access, routing decisions or feature imports |
| `src/components/layout` | Sidebar, header, page containers and responsive navigation | Implement after inspecting the Figma shell; presentation is not access control |
| `src/lib` | Small shared utilities and, later, isolated server/client integrations | Never put credentials or database imports into browser utilities |
| `src/styles` | Brand and semantic tokens, fonts, global defaults | Components use semantic utilities instead of repeated hex values |
| `public/assets` | Approved local static imagery and icons | No student documents or private uploads |

When a feature needs them, add `components/`, `schemas/`, `server/`, `hooks/` and `types.ts` inside that feature. Do not generate empty service and repository layers in advance. Mark future server integrations with server-only guards. Keep the browser bundle free of secrets and persistence clients.

Models and validation now follow `docs/models-and-validation.md`: shared schemas in `src/shared/schemas`, inferred domain types in `src/shared/models`, and feature contracts in `src/features/<module>/schemas` and `models`. Keep contextual operations in the feature's `domain` folder and validated fixtures in `data`. Do not introduce parallel manual interfaces in components or duplicate shared school/person/year models. This convention takes precedence over the earlier generic `types.ts` suggestion for data contracts.

## First modules and future routes

Routes below are a proposed map, not existing or authenticated endpoints. Confirm exact routes against Figma navigation.

| Module | Proposed route within a future school layout |
|---|---|
| School profile and settings | `/schools/[schoolId]/settings/school` |
| Academic years and terms | `/schools/[schoolId]/academics/years` |
| Grades, sections and subjects | `/schools/[schoolId]/academics/classes`, `/academics/subjects` under the same school |
| Staff directory and allocation | `/schools/[schoolId]/staff` |
| Students and guardians | `/schools/[schoolId]/students` |
| Attendance | `/schools/[schoolId]/attendance` |
| Fees later | `/schools/[schoolId]/fees` |

Use a future `(auth)` route group for authentication and a `(school)` group for the shared school layout. Route groups are organisational only. Do not add fake protected layouts before identity integration exists. URL school IDs must be checked against server-side membership.

## State and data flow

Keep temporary controls local, filters and pagination in URL parameters, and initial authenticated data server rendered when practical. Add a client query cache only for a demonstrated need; all private cache keys must carry school scope. Use minimal client components for interaction. The showcase uses synthetic examples only and stores nothing persistently.

Database schema and APIs are future work, with a conceptual proposal in `PROJECT_CONTEXT.md`. No ORM, gateway, Supabase service, identity provider, mock production API or database migration is introduced by this scaffold. Before implementing live records, confirm identity, permissions, tenancy, enrolment history and validation requirements.

## Delivery and validation

1. Finish the supplied visual foundations and inspect them locally.
2. Connect the user's Figma file and inspect the requested screen and application shell.
3. Confirm spacing, typography scale, responsive behaviour and states.
4. Build school setup, academic setup and staff basics from approved frames.
5. Implement students and guardians, then the attendance workflow.
6. Integrate approved backend contracts and test access boundaries before real data use.

Run type checking and a production build for the foundation. As data workflows arrive, add meaningful domain tests, integration tests for school and guardian access, and end-to-end checks for critical flows. For deployment, decide hosting, CI, identity, logging, backup and rollback ownership before enabling live records. This frontend foundation alone cannot establish production security or MIS feature completeness.

Conventions follow the official [Next.js project structure guide](https://nextjs.org/docs/app/getting-started/project-structure) and [Tailwind Next.js setup](https://tailwindcss.com/docs/installation/framework-guides/nextjs).
