# School Admin Web

School MIS workspace with eight setup steps and 60 connected workspace routes across 11 modules. Shared models, Zod validation, Poppins design tokens and IndexedDB persistence support the same student, staff, academic and finance records across screens.

## Platform administration

See [platform administration and fresh-school registration](docs/platform-admin-guide.md) for first-admin bootstrap, institution onboarding, user management and manual support follow-up.

## Run locally

For hosted deployment, follow [Railway deployment](docs/railway-deployment.md). The prepared configuration runs a web service and a continuous worker against the existing Supabase database, with deployment environment checks and a public health endpoint.

Use Node.js 24 and npm. Dependencies are pinned in `package.json` and `package-lock.json`.

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:3000/school-setup`. The home route redirects there. The component catalogue remains available at `/design-system`. Poppins is bundled through Fontsource; no external font request or API key is required.

If Turbopack is blocked in your sandbox, run `npm run dev -- --webpack`.

```sh
npm run typecheck
npm test
npm run build
npm start
```

The build script uses Next.js's supported Webpack option. Type checking and production compilation pass. The wizard has been visually reviewed at a 1440px desktop viewport and checked at 375px and 491px mobile widths. See `docs/setup-wizard-verification.md` for checks and limitations.

The wizard now has eight linked setup forms with IndexedDB persistence, validated CSV import, exception reviews, dependency checks, portal simulation, audit history and JSON backup/restore. The seed contains 100 students, 100 guardians and 15 staff; steps 1–6 are preconfigured. Use **Start fresh** to test all eight steps. The complete workspace adds admissions, student and staff workflows, attendance, timetables, academics, exams, fees, communications, reports, calendar, approvals and settings. Open `/dashboard` for operations. See [workspace implementation and limitations](docs/workspace-milestone.md).

Data survives refresh in the same browser and origin. No authentication, government sync, real notification delivery, payment processing or digital-signature service is connected. See [the setup milestone](docs/setup-milestone.md) and [feature guide](src/features/school-setup/README.md) for scope, storage recovery and workflows.

Shared domain models and Zod schemas are implemented under `src/shared`. The wizard composes these contracts in its own `models`, `schemas` and `domain` folders. Review notes, pipeline progression, school/year relationships and snapshot consistency are validated. See `docs/models-and-validation.md`; `AGENTS.md` requires the same structure for upcoming screens.

## Repository structure

```text
MIS/
├── PROJECT_CONTEXT.md           Product brief and proposed full system architecture
├── docs/
│   ├── architecture.md          Code boundaries and future module map
│   ├── design-system.md         PDF tokens, component rules and pending measurements
│   └── figma-handoff.md         MCP workflow and screen implementation checklist
├── public/
│   └── assets/README.md         Destination rules for approved static assets
├── src/
│   ├── app/                    Thin Next.js routes and root layout
│   │   ├── (reference)/design-system/page.tsx
│   │   ├── (school)/school-setup/page.tsx
│   │   ├── (school)/school-setup/[step]/page.tsx
│   │   ├── (school)/students/page.tsx
│   │   ├── (school)/staff/page.tsx
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── ui/                 Shared buttons, fields, inputs, selects and toggles
│   │   └── layout/            School shell and original Figma asset registry
│   ├── features/
│   │   ├── design-system/components/
│   │   ├── school-setup/      Wizard components, sample data and scoped styles
│   │   ├── academics/README.md
│   │   ├── staff/README.md
│   │   ├── students/README.md
│   │   └── attendance/README.md
│   ├── shared/                 Inferred models, schemas and IndexedDB adapter
│   ├── lib/utils.ts            Shared class name utility
│   └── styles/
│       ├── tokens.css          Single source of visual tokens
│       └── globals.css         Tailwind, local fonts and accessibility defaults
├── components.json             shadcn-compatible component registry configuration
├── next.config.ts
├── postcss.config.mjs
├── tsconfig.json
├── package.json
└── package-lock.json
```

The module README files define intended ownership; they do not imply completed features. Add subfolders only when they hold actual implementation. Add fees, admissions, exams and other features as their screens enter scope.

## Next implementation step

Build daily attendance using the existing saved students, sections and staff, then proceed through the approved remaining-module plan. Keep shared schema/model conventions from `AGENTS.md`. Real backend integration requires server validation, authenticated school membership and permission checks before using real school data.

Workspace storage uses the `workspace-v2` document in the existing IndexedDB database. The original `setup-v1` document is retained and migrated on first load. Use **Export full backup** and **Restore backup** in school setup or settings for all modules and academic years. Browser/origin changes do not share data.

See [the functional audit](docs/workspace-functional-audit.md) for fixes, browser scenarios, repeatable checks and verification limits.

## Role-based workspace expansion

Start at `/login` with your configured school account. See [role workspaces and local setup](docs/role-based-workspaces.md). Open `/workspace` for the module directory.
